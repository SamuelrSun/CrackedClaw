import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const COMPANION_BROWSER_BASE = "https://browser.crackedclaw.com";

export async function GET(_request: NextRequest) {
  const { error } = await requireApiAuth();
  if (error) return error;

  // Shared browser endpoint on the DO server
  const novncUrl = `${COMPANION_BROWSER_BASE}/vnc_lite.html?autoconnect=true&resize=scale&path=websockify&view_only=false`;
  const wsUrl = `wss://browser.crackedclaw.com/websockify`;

  // Check if companion browser is reachable
  let connected = false;
  try {
    const secret = process.env.DO_SERVER_SECRET;
    const pingRes = await fetch(`https://companion.crackedclaw.com/api/browser/status`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    connected = pingRes.ok;
  } catch { /* assume disconnected */ }

  return NextResponse.json(
    { novncUrl, wsUrl, connected },
    { headers: { "Cache-Control": "no-cache, no-store, must-revalidate" } }
  );
}
