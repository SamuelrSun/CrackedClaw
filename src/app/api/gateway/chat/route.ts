import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage, getOrganization } from "@/lib/supabase/data";
import { sendGatewayMessage } from "@/lib/gateway-client";
import { getOnboardingPrompt } from "@/lib/onboarding/agent-prompt";
import { toOnboardingState, type OnboardingStateRow } from "@/types/onboarding";
import { processOnboardingResponse } from "@/lib/onboarding/process-response";
import type { GatewayError } from "@/types/gateway";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";
import { processAgentResponse } from "@/lib/memory/service";
import { incrementUsage } from "@/lib/usage/tracker";
import { buildSystemPromptForUser, buildLinkedContextSummary } from "@/lib/gateway/system-prompt";

export const dynamic = 'force-dynamic';

// POST /api/gateway/chat - Send a message through the user's gateway
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message, conversation_id } = body;

    if (!message || typeof message !== "string") {
      return errorResponse("Message is required", 400);
    }

    // Get gateway info
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

    // Check if user is in onboarding
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
      // Continue without onboarding
    }

    // Create or get conversation
    if (!activeConversationId) {
      const { data: newConvo, error: convoError } = await supabase
        .from("conversations")
        .insert({
          user_id: user.id,
          title: isOnboarding ? "Welcome to CrackedClaw" : (message.length > 50 ? message.substring(0, 47) + "..." : message),
        })
        .select()
        .single();

      if (convoError) {
        console.error("Failed to create conversation:", convoError);
      } else {
        activeConversationId = newConvo.id;
      }
    }

    // Save user message
    if (activeConversationId) {
      const { error: msgError } = await supabase
        .from("messages")
        .insert({
          conversation_id: activeConversationId,
          role: "user",
          content: message,
        });
      
      if (msgError) {
        console.error("Failed to save user message:", msgError);
      }
    }

    // Check for workflow match (skip during onboarding)
    let workflowContext: string | null = null;
    let matchedWorkflowId: string | null = null;
    if (!isOnboarding) {
      try {
        const { data: workflows } = await supabase
          .from("workflows")
          .select("id, name, description, prompt, trigger_phrases")
          .eq("user_id", user.id);
        const workflowMatch = matchWorkflow(message, workflows || []);
        if (workflowMatch && workflowMatch.confidence >= 0.8) {
          matchedWorkflowId = workflowMatch.workflow.id;
          workflowContext = buildWorkflowContext(workflowMatch.workflow);
        }
      } catch (e) {
        console.error("Failed to match workflows:", e);
      }
    }

    // Build the message to send
    // If in onboarding, prepend the system prompt
    let fullMessage = message;
    if (isOnboarding && onboardingPrompt) {
      fullMessage = `[SYSTEM PROMPT - FOLLOW THESE INSTRUCTIONS]\n${onboardingPrompt}\n\n[USER MESSAGE]\n${message}`;
    } else if (workflowContext) {
      fullMessage = `${workflowContext}\n\n${fullMessage}`;
    }

    // Send message through gateway
    try {
      let systemPrompt: string | undefined;
      if (isOnboarding) {
        // Even during onboarding, inject connected integrations so agent knows what's already set up
        const supabaseForIntegrations = await createClient();
        const { data: connectedIntegrations } = await supabaseForIntegrations
          .from('user_integrations')
          .select('provider')
          .eq('user_id', user.id)
          .eq('status', 'connected');
        if (connectedIntegrations && connectedIntegrations.length > 0) {
          const providers = connectedIntegrations.map((i: { provider: string }) => i.provider);
          onboardingPrompt = (onboardingPrompt || '') + '\n\nALREADY CONNECTED INTEGRATIONS (do NOT ask to connect these again, just USE them):\n' + providers.map(p => `- ${p}`).join('\n');
        }
        systemPrompt = undefined;
      } else {
        systemPrompt = await buildSystemPromptForUser(user.id, message);
        // Inject linked conversation context
        if (activeConversationId) {
          const linkedCtx = await buildLinkedContextSummary(user.id, activeConversationId);
          if (linkedCtx) {
            systemPrompt = systemPrompt + "\n\n" + linkedCtx;
          }
        }
      }
      const response = await sendGatewayMessage(gatewayUrl, authToken, fullMessage, activeConversationId, { systemPrompt });

      if (response.error) {
        const err: GatewayError = {
          code: "GATEWAY_ERROR",
          message: response.error,
        };
        return NextResponse.json({ error: err }, { status: 503 });
      }

      // Process memory/secret markers and clean response
      const cleanedContent = response.content
        ? await processAgentResponse(user.id, response.content)
        : response.content;

      // Process onboarding state updates based on response
      if (isOnboarding && onboardingState && cleanedContent) {
        await processOnboardingResponse(supabase, user.id, message, cleanedContent, onboardingState);
      }

      // Save assistant message
      if (activeConversationId && cleanedContent) {
        const { error: asstError } = await supabase
          .from("messages")
          .insert({
            conversation_id: activeConversationId,
            role: "assistant",
            content: cleanedContent,
          });
        
        if (asstError) {
          console.error("Failed to save assistant message:", asstError);
        }

        // Update conversation timestamp
        await supabase
          .from("conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", activeConversationId);
      }

      // Log activity
      await logActivity(
        "Chat message sent",
        message.length > 50 ? message.substring(0, 50) + "..." : message,
        { conversation_id: activeConversationId }
      ).catch(err => console.error('Failed to log activity:', err));

      // Track token usage
      const responseText = response.content || '';
      const estimatedTokens = Math.ceil((message.length + responseText.length) / 4);
      incrementUsage(user.id, estimatedTokens, 0); // fire-and-forget usage tracking
      await incrementTokenUsage(estimatedTokens).catch(err => {
        console.error('Failed to track token usage:', err);
      });

      return jsonResponse({
        message: cleanedContent,
        conversation_id: activeConversationId,
        timestamp: response.timestamp,
        is_onboarding: isOnboarding,
        onboarding_phase: onboardingState?.phase,
      });
    } catch (gatewayError) {
      console.error("Gateway chat error:", gatewayError);
      const err: GatewayError = {
        code: "GATEWAY_OFFLINE",
        message: "Failed to communicate with gateway.",
      };
      return NextResponse.json({ error: err }, { status: 503 });
    }
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
