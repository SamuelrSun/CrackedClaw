import { createClient } from "@/lib/supabase/server";
import { parseOnboardingActions } from "@/lib/onboarding/agent-prompt";
import { saveMemory } from "@/lib/memory/service";
import { toOnboardingState, type OnboardingStep } from "@/types/onboarding";

/**
 * Process the AI response and update onboarding state accordingly.
 * Shared between the streaming and non-streaming chat routes.
 */
export async function processOnboardingResponse(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  userMessage: string,
  assistantResponse: string,
  currentState: ReturnType<typeof toOnboardingState>
) {
  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  const addCompletedStep = (step: OnboardingStep) => {
    const currentSteps =
      (updates.completed_steps as OnboardingStep[]) || [...currentState.completed_steps];
    if (!currentSteps.includes(step)) {
      updates.completed_steps = [...currentSteps, step];
    }
  };

  // Name extraction via AI tags in assistant response (not regex on user message)
  const userNameMatch = assistantResponse.match(/\[\[user_name:([^\]]+)\]\]/);
  if (userNameMatch && !currentState.user_display_name) {
    const userName = userNameMatch[1].trim();
    updates.user_display_name = userName;
    addCompletedStep("user_name_provided");
    saveMemory(userId, 'user_name', userName, { category: 'personal', source: 'onboarding' }).catch(() => {});
  }
  
  const agentNameMatch = assistantResponse.match(/\[\[agent_name:([^\]]+)\]\]/);
  if (agentNameMatch && !currentState.agent_name) {
    const agentName = agentNameMatch[1].trim();
    updates.agent_name = agentName;
    addCompletedStep("agent_name_provided");
    saveMemory(userId, 'agent_name', agentName, { category: 'preference', source: 'onboarding' }).catch(() => {});
  }

  const actions = parseOnboardingActions(assistantResponse);

  for (const action of actions) {
    switch (action.type) {
      case "welcome": {
        const completedSteps =
          (updates.completed_steps as OnboardingStep[]) || currentState.completed_steps;
        if (
          completedSteps.includes("user_name_provided") &&
          completedSteps.includes("agent_name_provided")
        ) {
          updates.phase = "integrations";
        }
        break;
      }

      case "integration":
        break;

      case "action":
        if (action.payload === "complete_onboarding") {
          updates.phase = "complete";
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

  if (Object.keys(updates).length > 0) {
    updates.updated_at = now;
    const { error } = await supabase
      .from("onboarding_state")
      .update(updates)
      .eq("user_id", userId);
    if (error) console.error("Failed to update onboarding state:", error);
  }
}
