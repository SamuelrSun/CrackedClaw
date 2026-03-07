import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInstanceConfig, updateInstanceConfig } from "@/lib/provisioning-client";

/**
 * GET /api/settings/ai
 * Get current AI settings for the user's instance
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

    if (!org?.openclaw_instance_id) {
      return NextResponse.json({
        model: "claude-sonnet-4",
        using_default_key: true,
        has_custom_key: false,
      });
    }

    // Get config from provisioning API
    const configResult = await getInstanceConfig(org.openclaw_instance_id);

    if (!configResult.success) {
      // Return defaults on error
      return NextResponse.json({
        model: "claude-sonnet-4",
        using_default_key: true,
        has_custom_key: false,
      });
    }

    return NextResponse.json({
      model: configResult.config?.model || "claude-sonnet-4",
      using_default_key: configResult.config?.using_default_key ?? true,
      has_custom_key: !configResult.config?.using_default_key,
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
 * Update AI settings for the user's instance
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

    // Get user's organization
    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    if (!org?.openclaw_instance_id) {
      return NextResponse.json({
        error: "No instance provisioned",
      }, { status: 400 });
    }

    // Build config update
    const configUpdate: Record<string, unknown> = {};
    
    if (model) {
      configUpdate.model = model;
    }
    
    if (use_default_key) {
      // Clear custom key, use default
      configUpdate.ai_api_key = null;
    } else if (ai_api_key) {
      // Set custom key
      configUpdate.ai_api_key = ai_api_key;
    }

    // Update via provisioning API
    const updateResult = await updateInstanceConfig(org.openclaw_instance_id, configUpdate);

    if (!updateResult.success) {
      return NextResponse.json({
        error: updateResult.error || "Failed to update settings",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      model: updateResult.config?.model || model,
      using_default_key: updateResult.config?.using_default_key ?? use_default_key,
    });
  } catch (error) {
    console.error("Update AI settings error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
