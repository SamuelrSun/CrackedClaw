import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

const DEFAULT_CHANNELS = {
  whatsapp: { enabled: false, connected: false },
  imessage: { enabled: false, connected: false },
  discord: { enabled: false, connected: false },
  telegram: { enabled: false, connected: false },
  signal: { enabled: false, connected: false },
  slack: { enabled: false, connected: false },
};

/**
 * GET /api/settings/channels/status
 * Returns configured channels and their connection status
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
      .select("instance_settings, gateway_url")
      .eq("id", user.id)
      .single();

    const settings = (profile?.instance_settings as Record<string, unknown>) || {};
    const rawChannels =
      (settings.channels as Record<string, { enabled: boolean; connected: boolean }>) || {};

    // Merge with defaults so all channels are represented
    const channels = { ...DEFAULT_CHANNELS };
    for (const [key, value] of Object.entries(rawChannels)) {
      if (key in channels) {
        channels[key as keyof typeof channels] = {
          enabled: value?.enabled ?? false,
          connected: value?.connected ?? false,
        };
      }
    }

    const connectedCount = Object.values(channels).filter((c) => c.connected).length;
    const hasInstance = !!profile?.gateway_url;

    return NextResponse.json({
      channels,
      summary: {
        total: Object.keys(channels).length,
        connected: connectedCount,
        has_instance: hasInstance,
      },
    });
  } catch (error) {
    console.error("Get channel status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
