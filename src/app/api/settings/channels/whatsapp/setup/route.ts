import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/settings/channels/whatsapp/setup
 * Initialize WhatsApp bridge — updates instance_settings on profile
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's profile with instance info
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, instance_settings, gateway_url")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const instanceUrl = profile.gateway_url as string | null;

    if (!instanceUrl) {
      return NextResponse.json(
        { error: "No OpenClaw instance configured. Please set up your instance first." },
        { status: 400 }
      );
    }

    // Update profile settings to mark WhatsApp as enabled/setup-in-progress
    const currentSettings = (profile.instance_settings as Record<string, unknown>) || {};
    const currentChannels = (currentSettings.channels as Record<string, unknown>) || {};

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
      .from("profiles")
      .update({
        instance_settings: { ...currentSettings, channels: newChannels },
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || "Failed to update settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      qr_session: `wa-session-${user.id}-${Date.now()}`,
      instance_url: instanceUrl,
      message: "WhatsApp bridge configured. Scan QR code to complete pairing.",
    });
  } catch (error) {
    console.error("WhatsApp setup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
