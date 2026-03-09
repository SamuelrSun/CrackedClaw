import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage } from "@/lib/supabase/data";
import { getOnboardingPrompt } from "@/lib/onboarding/agent-prompt";
import { toOnboardingState, type OnboardingStateRow } from "@/types/onboarding";
import { processOnboardingResponse } from "@/lib/onboarding/process-response";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";
import { processAgentResponse } from "@/lib/memory/service";
import { incrementUsage } from "@/lib/usage/tracker";
import { buildSystemPromptForUser, buildLinkedContextSummary } from "@/lib/gateway/system-prompt";
import { AgentRuntime } from "@/lib/agent/runtime";
import { getTools } from "@/lib/agent/tools";
import type { AgentContext } from "@/lib/agent/runtime";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || typeof message !== "string") {
      return errorResponse("Message is required", 400);
    }

    const supabase = await createClient();
    let activeConversationId = conversation_id;

    // Onboarding check
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

    // Create conversation if needed
    if (!activeConversationId) {
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: isOnboarding
            ? "Welcome to CrackedClaw"
            : message.length > 50 ? message.substring(0, 47) + "..." : message,
        })
        .select()
        .single();
      if (convoError) console.error("Failed to create conversation:", convoError);
      else activeConversationId = newConvo.id;
    }

    // Save user message
    if (activeConversationId) {
      try { await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        role: "user",
        content: message,
      }); } catch(e) { console.error("Failed to save user message:", e); }
    }

    // Workflow match
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
      } catch (e) {
        console.error("Failed to match workflows:", e);
      }
    }

    // Load conversation history
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
      } catch (e) {
        console.error("Failed to load conversation history:", e);
      }
    }

    // Build system prompt
    let systemPrompt: string;
    if (isOnboarding) {
      // Inject already-connected integrations into onboarding prompt
      try {
        const { data: connectedIntegrations } = await supabase
          .from('user_integrations')
          .select('provider')
          .eq('user_id', user.id)
          .eq('status', 'connected');
        if (connectedIntegrations && connectedIntegrations.length > 0) {
          const providers = connectedIntegrations.map((i: { provider: string }) => i.provider);
          onboardingPrompt = (onboardingPrompt || '') + '\n\nALREADY CONNECTED INTEGRATIONS (do NOT ask to connect these again):\n' + providers.map(p => `- ${p}`).join('\n');
        }
      } catch { /* ignore */ }
      systemPrompt = onboardingPrompt || 'You are a helpful assistant.';
    } else {
      systemPrompt = await buildSystemPromptForUser(user.id, message);
      if (activeConversationId) {
        const linkedCtx = await buildLinkedContextSummary(user.id, activeConversationId);
        if (linkedCtx) systemPrompt += "\n\n" + linkedCtx;
      }
      if (workflowContext) systemPrompt += "\n\n" + workflowContext;
    }

    // Build messages array
    let userMessageContent = message;
    if (isOnboarding && onboardingPrompt) {
      userMessageContent = `[SYSTEM PROMPT - FOLLOW THESE INSTRUCTIONS]\n${onboardingPrompt}\n\n[USER MESSAGE]\n${message}`;
    }

    const messagesForRuntime: Array<{ role: "user" | "assistant"; content: string }> = [
      ...previousMessages,
      { role: "user", content: userMessageContent },
    ];

    // Get user integrations for context
    let integrationIds: string[] = [];
    try {
      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('provider')
        .eq('user_id', user.id)
        .eq('status', 'connected');
      integrationIds = (integrations ?? []).map((i: { provider: string }) => i.provider);
    } catch { /* ignore */ }

    const agentContext: AgentContext = {
      userId: user.id,
      orgId: '',
      conversationId: activeConversationId || '',
      companionConnected: false,
      integrations: integrationIds,
    };

    // Run agent
    const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);
    const tools = getTools(agentContext);

    const result = await runtime.chat(
      {
        model: 'claude-sonnet-4-20250514',
        systemPrompt,
        tools,
        maxTokens: 8192,
      },
      messagesForRuntime,
      agentContext,
    );

    // Process memory markers
    const cleanedContent = result.response
      ? await processAgentResponse(user.id, result.response)
      : result.response;

    // Process onboarding
    if (isOnboarding && onboardingState && cleanedContent) {
      await processOnboardingResponse(supabase, user.id, message, cleanedContent, onboardingState);
    }

    // Save assistant message
    if (activeConversationId && cleanedContent) {
      try { await supabase.from("messages").insert({
        conversation_id: activeConversationId,
        role: "assistant",
        content: cleanedContent,
      }); } catch(e) { console.error("Failed to save assistant message:", e); }

      try {
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", activeConversationId);
      } catch { }
    }

    // Log activity
    await logActivity(
      "Chat message sent",
      message.length > 50 ? message.substring(0, 50) + "..." : message,
      { conversation_id: activeConversationId }
    ).catch((err: unknown) => console.error('Failed to log activity:', err));

    // Track usage
    const totalTokens = result.usage.inputTokens + result.usage.outputTokens;
    incrementUsage(user.id, totalTokens, 0);
    await incrementTokenUsage(totalTokens).catch((err: unknown) => console.error('Failed to track token usage:', err));

    return jsonResponse({
      message: cleanedContent,
      conversation_id: activeConversationId,
      timestamp: new Date().toISOString(),
      is_onboarding: isOnboarding,
      onboarding_phase: onboardingState?.phase,
    });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
