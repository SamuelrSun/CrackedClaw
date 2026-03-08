import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity, incrementTokenUsage, getOrganization } from "@/lib/supabase/data";
import { sendGatewayMessage } from "@/lib/gateway-client";
import { getOnboardingPrompt, parseOnboardingActions, extractUserName, extractAgentName } from "@/lib/onboarding/agent-prompt";
import { toOnboardingState, type OnboardingStateRow, type OnboardingStep } from "@/types/onboarding";
import type { GatewayError } from "@/types/gateway";
import { matchWorkflow, buildWorkflowContext } from "@/lib/workflows/matcher";

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
        isOnboarding = true;
        onboardingState = toOnboardingState(stateRow as OnboardingStateRow);
        onboardingPrompt = getOnboardingPrompt(onboardingState);
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
          title: isOnboarding ? "Welcome to OpenClaw" : (message.length > 50 ? message.substring(0, 47) + "..." : message),
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
      const response = await sendGatewayMessage(gatewayUrl, authToken, fullMessage, activeConversationId);

      if (response.error) {
        const err: GatewayError = {
          code: "GATEWAY_ERROR",
          message: response.error,
        };
        return NextResponse.json({ error: err }, { status: 503 });
      }

      // Process onboarding state updates based on response
      if (isOnboarding && onboardingState && response.content) {
        await processOnboardingResponse(supabase, user.id, message, response.content, onboardingState);
      }

      // Save assistant message
      if (activeConversationId && response.content) {
        const { error: asstError } = await supabase
          .from("messages")
          .insert({
            conversation_id: activeConversationId,
            role: "assistant",
            content: response.content,
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
      await incrementTokenUsage(estimatedTokens).catch(err => {
        console.error('Failed to track token usage:', err);
      });

      return jsonResponse({
        message: response.content,
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

/**
 * Process the AI response and update onboarding state accordingly
 */
async function processOnboardingResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMessage: string,
  assistantResponse: string,
  currentState: ReturnType<typeof toOnboardingState>
) {
  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  // Helper to safely add to completed_steps
  const addCompletedStep = (step: OnboardingStep) => {
    const currentSteps = (updates.completed_steps as OnboardingStep[]) || [...currentState.completed_steps];
    if (!currentSteps.includes(step)) {
      updates.completed_steps = [...currentSteps, step];
    }
  };

  // Extract names from user message if in welcome phase
  if (currentState.phase === "welcome") {
    // Check for user name
    if (!currentState.user_display_name) {
      const userName = extractUserName(userMessage);
      if (userName) {
        updates.user_display_name = userName;
        addCompletedStep("user_name_provided");
      }
    }
    // Check for agent name
    else if (!currentState.agent_name) {
      const agentName = extractAgentName(userMessage);
      if (agentName) {
        updates.agent_name = agentName;
        addCompletedStep("agent_name_provided");
      }
    }
  }

  // Parse special actions from response
  const actions = parseOnboardingActions(assistantResponse);
  
  for (const action of actions) {
    switch (action.type) {
      case "welcome": {
        // Welcome animation triggered - check if we should advance phase
        const completedSteps = (updates.completed_steps as OnboardingStep[]) || currentState.completed_steps;
        if (completedSteps.includes("user_name_provided") && completedSteps.includes("agent_name_provided")) {
          // Advance to integrations phase after welcome
          updates.phase = "integrations";
        }
        break;
      }

      case "integration":
        // User clicked connect - mark step in progress
        // We'll track the connection when OAuth completes
        break;

      case "action":
        if (action.payload === "complete_onboarding") {
          updates.phase = "complete";
          // Also update profile
          await supabase
            .from("profiles")
            .update({
              onboarding_completed: true,
              onboarding_completed_at: now,
              updated_at: now,
            })
            .eq("id", userId);
        }
        break;

      case "context":
        // Context gathering results
        try {
          const contextData = JSON.parse(action.payload);
          updates.gathered_context = {
            ...currentState.gathered_context,
            ...contextData,
          };
          addCompletedStep("context_scan_completed");
        } catch {
          // Invalid JSON
        }
        break;

      case "workflow":
        // Workflow suggestions
        try {
          const workflowData = JSON.parse(action.payload);
          if (workflowData.suggestions) {
            updates.suggested_workflows = workflowData.suggestions;
          }
          addCompletedStep("workflow_suggested");
        } catch {
          // Invalid JSON
        }
        break;
    }
  }

  // Apply updates if any
  if (Object.keys(updates).length > 0) {
    updates.updated_at = now;
    
    const { error } = await supabase
      .from("onboarding_state")
      .update(updates)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to update onboarding state:", error);
    }
  }
}
