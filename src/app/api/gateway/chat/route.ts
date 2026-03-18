import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage } from "@/lib/supabase/data";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";
import { processAgentResponse } from "@/lib/memory/service";
import { addChatTurn } from "@/lib/memory/chat-memory";
import { incrementUsage } from "@/lib/usage/tracker";
import { checkTokenLimit } from "@/lib/usage/enforcement";
import { buildSystemPromptForUser, buildLinkedContextSummary } from "@/lib/gateway/system-prompt";
import { getUserInstance } from "@/lib/gateway/openclaw-proxy";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message, conversation_id, model: modelLevel } = body;

    if (!message || typeof message !== "string") {
      return errorResponse("Message is required", 400);
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
      return errorResponse(`Token limit reached: ${limitCheck.reason}`, 429);
    }

    const supabase = await createClient();
    let activeConversationId = conversation_id;

    // Check for OpenClaw gateway instance
    const instance = await getUserInstance(user.id);
    if (!instance) {
      return errorResponse("No OpenClaw instance configured. Please set up your workspace.", 503);
    }

    // Create conversation if needed
    if (!activeConversationId) {
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: message.length > 50 ? message.substring(0, 47) + "..." : message,
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
    let systemPrompt = await buildSystemPromptForUser(user.id, message);
    if (activeConversationId) {
      const linkedCtx = await buildLinkedContextSummary(user.id, activeConversationId);
      if (linkedCtx) systemPrompt += "\n\n" + linkedCtx;
    }
    if (workflowContext) systemPrompt += "\n\n" + workflowContext;

    // Route through OpenClaw gateway
    const gatewayBase = instance.port === 443
      ? `https://${instance.host}`
      : `http://${instance.host}:${instance.port}`;
    const gatewayUrl = `${gatewayBase}/v1/chat/completions`;

    const gatewayMessages = [
      { role: 'system', content: systemPrompt },
      ...previousMessages,
      { role: "user", content: message },
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
        stream: false,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      console.error('Gateway error:', res.status, errText);
      return errorResponse(`Gateway error: ${res.status}`, 502);
    }

    const data = await res.json();
    const responseContent = data.choices?.[0]?.message?.content || '';

    // Process memory markers
    const cleanedContent = responseContent
      ? await processAgentResponse(user.id, responseContent)
      : responseContent;

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

    // Batched chat memory extraction (fire-and-forget)
    if (cleanedContent) {
      addChatTurn(user.id, message, cleanedContent, activeConversationId || undefined).catch(() => {});
    }

    // Log activity
    await logActivity(
      "Chat message sent",
      message.length > 50 ? message.substring(0, 50) + "..." : message,
      { conversation_id: activeConversationId }
    ).catch((err: unknown) => console.error('Failed to log activity:', err));

    // Track usage
    const totalTokens = data.usage?.total_tokens || (Math.ceil((message.length + responseContent.length) / 4) + 4000);
    await incrementUsage(user.id, totalTokens, 0);
    await incrementTokenUsage(totalTokens).catch((err: unknown) => console.error('Failed to track token usage:', err));

    return jsonResponse({
      message: cleanedContent,
      conversation_id: activeConversationId,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
