import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/brain
 * Get brain_enabled from the user's profile instance_settings.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("instance_settings")
      .eq("id", user.id)
      .single();

    const settings = (profile?.instance_settings as Record<string, unknown>) || {};

    return NextResponse.json({
      brain_enabled: (settings.brain_enabled as boolean) ?? false,
    });
  } catch (error) {
    console.error("Get brain settings error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * PUT /api/settings/brain
 * Update brain_enabled in the user's profile instance_settings.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brain_enabled } = body;

    if (typeof brain_enabled !== "boolean") {
      return NextResponse.json(
        { error: "brain_enabled must be a boolean" },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("instance_settings")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentSettings = (profile.instance_settings as Record<string, unknown>) || {};
    const newSettings = { ...currentSettings, brain_enabled };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        instance_settings: newSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({
        error: updateError.message || "Failed to update settings",
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, brain_enabled });
  } catch (error) {
    console.error("Update brain settings error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
