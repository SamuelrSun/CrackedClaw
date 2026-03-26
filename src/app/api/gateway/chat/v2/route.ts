/**
 * Chat Stream v2 — Routes through OpenClaw gateway instance
 * Falls back to direct AgentRuntime if no instance is available
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { getUserInstance, streamThroughGateway } from '@/lib/gateway/openclaw-proxy';
import { buildSystemPromptForUser } from '@/lib/gateway/system-prompt';
import { logActivity, incrementTokenUsage } from '@/lib/supabase/data';
import { processAgentResponse } from '@/lib/memory/service';
import { incrementUsage } from '@/lib/usage/tracker';
import { checkTokenLimit } from '@/lib/usage/enforcement';
import { collectBrainSignals } from '@/lib/brain/signals/collector';
import { checkAndTriggerAggregation } from '@/lib/brain/aggregator/auto-trigger';
import { retrieveBrainContext } from '@/lib/brain/retriever/brain-retriever';
import { formatBrainContext } from '@/lib/brain/retriever/context-formatter';
import { retrieveUnifiedContext } from '@/lib/memory/unified-retriever';
import { formatUnifiedContext } from '@/lib/memory/unified-formatter';
import { refreshMemoryContextIfNeeded } from '@/lib/gateway/workspace';
import { resolveAttachments, stripFilePrefix } from '@/lib/files/resolve-attachments';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function encode(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  // Fire-and-forget memory context refresh (rate-limited to 1/5min per user)
  refreshMemoryContextIfNeeded(user!.id).catch(() => {});

  try {
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Resolve file attachments — extract text, base64 images for AI
    const resolved = await resolveAttachments(user!.id, message);

    // Wallet balance enforcement (PAYGO)
    const limitCheck = await checkTokenLimit(user!.id);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: 'insufficient_balance', reason: limitCheck.reason || 'Your balance is $0.00. Add funds to continue.', balance: limitCheck.balance ?? 0 },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    let activeConversationId = conversation_id;

    // Check if user has an OpenClaw instance
    const instance = await getUserInstance(user!.id);
    if (!instance) {
      // No instance — fall back to v1 stream route
      const v1Url = new URL('/api/gateway/chat/stream', request.url);
      return NextResponse.redirect(v1Url, { status: 307 });
    }

    // Create conversation if needed, or rename if it's a fresh "New conversation"
    if (!activeConversationId) {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({
          user_id: user!.id,
          title: message.length > 50 ? message.substring(0, 47) + '...' : message,
        })
        .select()
        .single();
      if (newConvo) activeConversationId = newConvo.id;
    } else {
      // Rename "New conversation" to the first message content
      const { data: existingConvo } = await supabase
        .from('conversations')
        .select('title')
        .eq('id', activeConversationId)
        .single();
      if (existingConvo?.title === 'New conversation') {
        await supabase
          .from('conversations')
          .update({ title: message.length > 50 ? message.substring(0, 47) + '...' : message })
          .eq('id', activeConversationId);
      }
    }

    // Save user message
    if (activeConversationId) {
      await supabase.from('messages').insert({
        conversation_id: activeConversationId,
        role: 'user',
        content: message,
      }).then(() => {}, (e) => console.error('Failed to save user msg:', e));
    }

    // Get conversation history
    let previousMessages: Array<{ role: string; content: string }> = [];
    if (activeConversationId) {
      const { data: historyRows } = await supabase
        .from('messages')
        .select('role, content')
        .eq('conversation_id', activeConversationId)
        .order('created_at', { ascending: false })
        .limit(51);
      if (historyRows && historyRows.length > 0) {
        previousMessages = (historyRows.slice(1).reverse() as Array<{ role: string; content: string }>)
          .map(m => m.role === 'user' ? { ...m, content: stripFilePrefix(m.content) } : m);
      }
    }

    // Read instance_settings once — used for both unified_memory and brain_enabled flags
    const instanceSettings = await (async () => {
      try {
        const supa = await createClient();
        const { data } = await supa
          .from('profiles')
          .select('instance_settings')
          .eq('id', user!.id)
          .single();
        return (data?.instance_settings as Record<string, unknown>) || {};
      } catch { return {} as Record<string, unknown>; }
    })();
    const unifiedMemoryEnabled = (instanceSettings.unified_memory as boolean) ?? true;

    // Build system prompt (skip old memory injection when unified memory is active)
    let systemPrompt = await buildSystemPromptForUser(user!.id, message, activeConversationId || undefined, { skipMemory: unifiedMemoryEnabled });

    if (unifiedMemoryEnabled) {
      // Unified path: single retrieval across all memory types (facts + criteria)
      try {
        const recentUserMsgs = previousMessages
          .filter(m => m.role === 'user')
          .slice(-4)
          .concat([{ role: 'user', content: message }]);
        const unifiedItems = await retrieveUnifiedContext(user!.id, recentUserMsgs);
        const unifiedPrompt = formatUnifiedContext(unifiedItems);
        if (unifiedPrompt) {
          systemPrompt = systemPrompt + '\n\n' + unifiedPrompt;
        }
      } catch {
        // Unified retrieval failure should never break chat
      }
    } else {
      // Legacy path: brain context injection only (memory injection already in system prompt builder)
      try {
        const brainCriteria = await retrieveBrainContext(
          user!.id,
          previousMessages.filter(m => m.role === 'user').slice(-4).concat([{ role: 'user', content: message }])
        );
        const brainPrompt = formatBrainContext(brainCriteria);
        if (brainPrompt) {
          systemPrompt = systemPrompt + '\n\n' + brainPrompt;
        }
      } catch {
        // Brain failure should never break chat
      }
    }

    // All messages for the gateway
    // Use resolved content blocks if images are present; otherwise use extracted text
    const userMessageContent = resolved.contentBlocks.length > 1
      ? resolved.contentBlocks
      : resolved.textContent;

    const allMessages = [
      ...previousMessages,
      { role: 'user', content: userMessageContent },
    ];

    const capturedConvoId = activeConversationId;

    // SSE stream
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    (async () => {
      let fullContent = '';
      const aiResponseStartTimestamp = Date.now();

      try {
        const stream = streamThroughGateway({
          userId: user!.id,
          messages: allMessages,
          systemPrompt,
        });

        for await (const event of stream) {
          if (event.type === 'token') {
            fullContent += event.text;
            try {
              await writer.write(encode('data: ' + JSON.stringify({ type: 'token', text: event.text }) + '\n\n'));
            } catch { /* writer closed */ }
          } else if (event.type === 'done') {
            try {
              await writer.write(encode('data: ' + JSON.stringify({
                type: 'done',
                conversation_id: capturedConvoId,
              }) + '\n\n'));
            } catch { /* writer closed */ }
          } else if (event.type === 'error') {
            try {
              await writer.write(encode('data: ' + JSON.stringify({
                type: 'error',
                message: event.message,
              }) + '\n\n'));
            } catch { /* writer closed */ }
          }
        }
      } catch (err) {
        console.error('Gateway proxy error:', err);
        try {
          await writer.write(encode('data: ' + JSON.stringify({
            type: 'error',
            message: err instanceof Error ? err.message : 'Proxy streaming failed',
          }) + '\n\n'));
        } catch { /* ignore */ }
      }

      // Post-stream: save assistant message, log activity, process task cards
      try {
        const cleanedContent = fullContent ? await processAgentResponse(user!.id, fullContent, message) : fullContent;

        if (capturedConvoId && cleanedContent) {
          await supabase.from('messages').insert({
            conversation_id: capturedConvoId,
            role: 'assistant',
            content: cleanedContent,
          }).then(() => {}, (e) => console.error('Failed to save assistant msg:', e));

          await supabase.from('conversations').update({
            updated_at: new Date().toISOString(),
          }).eq('id', capturedConvoId).then(() => {}, () => {});
        }

        // Extract [[task:...]] tags and create/update agent_tasks records
        // This makes inline task cards update via Realtime
        if (fullContent) {
          const taskTagRegex = /\[\[task:([^:]+):([^:\]]+)(?::([^\]]+))?\]\]/g;
          let match;
          while ((match = taskTagRegex.exec(fullContent)) !== null) {
            const taskName = match[1];
            const taskStatus = match[2]; // running, complete, failed
            const taskDetails = match[3] || null;

            try {
              if (taskStatus === 'running') {
                // Create a new running task
                await supabase.from('agent_tasks').insert({
                  user_id: user!.id,
                  conversation_id: capturedConvoId || null,
                  name: taskName,
                  label: taskName,
                  status: 'running',
                  started_at: new Date().toISOString(),
                });
              } else if (taskStatus === 'complete' || taskStatus === 'completed') {
                // Update the most recent matching running task
                await supabase
                  .from('agent_tasks')
                  .update({ 
                    status: 'completed',
                    result: taskDetails,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('user_id', user!.id)
                  .eq('name', taskName)
                  .in('status', ['running', 'pending'])
                  .order('created_at', { ascending: false })
                  .limit(1);
              } else if (taskStatus === 'failed') {
                await supabase
                  .from('agent_tasks')
                  .update({ 
                    status: 'failed',
                    error: taskDetails,
                    completed_at: new Date().toISOString(),
                  })
                  .eq('user_id', user!.id)
                  .eq('name', taskName)
                  .in('status', ['running', 'pending'])
                  .order('created_at', { ascending: false })
                  .limit(1);
              }
            } catch (taskErr) {
              console.error('[v2/chat] Failed to process task tag:', taskErr);
            }
          }
        }

        // Brain signal collection (fire-and-forget)
        if (cleanedContent) {
          // Reuse instance_settings read from above
          const brainEnabled = (instanceSettings.brain_enabled as boolean) ?? true;

          void collectBrainSignals({
            userId: user!.id,
            userMessage: message,
            aiMessage: cleanedContent,
            previousAIMessage: previousMessages.filter(m => m.role === 'assistant').pop()?.content,
            previousAITimestamp: aiResponseStartTimestamp,
            sessionId: capturedConvoId || undefined,
            brainEnabled,
          }).catch(() => {});
          if (brainEnabled) void checkAndTriggerAggregation(user!.id).catch(() => {});
        }

        // Fire-and-forget session summary extraction (min 4 msgs: 2 user + 2 assistant turns)
        if (cleanedContent && capturedConvoId) {
          const summaryMessages = [
            ...previousMessages.slice(-10),
            { role: 'user' as const, content: message },
            { role: 'assistant' as const, content: cleanedContent },
          ];
          fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://usedopl.com'}/api/memory/session-summary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              userId: user!.id,
              conversationId: capturedConvoId,
              messages: summaryMessages,
            }),
          }).catch(() => {});
        }

        await logActivity('Chat message sent', message.length > 50 ? message.substring(0, 50) + '...' : message, { conversation_id: capturedConvoId })
          .catch(e => console.error('Failed to log activity:', e));

        const estimatedTokens = Math.ceil((message.length + (fullContent?.length ?? 0)) / 4) + 4000;
        await incrementUsage(user!.id, estimatedTokens, 0);
        await incrementTokenUsage(estimatedTokens).catch(() => {});
      } catch (e) {
        console.error('Post-stream error:', e);
      }

      try { await writer.close(); } catch { /* ignore */ }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Conversation-Id': activeConversationId || '',
        'X-Backend': 'openclaw-gateway',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
