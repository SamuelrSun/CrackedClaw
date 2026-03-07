import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import {
  toOnboardingState,
  type OnboardingStateRow,
  type UpdateOnboardingRequest,
} from "@/types/onboarding";
import {
  transitionPhase,
  completeStep,
  skipStep,
  setAgentName,
  setUserDisplayName,
  updateGatheredContext,
  setSuggestedWorkflows,
} from "@/lib/onboarding/state-machine";

/**
 * POST /api/onboarding/update
 * Update onboarding state (phase, steps, names, context, etc.)
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body: UpdateOnboardingRequest = await request.json();
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Fetch current state
    const { data: currentStateRow, error: fetchError } = await supabase
      .from("onboarding_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !currentStateRow) {
      return errorResponse("Onboarding not started. Call POST /api/onboarding/start first.", 404);
    }

    let state = toOnboardingState(currentStateRow as OnboardingStateRow);

    // Apply updates in order

    // 1. Phase transition
    if (body.phase && body.phase !== state.phase) {
      const result = transitionPhase(state, body.phase);
      if (!result.success) {
        return errorResponse(result.error || "Invalid phase transition", 400);
      }
      state = result.newState;
    }

    // 2. Complete a step
    if (body.completed_step) {
      state = completeStep(state, body.completed_step);
    }

    // 3. Skip a step
    if (body.skipped_step) {
      state = skipStep(state, body.skipped_step);
    }

    // 4. Set agent name
    if (body.agent_name) {
      state = setAgentName(state, body.agent_name);
    }

    // 5. Set user display name
    if (body.user_display_name) {
      state = setUserDisplayName(state, body.user_display_name);
    }

    // 6. Update gathered context
    if (body.gathered_context) {
      state = updateGatheredContext(state, body.gathered_context);
    }

    // 7. Set suggested workflows
    if (body.suggested_workflows) {
      state = setSuggestedWorkflows(state, body.suggested_workflows);
    }

    // Persist to database
    const { data: updatedState, error: updateError } = await supabase
      .from("onboarding_state")
      .update({
        phase: state.phase,
        completed_steps: state.completed_steps,
        skipped_steps: state.skipped_steps,
        gathered_context: state.gathered_context,
        suggested_workflows: state.suggested_workflows,
        agent_name: state.agent_name,
        user_display_name: state.user_display_name,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to update onboarding state:", updateError);
      return errorResponse("Failed to update onboarding state", 500);
    }

    return jsonResponse({
      success: true,
      state: toOnboardingState(updatedState as OnboardingStateRow),
    });
  } catch (err) {
    console.error("Update onboarding error:", err);
    return errorResponse("Invalid request body", 400);
  }
}
