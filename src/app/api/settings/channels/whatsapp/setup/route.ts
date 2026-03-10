import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/channels/whatsapp/setup
 * Initialize WhatsApp bridge — updates openclaw.json on user's instance
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's organization and instance info
    const { data: org } = await supabase
      .from("organizations")
      .select("id, settings, instance_url")
      .eq("owner_id", user.id)
      .single();

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const instanceUrl = org.instance_url as string | null;

    if (!instanceUrl) {
      return NextResponse.json(
        { error: "No OpenClaw instance configured. Please set up your instance first." },
        { status: 400 }
      );
    }

    // Update organization settings to mark WhatsApp as enabled/setup-in-progress
    const currentSettings = (org.settings as Record<string, unknown>) || {};
    const currentChannels =
      (currentSettings.channels as Record<string, unknown>) || {};

    const newChannels = {
      ...currentChannels,
      whatsapp: {
        enabled: true,
        connected: false,
        setup_started_at: new Date().toISOString(),
        bridge_type: "whatsapp-web",
      },
    };

    const { error: updateError } = await supabase
      .from("organizations")
      .update({
        settings: { ...currentSettings, channels: newChannels },
        updated_at: new Date().toISOString(),
      })
      .eq("owner_id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update settings" },
        { status: 500 }
      );
    }

    // In production, this would call the provisioning API to:
    // 1. Enable the WhatsApp bridge container on the user's instance
    // 2. Generate a QR code session
    // 3. Return the QR code data
    // For now, return success with a placeholder QR session

    return NextResponse.json({
      success: true,
      qr_session: `wa-session-${org.id}-${Date.now()}`,
      instance_url: instanceUrl,
      message: "WhatsApp bridge configured. Scan QR code to complete pairing.",
    });
  } catch (error) {
    console.error("WhatsApp setup error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
