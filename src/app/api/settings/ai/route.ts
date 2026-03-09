import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/ai
 * Get current AI settings for the user's organization
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    const settings = (org?.settings as Record<string, unknown>) || {};

    return NextResponse.json({
      model: (settings.model as string) || "claude-sonnet-4",
      using_default_key: (settings.using_default_key as boolean) ?? true,
      has_custom_key: !((settings.using_default_key as boolean) ?? true),
    });
  } catch (error) {
    console.error("Get AI settings error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * PUT /api/settings/ai
 * Update AI settings for the user's organization
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { model, ai_api_key, use_default_key } = body;

    // Validate: custom key mode requires a key
    if (use_default_key === false && !ai_api_key) {
      return NextResponse.json(
        { error: "API key is required when not using the default key" },
        { status: 400 }
      );
    }

    // Get user's organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const currentSettings = (org.settings as Record<string, unknown>) || {};

    // Build settings update
    const newSettings: Record<string, unknown> = { ...currentSettings };

    if (model) {
      newSettings.model = model;
    }

    if (use_default_key === true) {
      newSettings.using_default_key = true;
      delete newSettings.ai_api_key;
    } else if (use_default_key === false && ai_api_key) {
      newSettings.using_default_key = false;
      newSettings.ai_api_key = ai_api_key;
    }

    // Save to Supabase
    const { error: updateError } = await supabase
      .from("organizations")
      .update({ settings: newSettings, updated_at: new Date().toISOString() })
      .eq("id", org.id);

    if (updateError) {
      return NextResponse.json({
        error: updateError.message || "Failed to update settings",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      model: (newSettings.model as string) || model,
      using_default_key: (newSettings.using_default_key as boolean) ?? true,
    });
  } catch (error) {
    console.error("Update AI settings error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
