import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { toOnboardingState, type OnboardingStateRow } from "@/types/onboarding";

/**
 * GET /api/onboarding/state
 * Get current onboarding state for the authenticated user
 */
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();

    const { data: state, error: fetchError } = await supabase
      .from("onboarding_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        // No state found - user hasn't started onboarding
        return jsonResponse({
          state: null,
          message: "Onboarding not started",
        });
      }
      console.error("Failed to fetch onboarding state:", fetchError);
      return errorResponse("Failed to fetch onboarding state", 500);
    }

    return jsonResponse({
      state: toOnboardingState(state as OnboardingStateRow),
    });
  } catch (err) {
    console.error("Get onboarding state error:", err);
    return errorResponse("Internal server error", 500);
  }
}
