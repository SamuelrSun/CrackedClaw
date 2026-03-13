import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage } from "@/lib/supabase/data";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";
import { processAgentResponse } from "@/lib/memory/service";
import { incrementUsage } from "@/lib/usage/tracker";
import { checkTokenLimit } from "@/lib/usage/enforcement";
import { buildSystemPromptForUser, buildLinkedContextSummary } from "@/lib/gateway/system-prompt";
import { getUserInstance } from "@/lib/gateway/openclaw-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

type StreamEvent = Record<string, unknown>;

function encode(chunk: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message, conversation_id, model: modelLevel } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const MODEL_MAP: Record<string, string> = {
      haiku: "claude-haiku-4",
      sonnet: "claude-sonnet-4",
      opus: "claude-opus-4",
    };
    const resolvedModel = MODEL_MAP[modelLevel as string] ?? "claude-sonnet-4";

    // Token limit enforcement
    const limitCheck = await checkTokenLimit(user.id);
    if (!limitCheck.allowed) {
      return NextResponse.json(
        { error: "Token limit reached", reason: limitCheck.reason, usage: limitCheck.usage },
        { status: 429 }
      );
    }

    const supabase = await createClient();
    let activeConversationId = conversation_id;

    // ── Create conversation if needed, or rename if it's a fresh "New conversation" ──
    if (!activeConversationId) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: message.length > 50 ? message.substring(0, 47) + "..." : message,
        })
        .select()
        .single();
      if (newConvo) activeConversationId = newConvo.id;
    } else {
      // Rename "New conversation" to the first message content
      const { data: existingConvo } = await supabase
        .from("conversations")
        .select("title")
        .eq("id", activeConversationId)
        .single();
      if (existingConvo?.title === "New conversation") {
        await supabase
          .from("conversations")
          .update({ title: message.length > 50 ? message.substring(0, 47) + "..." : message })
          .eq("id", activeConversationId);
      }
    }

    // ── Save user message ──
    if (activeConversationId) {
      try { await supabase.from("messages").insert({ conversation_id: activeConversationId, role: "user", content: message }); } catch(e) { console.error("Failed to save user message:", e); }
    }

    // ── Workflow matching ──
    let workflowContext: string | null = null;
    try {
      const { data: workflows } = await supabase
        .from("workflows")
        .select("id, name, description, prompt, trigger_phrases")
        .eq("user_id", user.id);
      const workflowMatch = matchWorkflow(message, workflows || []);
      if (workflowMatch && workflowMatch.confidence >= 0.8) {
        workflowContext = buildWorkflowContext(workflowMatch.workflow);
      }
    } catch { /* ignore */ }

    // ── History ──
    let previousMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (activeConversationId) {
      try {
        const { data: historyRows } = await supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: false })
          .limit(51);
        if (historyRows && historyRows.length > 0) {
          previousMessages = (historyRows.slice(1).reverse() as Array<{ role: "user" | "assistant"; content: string }>);
        }
      } catch { /* ignore */ }
    }

    // ── System prompt ──
    let systemPrompt = await buildSystemPromptForUser(user.id, message);
    if (activeConversationId) {
      const linkedCtx = await buildLinkedContextSummary(user.id, activeConversationId);
      if (linkedCtx) systemPrompt += "\n\n" + linkedCtx;
    }
    if (workflowContext) systemPrompt += "\n\n" + workflowContext;

    // Replace conversation ID placeholder for subagent push instructions
    systemPrompt = systemPrompt.replace(/__CONVO_ID__/g, activeConversationId || '');

    const allMessages = [
      ...previousMessages,
      { role: "user" as const, content: message },
    ];

    const capturedConvoId = activeConversationId;

    // ── Check for OpenClaw gateway instance ──
    const instance = await getUserInstance(user.id);

    if (!instance) {
      return NextResponse.json(
        { error: "No OpenClaw instance configured. Please set up your workspace." },
        { status: 503 }
      );
    }

    // ── SSE stream via OpenClaw gateway ──
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    (async () => {
      let fullContent = '';

      try {
        const gatewayBase = instance.port === 443
          ? `https://${instance.host}`
          : `http://${instance.host}:${instance.port}`;
        const gatewayUrl = `${gatewayBase}/v1/chat/completions`;

        const gatewayMessages = [
          { role: 'system', content: systemPrompt },
          ...allMessages,
        ];

        const res = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + instance.gatewayToken,
          },
          body: JSON.stringify({
            messages: gatewayMessages,
            model: resolvedModel,
            stream: true,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => res.statusText);
          console.error('Gateway error:', res.status, errText);
          try {
            await writer.write(encode({ type: 'error', message: `Gateway error: ${res.status}` }));
          } catch { /* ignore */ }
        } else {
          // Stream OpenAI format → our custom format
          const reader = res.body?.getReader();
          if (!reader) throw new Error('No response body from gateway');

          const decoder = new TextDecoder();
          let buffer = '';

          try {
            await writer.write(encode({ type: 'status', backend: 'openclaw-gateway', instance: instance.instanceId }));
          } catch { /* ignore */ }

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith('data: ')) continue;
              const data = trimmed.slice(6);

              if (data === '[DONE]') {
                try {
                  await writer.write(encode({ type: 'done', conversation_id: capturedConvoId }));
                } catch { /* writer closed */ }
                break;
              }

              try {
                const chunk = JSON.parse(data);
                const delta = chunk.choices?.[0]?.delta;
                const finishReason = chunk.choices?.[0]?.finish_reason;

                if (delta?.content) {
                  fullContent += delta.content;
                  try {
                    await writer.write(encode({ type: 'token', text: delta.content }));
                  } catch { /* writer closed */ }
                }

                // Handle tool calls from OpenAI format
                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    if (tc.function?.name) {
                      try {
                        await writer.write(encode({ type: 'tool_start', tool: tc.function.name, input: {} }));
                      } catch { /* ignore */ }
                    }
                  }
                }

                if (finishReason === 'stop' || finishReason === 'end_turn') {
                  try {
                    await writer.write(encode({ type: 'done', conversation_id: capturedConvoId }));
                  } catch { /* ignore */ }
                }
              } catch {
                // Skip unparseable chunks
              }
            }
          }
          reader.releaseLock();
        }
      } catch (err) {
        console.error("Streaming error:", err);
        try {
          await writer.write(encode({ type: 'error', message: err instanceof Error ? err.message : 'Streaming failed' }));
        } catch { /* ignore */ }
      }

      // ── Post-stream: save message, process memory ──
      try {
        const cleanedContent = fullContent ? await processAgentResponse(user.id, fullContent, message) : fullContent;

        if (capturedConvoId && cleanedContent) {
          try { await supabase.from("messages").insert({ conversation_id: capturedConvoId, role: "assistant", content: cleanedContent }); } catch(e) { console.error("Failed to save assistant message:", e); }
          try { await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", capturedConvoId); } catch { }
        }

        // Extract [[task:...]] tags and create/update agent_tasks records
        if (fullContent) {
          const taskTagRegex = /\[\[task:([^:]+):([^:\]]+)(?::([^\]]+))?\]\]/g;
          let taskMatch;
          while ((taskMatch = taskTagRegex.exec(fullContent)) !== null) {
            const taskName = taskMatch[1];
            const taskStatus = taskMatch[2];
            const taskDetails = taskMatch[3] || null;
            try {
              if (taskStatus === 'running') {
                await supabase.from('agent_tasks').insert({
                  user_id: user.id,
                  conversation_id: capturedConvoId || null,
                  name: taskName,
                  label: taskName,
                  status: 'running',
                  started_at: new Date().toISOString(),
                });
              } else if (taskStatus === 'complete' || taskStatus === 'completed') {
                await supabase.from('agent_tasks').update({
                  status: 'completed',
                  result: taskDetails,
                  completed_at: new Date().toISOString(),
                }).eq('user_id', user.id).eq('name', taskName).in('status', ['running', 'pending']).order('created_at', { ascending: false }).limit(1);
              } else if (taskStatus === 'failed') {
                await supabase.from('agent_tasks').update({
                  status: 'failed',
                  error: taskDetails,
                  completed_at: new Date().toISOString(),
                }).eq('user_id', user.id).eq('name', taskName).in('status', ['running', 'pending']).order('created_at', { ascending: false }).limit(1);
              }
            } catch (taskErr) {
              console.error('[stream/chat] Failed to process task tag:', taskErr);
            }
          }
        }

        await logActivity("Chat message sent", message.length > 50 ? message.substring(0, 50) + "..." : message, { conversation_id: capturedConvoId })
          .catch(e => console.error("Failed to log activity:", e));

        const estimatedTokens = Math.ceil((message.length + (fullContent?.length ?? 0)) / 4);
        incrementUsage(user.id, estimatedTokens, 0);
        await incrementTokenUsage(estimatedTokens).catch(() => {});
      } catch (e) {
        console.error("Post-stream error:", e);
      }

      try { await writer.close(); } catch { /* ignore */ }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Conversation-Id": activeConversationId || "",
        "X-Backend": "openclaw-gateway",
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
