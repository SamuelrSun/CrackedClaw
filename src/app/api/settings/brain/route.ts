import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/brain
 * Get AI brain settings (brain_enabled, unified_memory, auto_memory_extract)
 * from the user's profile instance_settings.
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
      brain_enabled: (settings.brain_enabled as boolean) ?? true,
      unified_memory: (settings.unified_memory as boolean) ?? true,
      auto_memory_extract: (settings.auto_memory_extract as boolean) ?? true,
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
 * Update any combination of brain_enabled, unified_memory, auto_memory_extract
 * in the user's profile instance_settings.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { brain_enabled, unified_memory, auto_memory_extract } = body;

    // Validate: at least one key must be provided, and all provided values must be booleans
    const updates: Record<string, boolean> = {};
    if (brain_enabled !== undefined) {
      if (typeof brain_enabled !== "boolean") {
        return NextResponse.json({ error: "brain_enabled must be a boolean" }, { status: 400 });
      }
      updates.brain_enabled = brain_enabled;
    }
    if (unified_memory !== undefined) {
      if (typeof unified_memory !== "boolean") {
        return NextResponse.json({ error: "unified_memory must be a boolean" }, { status: 400 });
      }
      updates.unified_memory = unified_memory;
    }
    if (auto_memory_extract !== undefined) {
      if (typeof auto_memory_extract !== "boolean") {
        return NextResponse.json({ error: "auto_memory_extract must be a boolean" }, { status: 400 });
      }
      updates.auto_memory_extract = auto_memory_extract;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid settings provided" }, { status: 400 });
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
    const newSettings = { ...currentSettings, ...updates };

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

    return NextResponse.json({ success: true, ...updates });
  } catch (error) {
    console.error("Update brain settings error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
