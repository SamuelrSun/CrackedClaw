import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage, getOrganization } from "@/lib/supabase/data";
import { streamGatewayMessage, type StreamChunk } from "@/lib/gateway-client";
import { getOnboardingPrompt } from "@/lib/onboarding/agent-prompt";
import { toOnboardingState, type OnboardingStateRow } from "@/types/onboarding";
import { processOnboardingResponse } from "@/lib/onboarding/process-response";
import type { GatewayError } from "@/types/gateway";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";
import { processAgentResponse } from "@/lib/memory/service";
import { incrementUsage } from "@/lib/usage/tracker";
import { buildSystemPromptForUser } from "@/lib/gateway/system-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function encode(chunk: StreamChunk): Uint8Array {
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

    let gatewayUrl: string | null = null;
    let authToken: string | null = null;

    try {
      const org = await getOrganization(user.id);
      if (org?.openclaw_gateway_url && org?.openclaw_auth_token) {
        gatewayUrl = org.openclaw_gateway_url;
        authToken = org.openclaw_auth_token;
      }
    } catch (e) {
      console.error("Failed to get organization:", e);
    }

    if (!gatewayUrl) {
      try {
        const supabase = await createClient();
        const { data } = await supabase
          .from("user_gateways")
          .select("gateway_url, auth_token")
          .eq("user_id", user.id)
          .limit(1);
        if (data && data.length > 0) {
          gatewayUrl = data[0].gateway_url;
          authToken = data[0].auth_token;
        }
      } catch (e) {
        console.error("Failed to get user gateway:", e);
      }
    }

    if (!gatewayUrl || !authToken) {
      const err: GatewayError = {
        code: "NO_GATEWAY",
        message: "No OpenClaw gateway connected. Go to Settings to connect.",
      };
      return NextResponse.json({ error: err }, { status: 404 });
    }

    const supabase = await createClient();
    let activeConversationId = conversation_id;

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
        // Onboarding is conversation-scoped — only apply to the Welcome conversation
        let isWelcomeConversation = false;

        if (activeConversationId) {
          const { data: convo } = await supabase
            .from("conversations")
            .select("title")
            .eq("id", activeConversationId)
            .single();
          isWelcomeConversation =
            convo?.title === "Welcome to CrackedClaw" ||
            convo?.title === "Welcome to OpenClaw";
        } else {
          // No conversation yet — only start onboarding if no welcome convo exists
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

    if (!activeConversationId) {
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: isOnboarding
            ? "Welcome to CrackedClaw"
            : message.length > 50
            ? message.substring(0, 47) + "..."
            : message,
        })
        .select()
        .single();

      if (convoError) {
        console.error("Failed to create conversation:", convoError);
      } else {
        activeConversationId = newConvo.id;
      }
    }

    if (activeConversationId) {
      try {
        await supabase.from("messages").insert({ conversation_id: activeConversationId, role: "user", content: message });
      } catch (e) { console.error("Failed to save user message:", e); }
    }

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

    let fullMessage = message;
    if (isOnboarding && onboardingPrompt) {
      fullMessage = `[SYSTEM PROMPT - FOLLOW THESE INSTRUCTIONS]\n${onboardingPrompt}\n\n[USER MESSAGE]\n${message}`;
    } else if (workflowContext) {
      fullMessage = `${workflowContext}\n\n${fullMessage}`;
    }

    // Load conversation history (last 50 messages, excluding the one we just saved)
    let previousMessages: Array<{ role: string; content: string }> = [];
    if (activeConversationId) {
      try {
        const { data: historyRows } = await supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", activeConversationId)
          .order("created_at", { ascending: false })
          .limit(51); // 51 so we can drop the last user message we just inserted
        if (historyRows && historyRows.length > 0) {
          // Drop the most recent message (the user message we just saved) and reverse to oldest-first
          previousMessages = historyRows.slice(1).reverse() as Array<{ role: string; content: string }>;
        }
      } catch (e) {
        console.error("Failed to load conversation history:", e);
        // Fall back gracefully — previousMessages stays empty
      }
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const capturedGatewayUrl = gatewayUrl;
    const capturedAuthToken = authToken;
    const capturedConvoId = activeConversationId;
    const capturedPreviousMessages = previousMessages;

    (async () => {
      let fullContent = "";

      try {
        // Build the messages array: system + history + current user message
        const systemPrompt = isOnboarding ? undefined : await buildSystemPromptForUser(user.id, message);
        const messagesArray: Array<{ role: string; content: string }> = [];
        if (systemPrompt) {
          messagesArray.push({ role: "system", content: systemPrompt });
        }
        // Add history (already excludes current message)
        messagesArray.push(...capturedPreviousMessages);
        // Add current user message (using fullMessage which may include onboarding prompt)
        messagesArray.push({ role: "user", content: fullMessage });

        const result = await streamGatewayMessage(
          capturedGatewayUrl,
          capturedAuthToken,
          messagesArray,
          capturedConvoId,
          async (chunk: StreamChunk) => {
            if (chunk.type === "token" && chunk.text) {
              fullContent += chunk.text;
            }
            if (chunk.type === "done") {
              chunk.conversation_id = capturedConvoId || chunk.conversation_id;
            }
            try {
              await writer.write(encode(chunk));
            } catch { /* writer closed */ }
          },
        );

        if (result.fullContent && !fullContent) {
          fullContent = result.fullContent;
        }

        if (result.error && !fullContent) {
          try {
            await writer.write(encode({ type: "error", message: result.error }));
          } catch { /* ignore */ }
        }
      } catch (err) {
        console.error("Streaming error:", err);
        try {
          await writer.write(
            encode({ type: "error", message: err instanceof Error ? err.message : "Streaming failed" })
          );
        } catch { /* ignore */ }
      }

      try {
        // Process memory/secret markers and clean response
        const cleanedContent = fullContent
          ? await processAgentResponse(user.id, fullContent)
          : fullContent;

        if (isOnboarding && onboardingState && cleanedContent) {
          await processOnboardingResponse(supabase, user.id, message, cleanedContent, onboardingState);
        }

        if (capturedConvoId && cleanedContent) {
          try {
            await supabase.from("messages").insert({ conversation_id: capturedConvoId, role: "assistant", content: cleanedContent });
          } catch (e) { console.error("Failed to save assistant message:", e); }
          try {
            await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", capturedConvoId);
          } catch (e) { console.error("Failed to update conversation:", e); }
        }

        await logActivity(
          "Chat message sent",
          message.length > 50 ? message.substring(0, 50) + "..." : message,
          { conversation_id: capturedConvoId }
        ).catch((e: unknown) => console.error("Failed to log activity:", e));

        const estimatedTokens = Math.ceil((message.length + (cleanedContent?.length ?? 0)) / 4);
        incrementUsage(user.id, estimatedTokens, 0); // fire-and-forget
        await incrementTokenUsage(estimatedTokens).catch((e: unknown) =>
          console.error("Failed to track token usage:", e)
        );
      } catch (e) {
        console.error("Post-stream DB error:", e);
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
