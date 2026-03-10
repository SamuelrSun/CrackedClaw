import { createClient } from "@/lib/supabase/server";
import { parseOnboardingActions, extractUserNameFromResponse, extractAgentNameFromResponse } from "@/lib/onboarding/agent-prompt";
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

  // --- Intro phase: extract names ---
  if (currentState.phase === "intro") {
    const userNameTag = assistantResponse.match(/\[\[user_name:([^\]]+)\]\]/);
    const agentNameTag = assistantResponse.match(/\[\[agent_name:([^\]]+)\]\]/);

    if (!currentState.user_display_name && !updates.user_display_name) {
      const userName = userNameTag?.[1]?.trim() || extractUserNameFromResponse(assistantResponse);
      if (userName) {
        updates.user_display_name = userName;
        addCompletedStep("user_name_provided");
        saveMemory(userId, 'user_name', userName, { category: 'personal', source: 'onboarding' }).catch(() => {});
      }
    }

    if ((currentState.user_display_name || updates.user_display_name) && !currentState.agent_name && !updates.agent_name) {
      const agentName = agentNameTag?.[1]?.trim() || extractAgentNameFromResponse(assistantResponse);
      if (agentName) {
        updates.agent_name = agentName;
        addCompletedStep("agent_name_provided");
        saveMemory(userId, 'agent_name', agentName, { category: 'preference', source: 'onboarding' }).catch(() => {});
      }
    }
  }

  // --- Parse all actions from the response ---
  const actions = parseOnboardingActions(assistantResponse);

  // --- Process [[REMEMBER: key=value]] tags ---
  const rememberPattern = /\[\[REMEMBER:\s*([^\]]+)\]\]/g;
  let rememberMatch;
  while ((rememberMatch = rememberPattern.exec(assistantResponse)) !== null) {
    const kv = rememberMatch[1].trim();
    const eqIndex = kv.indexOf('=');
    if (eqIndex > 0) {
      const key = kv.substring(0, eqIndex).trim();
      const value = kv.substring(eqIndex + 1).trim();
      saveMemory(userId, key, value, { category: 'personal', source: 'onboarding' }).catch(() => {});
    }
  }

  for (const action of actions) {
    switch (action.type) {
      case "welcome": {
        // After welcome animation, transition to tools phase
        const completedSteps =
          (updates.completed_steps as OnboardingStep[]) || currentState.completed_steps;
        if (
          completedSteps.includes("user_name_provided") &&
          completedSteps.includes("agent_name_provided")
        ) {
          updates.phase = "tools";
          // If the agent already asked about tools in the same message, mark it
          if (assistantResponse.toLowerCase().includes("what tools") ||
              assistantResponse.toLowerCase().includes("what do you use") ||
              assistantResponse.toLowerCase().includes("your stack")) {
            addCompletedStep("tools_asked");
          }
        }
        break;
      }

      case "integration": {
        // [[integrations:resolve:...]] detected — mark integrations shown, transition to connecting
        if (action.payload.startsWith("resolve:")) {
          addCompletedStep("integrations_shown");
          updates.phase = "connecting";
        }
        break;
      }

      case "task": {
        // [[task:NAME:STATUS:DETAILS]] — track scan progress
        const parts = action.payload.split(":");
        if (parts.length >= 2) {
          const status = parts[1];
          if (status === "running") {
            addCompletedStep("scan_started");
          } else if (status === "complete") {
            addCompletedStep("scan_completed");
          }
        }
        break;
      }

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
          addCompletedStep("scan_completed");
        } catch {
          // Invalid JSON
        }
        break;

      case "workflow":
        break;
    }
  }

  // --- Learning phase: detect questions being asked ---
  if (currentState.phase === "learning" || updates.phase === "learning") {
    const lower = assistantResponse.toLowerCase();
    if (lower.includes("what do you do") || lower.includes("are you a student") || lower.includes("working somewhere") || lower.includes("building something")) {
      addCompletedStep("identity_asked");
    }
    if (lower.includes("typical day") || lower.includes("day look like")) {
      addCompletedStep("workflow_asked");
    }
    if (lower.includes("tedious") || lower.includes("automate") || lower.includes("most annoying")) {
      addCompletedStep("priorities_asked");
    }
    if (lower.includes("work closely with") || lower.includes("co-founder") || lower.includes("teammate") || lower.includes("anyone i should know")) {
      addCompletedStep("relationships_asked");
    }
  }

  // --- Connecting phase: detect user wanting to move on ---
  if (currentState.phase === "connecting") {
    const lowerUser = userMessage.toLowerCase();
    const doneSignals = ["that's all", "thats all", "done", "ready", "move on", "next", "skip", "let's go", "lets go"];
    if (doneSignals.some(s => lowerUser.includes(s))) {
      updates.phase = "learning";
    }
  }

  // --- Tools phase: if integrations:resolve was in the response, we already set connecting above ---
  // Also handle tools phase where user listed tools but response has resolve tag
  if (currentState.phase === "tools") {
    const hasResolve = actions.some(a => a.type === "integration" && a.payload.startsWith("resolve:"));
    if (hasResolve) {
      addCompletedStep("integrations_shown");
      updates.phase = "connecting";
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
