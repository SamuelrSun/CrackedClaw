import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { getOrganization } from "@/lib/supabase/data";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let gatewayUrl: string | null = null;
  let gatewayToken: string | null = null;

  try {
    const org = await getOrganization(user.id);
    if (org?.openclaw_gateway_url && org?.openclaw_auth_token) {
      gatewayUrl = org.openclaw_gateway_url;
      gatewayToken = org.openclaw_auth_token;
    }
  } catch { /* ignore */ }

  if (!gatewayUrl) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("user_gateways")
        .select("gateway_url, auth_token")
        .eq("user_id", user.id)
        .limit(1);
      if (data && data.length > 0) {
        gatewayUrl = data[0].gateway_url;
        gatewayToken = data[0].auth_token;
      }
    } catch { /* ignore */ }
  }

  if (!gatewayUrl || !gatewayToken) {
    return NextResponse.json({ error: "No gateway configured" }, { status: 503 });
  }

  try {
    // Derive the noVNC URL from the gateway URL.
    // Convention: gateway runs on port 3000, noVNC proxy on port 6080.
    // e.g. https://gateway.crackedclaw.com → https://browser.crackedclaw.com/vnc.html?...
    // For self-hosted DO setups, replace port or use sub-path.
    const gwUrl = new URL(gatewayUrl);

    // Build noVNC URL — assume noVNC is at same host but port 6080 (or /novnc path on gateway)
    // Adjust this logic based on actual deployment topology.
    const novncHost = gwUrl.hostname;
    const novncPort = 6080;
    const wsProtocol = gwUrl.protocol === "https:" ? "wss:" : "ws:";

    const novncUrl =
      `${gwUrl.protocol}//${novncHost}:${novncPort}/vnc.html` +
      `?host=${novncHost}&port=${novncPort}&path=websockify&autoconnect=true&resize=scale`;

    const wsUrl = `${wsProtocol}//${novncHost}:${novncPort}/websockify`;

    // Optionally ask gateway for connectivity confirmation
    let connected = false;
    try {
      const pingRes = await fetch(`${gatewayUrl}/api/browser/status`, {
        headers: { Authorization: `Bearer ${gatewayToken}` },
        signal: AbortSignal.timeout(3000),
      });
      connected = pingRes.ok;
    } catch { /* assume disconnected */ }

    return NextResponse.json(
      { novncUrl, wsUrl, connected },
      {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
