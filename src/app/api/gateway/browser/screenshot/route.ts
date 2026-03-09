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

  // Try org first
  try {
    const org = await getOrganization(user.id);
    if (org?.openclaw_gateway_url && org?.openclaw_auth_token) {
      gatewayUrl = org.openclaw_gateway_url;
      gatewayToken = org.openclaw_auth_token;
    }
  } catch { /* ignore */ }

  // Fall back to user_gateways
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
    const res = await fetch(`${gatewayUrl}/api/browser/screenshot`, {
      headers: { Authorization: `Bearer ${gatewayToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Gateway screenshot failed" }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
