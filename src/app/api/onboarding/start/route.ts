import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createInitialState } from "@/lib/onboarding/state-machine";
import { toOnboardingState } from "@/types/onboarding";
import type { OnboardingStateRow } from "@/types/onboarding";

/**
 * POST /api/onboarding/start
 * Initialize onboarding for a new user or return existing state
 */
export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Check if user already has onboarding state
    const { data: existingState } = await supabase
      .from("onboarding_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (existingState) {
      // Return existing state
      return jsonResponse({
        success: true,
        state: toOnboardingState(existingState as OnboardingStateRow),
        isNew: false,
      });
    }

    // Create new onboarding state
    const initialState = createInitialState(user.id);

    const { data: newState, error: insertError } = await supabase
      .from("onboarding_state")
      .insert({
        user_id: user.id,
        phase: initialState.phase,
        completed_steps: initialState.completed_steps,
        skipped_steps: initialState.skipped_steps,
        gathered_context: initialState.gathered_context,
        suggested_workflows: initialState.suggested_workflows,
        agent_name: initialState.agent_name,
        user_display_name: initialState.user_display_name,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create onboarding state:", insertError);
      return errorResponse("Failed to initialize onboarding", 500);
    }

    return jsonResponse({
      success: true,
      state: toOnboardingState(newState as OnboardingStateRow),
      isNew: true,
    }, 201);
  } catch (err) {
    console.error("Start onboarding error:", err);
    return errorResponse("Internal server error", 500);
  }
}
