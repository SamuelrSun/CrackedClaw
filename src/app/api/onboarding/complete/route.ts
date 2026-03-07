import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { toOnboardingState, type OnboardingStateRow } from "@/types/onboarding";
import { completeOnboarding } from "@/lib/onboarding/state-machine";

/**
 * POST /api/onboarding/complete
 * Mark onboarding as complete
 */
export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    // Get current onboarding state if exists
    const { data: currentStateRow } = await supabase
      .from("onboarding_state")
      .select("*")
      .eq("user_id", user.id)
      .single();

    // Update onboarding state if it exists
    if (currentStateRow) {
      const state = toOnboardingState(currentStateRow as OnboardingStateRow);
      const completedState = completeOnboarding(state);

      await supabase
        .from("onboarding_state")
        .update({
          phase: completedState.phase,
          updated_at: now,
        })
        .eq("user_id", user.id);
    }

    // Update the user's profile to mark onboarding as complete
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        onboarding_completed: true,
        onboarding_completed_at: now,
        updated_at: now,
      }, {
        onConflict: "id",
      });

    if (profileError) {
      console.error("Failed to mark onboarding complete:", profileError);
      // Don't fail - localStorage fallback will work
    }

    return jsonResponse({ 
      success: true,
      completed_at: now,
    });
  } catch (err) {
    console.error("Onboarding complete error:", err);
    // Don't fail completely - localStorage fallback will work
    return jsonResponse({ success: true });
  }
}

/**
 * GET /api/onboarding/complete
 * Check if onboarding is complete
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return jsonResponse({ completed: false });
    }

    // Check profile first (backward compatible)
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed) {
      return jsonResponse({ completed: true });
    }

    // Also check onboarding_state table
    const { data: state } = await supabase
      .from("onboarding_state")
      .select("phase")
      .eq("user_id", user.id)
      .single();

    if (state?.phase === "complete") {
      return jsonResponse({ completed: true });
    }

    return jsonResponse({ completed: false });
  } catch {
    return jsonResponse({ completed: false });
  }
}
