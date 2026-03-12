import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

const DEFAULT_CHANNELS = {
  slack: { enabled: false, connected: false },
  discord: { enabled: false, connected: false },
  telegram: { enabled: false, connected: false },
  whatsapp: { enabled: false, connected: false },
};

/**
 * GET /api/settings/channels
 * Get channel connection statuses from profile instance_settings
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
    const channels = (settings.channels as typeof DEFAULT_CHANNELS) || DEFAULT_CHANNELS;

    return NextResponse.json({ channels });
  } catch (error) {
    console.error("Get channels error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * PUT /api/settings/channels
 * Update a channel configuration in profile instance_settings
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { channel, token, enabled } = body;

    if (!channel) {
      return NextResponse.json({ error: "Channel is required" }, { status: 400 });
    }

    const validChannels = ["slack", "discord", "telegram", "whatsapp"];
    if (!validChannels.includes(channel)) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
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
    const currentChannels = (currentSettings.channels as Record<string, unknown>) || {};

    const newChannels = {
      ...currentChannels,
      [channel]: {
        enabled: enabled ?? true,
        connected: enabled ?? true,
        ...(token && { token }),
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
      return NextResponse.json({
        error: updateError.message || "Failed to update channel",
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, channel, connected: enabled ?? true });
  } catch (error) {
    console.error("Update channel error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * DELETE /api/settings/channels
 * Disconnect a channel
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const channel = searchParams.get("channel");

    if (!channel) {
      return NextResponse.json({ error: "Channel is required" }, { status: 400 });
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
    const currentChannels = (currentSettings.channels as Record<string, unknown>) || {};

    const newChannels = {
      ...currentChannels,
      [channel]: { enabled: false, connected: false },
    };

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        instance_settings: { ...currentSettings, channels: newChannels },
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      return NextResponse.json({
        error: updateError.message || "Failed to disconnect channel",
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, channel, connected: false });
  } catch (error) {
    console.error("Disconnect channel error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
