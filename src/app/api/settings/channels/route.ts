import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInstanceConfig, updateInstanceConfig } from "@/lib/provisioning-client";

/**
 * GET /api/settings/channels
 * Get channel connection statuses
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
      // Return defaults - all disconnected
      return NextResponse.json({
        channels: {
          slack: { enabled: false, connected: false },
          discord: { enabled: false, connected: false },
          telegram: { enabled: false, connected: false },
          whatsapp: { enabled: false, connected: false },
        },
      });
    }

    // Get config from provisioning API
    const configResult = await getInstanceConfig(org.openclaw_instance_id);

    if (!configResult.success) {
      return NextResponse.json({
        channels: {
          slack: { enabled: false, connected: false },
          discord: { enabled: false, connected: false },
          telegram: { enabled: false, connected: false },
          whatsapp: { enabled: false, connected: false },
        },
      });
    }

    return NextResponse.json({
      channels: configResult.config?.channels || {
        slack: { enabled: false, connected: false },
        discord: { enabled: false, connected: false },
        telegram: { enabled: false, connected: false },
        whatsapp: { enabled: false, connected: false },
      },
    });
  } catch (error) {
    console.error("Get channels error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}

/**
 * PUT /api/settings/channels
 * Update a channel configuration
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
      return NextResponse.json({
        error: "Channel is required",
      }, { status: 400 });
    }

    const validChannels = ["slack", "discord", "telegram", "whatsapp"];
    if (!validChannels.includes(channel)) {
      return NextResponse.json({
        error: "Invalid channel",
      }, { status: 400 });
    }

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

    // Build channels config update
    const channelsUpdate: Record<string, { enabled: boolean; token?: string }> = {
      [channel]: {
        enabled: enabled ?? true,
        ...(token && { token }),
      },
    };

    // Update via provisioning API
    const updateResult = await updateInstanceConfig(org.openclaw_instance_id, {
      channels: channelsUpdate,
    });

    if (!updateResult.success) {
      return NextResponse.json({
        error: updateResult.error || "Failed to update channel",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      channel,
      connected: enabled ?? true,
    });
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
      return NextResponse.json({
        error: "Channel is required",
      }, { status: 400 });
    }

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

    // Disable channel via provisioning API
    const updateResult = await updateInstanceConfig(org.openclaw_instance_id, {
      channels: {
        [channel]: { enabled: false },
      },
    });

    if (!updateResult.success) {
      return NextResponse.json({
        error: updateResult.error || "Failed to disconnect channel",
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      channel,
      connected: false,
    });
  } catch (error) {
    console.error("Disconnect channel error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Internal server error",
    }, { status: 500 });
  }
}
