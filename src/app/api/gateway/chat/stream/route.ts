import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage } from "@/lib/supabase/data";
import { getOnboardingPrompt } from "@/lib/onboarding/agent-prompt";
import { toOnboardingState, type OnboardingStateRow, type OnboardingStep } from "@/types/onboarding";
import { processOnboardingResponse } from "@/lib/onboarding/process-response";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";
import { processAgentResponse } from "@/lib/memory/service";
import { incrementUsage } from "@/lib/usage/tracker";
import { buildSystemPromptForUser, buildLinkedContextSummary } from "@/lib/gateway/system-prompt";
import { AgentRuntime } from "@/lib/agent/runtime";
import { getTools } from "@/lib/agent/tools";
import type { AgentContext, StreamEvent } from "@/lib/agent/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function encode(chunk: StreamEvent | Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`);
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const supabase = await createClient();
    let activeConversationId = conversation_id;

    // Onboarding
    let isOnboarding = false;
    let onboardingState = null;
    let onboardingPrompt: string | null = null;

    try {
      const { data: stateRow } = await supabase
        .from("onboarding_state")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (stateRow && stateRow.phase !== "complete") {
        let isWelcomeConversation = false;
        if (activeConversationId) {
          const { data: convo } = await supabase
            .from("conversations")
            .select("title")
            .eq("id", activeConversationId)
            .single();
          isWelcomeConversation =
            convo?.title === "Welcome to CrackedClaw" || convo?.title === "Welcome to OpenClaw";
        } else {
          const { data: existingWelcome } = await supabase
            .from("conversations")
            .select("id")
            .eq("user_id", user.id)
            .in("title", ["Welcome to CrackedClaw", "Welcome to OpenClaw"])
            .limit(1);
          isWelcomeConversation = !existingWelcome || existingWelcome.length === 0;
        }
        if (isWelcomeConversation) {
          isOnboarding = true;
          onboardingState = toOnboardingState(stateRow as OnboardingStateRow);
          onboardingPrompt = getOnboardingPrompt(onboardingState);
        }
      }
    } catch (e) {
      console.error("Failed to get onboarding state:", e);
    }

    // Create conversation
    if (!activeConversationId) {
      const { data: newConvo } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: isOnboarding ? "Welcome to CrackedClaw" : message.length > 50 ? message.substring(0, 47) + "..." : message,
        })
        .select()
        .single();
      if (newConvo) activeConversationId = newConvo.id;
    }

    // Save user message
    if (activeConversationId) {
      try { await supabase.from("messages").insert({ conversation_id: activeConversationId, role: "user", content: message }); } catch(e) { console.error("Failed to save user message:", e); }
    }

    // Workflow
    let workflowContext: string | null = null;
    if (!isOnboarding) {
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
    }

    // History
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

    // System prompt
    let systemPrompt: string;
    if (isOnboarding) {
      try {
        const { data: connectedIntegrations } = await supabase
          .from('user_integrations')
          .select('provider')
          .eq('user_id', user.id)
          .eq('status', 'connected');
        if (connectedIntegrations && connectedIntegrations.length > 0) {
          const providers = connectedIntegrations.map((i: { provider: string }) => i.provider);
          onboardingPrompt = (onboardingPrompt || '') + '\n\nALREADY CONNECTED INTEGRATIONS:\n' + providers.map(p => `- ${p}`).join('\n');

          // During connecting phase: inject which integrations are connected so agent can acknowledge
          if (onboardingState && onboardingState.phase === 'connecting') {
            onboardingPrompt += '\n\n[System: The user has connected these integrations: ' + providers.join(', ') + '. Acknowledge any new connections and ask if they want to connect more or move on.]';
          }
        }
      } catch { /* ignore */ }

      // During learning phase: merge with full user system prompt so the agent has access to tools
      if (onboardingState && onboardingState.phase === 'learning') {
        const fullUserPrompt = await buildSystemPromptForUser(user.id, message);
        systemPrompt = (onboardingPrompt || '') + '\n\n' + fullUserPrompt;
      } else {
        systemPrompt = onboardingPrompt || 'You are a helpful assistant.';
      }
    } else {
      systemPrompt = await buildSystemPromptForUser(user.id, message);
      if (activeConversationId) {
        const linkedCtx = await buildLinkedContextSummary(user.id, activeConversationId);
        if (linkedCtx) systemPrompt += "\n\n" + linkedCtx;
      }
      if (workflowContext) systemPrompt += "\n\n" + workflowContext;
    }

    let userMessageContent = message;
    if (isOnboarding && onboardingPrompt) {
      userMessageContent = `[SYSTEM PROMPT - FOLLOW THESE INSTRUCTIONS]\n${onboardingPrompt}\n\n[USER MESSAGE]\n${message}`;
    }

    const messagesForRuntime: Array<{ role: "user" | "assistant"; content: string }> = [
      ...previousMessages,
      { role: "user", content: userMessageContent },
    ];

    // Agent context
    let integrationIds: string[] = [];
    try {
      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('provider')
        .eq('user_id', user.id)
        .eq('status', 'connected');
      integrationIds = (integrations ?? []).map((i: { provider: string }) => i.provider);
    } catch { /* ignore */ }

    // Check companion status
    let companionConnected = false;
    try {
      const statusRes = await fetch('https://companion.crackedclaw.com/api/companion/status');
      if (statusRes.ok) {
        const companionStatus = await statusRes.json();
        companionConnected = (companionStatus.connected || []).includes(user.id);
      }
    } catch { /* ignore - companion not available */ }

    const agentContext: AgentContext = {
      userId: user.id,
      orgId: '',
      conversationId: activeConversationId || '',
      companionConnected,
      integrations: integrationIds,
    };

    const capturedConvoId = activeConversationId;
    const capturedOnboardingState = onboardingState;

    // SSE stream
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    (async () => {
      let fullContent = '';
      let inputTokens = 0;
      let outputTokens = 0;

      try {
        const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);
        const tools = getTools(agentContext);

        const stream = runtime.chatStream(
          { model: 'claude-sonnet-4-20250514', systemPrompt, tools, maxTokens: 8192 },
          messagesForRuntime,
          agentContext,
        );

        for await (const event of stream) {
          if (event.type === 'token') {
            fullContent += event.text;
          }
          if (event.type === 'done') {
            (event as Record<string, unknown>).conversation_id = capturedConvoId;
            if ((event as Record<string, unknown>).usage) {
              const u = (event as Record<string, unknown>).usage as { inputTokens: number; outputTokens: number };
              inputTokens = u.inputTokens;
              outputTokens = u.outputTokens;
            }
          }
          try { await writer.write(encode(event)); } catch { /* writer closed */ }
        }
      } catch (err) {
        console.error("Streaming error:", err);
        try {
          await writer.write(encode({ type: 'error', message: err instanceof Error ? err.message : 'Streaming failed' }));
        } catch { /* ignore */ }
      }

      // Post-stream cleanup
      try {
        const cleanedContent = fullContent ? await processAgentResponse(user.id, fullContent, message) : fullContent;

        if (isOnboarding && capturedOnboardingState && cleanedContent) {
          await processOnboardingResponse(supabase, user.id, message, cleanedContent, capturedOnboardingState);
        }

        if (capturedConvoId && cleanedContent) {
          try { await supabase.from("messages").insert({ conversation_id: capturedConvoId, role: "assistant", content: cleanedContent }); } catch(e) { console.error("Failed to save assistant message:", e); }
          try { await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", capturedConvoId);
          } catch { }
        }

        await logActivity("Chat message sent", message.length > 50 ? message.substring(0, 50) + "..." : message, { conversation_id: capturedConvoId })
          .catch(e => console.error("Failed to log activity:", e));

        // Estimate tokens since streaming doesn't easily expose usage
        const estimatedTokens = inputTokens + outputTokens || Math.ceil((message.length + (cleanedContent?.length ?? 0)) / 4);
        incrementUsage(user.id, estimatedTokens, 0);
        await incrementTokenUsage(estimatedTokens).catch((e: unknown) => console.error("Failed to track usage:", e));
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
      },
    });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
