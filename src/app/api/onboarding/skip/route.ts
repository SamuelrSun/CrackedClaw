import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import {
  toOnboardingState,
  type OnboardingStateRow,
  type OnboardingPhase,
  type SkipOnboardingRequest,
  phaseOrder,
} from "@/types/onboarding";
import {
  transitionPhase,
  advancePhase,
  completeOnboarding,
} from "@/lib/onboarding/state-machine";

/**
 * POST /api/onboarding/skip
 * Skip current phase or skip to a specific phase
 */
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body: SkipOnboardingRequest = await request.json().catch(() => ({}));
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Fetch current state
    const { data: currentStateRow, error: fetchError } = await supabase
      .from("onboarding_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError || !currentStateRow) {
      return errorResponse("Onboarding not started", 404);
    }

    let state = toOnboardingState(currentStateRow as OnboardingStateRow);

    // Handle skip_all - immediately complete onboarding
    if (body.skip_all) {
      state = completeOnboarding(state);
    }
    // Handle skip_to - jump to specific phase
    else if (body.skip_to) {
      if (!phaseOrder.includes(body.skip_to as OnboardingPhase)) {
        return errorResponse(`Invalid phase: ${body.skip_to}`, 400);
      }
      const result = transitionPhase(state, body.skip_to as OnboardingPhase);
      if (!result.success) {
        return errorResponse(result.error || "Cannot skip to that phase", 400);
      }
      state = result.newState;
    }
    // Default: advance to next phase
    else {
      const result = advancePhase(state);
      if (!result.success) {
        // If already at end, just complete
        state = completeOnboarding(state);
      } else {
        state = result.newState;
      }
    }

    // Persist to database
    const { data: updatedState, error: updateError } = await supabase
      .from("onboarding_state")
      .update({
        phase: state.phase,
        completed_steps: state.completed_steps,
        skipped_steps: state.skipped_steps,
        updated_at: now,
      })
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to skip onboarding phase:", updateError);
      return errorResponse("Failed to update onboarding state", 500);
    }

    // Also update profile if completing
    if (state.phase === "complete") {
      await supabase
        .from("profiles")
        .upsert({
          id: user.id,
          onboarding_completed: true,
          onboarding_completed_at: now,
          updated_at: now,
        }, {
          onConflict: "id",
        });
    }

    return jsonResponse({
      success: true,
      state: toOnboardingState(updatedState as OnboardingStateRow),
      skipped: true,
    });
  } catch (err) {
    console.error("Skip onboarding error:", err);
    return errorResponse("Internal server error", 500);
  }
}
