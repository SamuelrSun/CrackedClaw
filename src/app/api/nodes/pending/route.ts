import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/supabase/data";

export const dynamic = 'force-dynamic';

const PROVISIONING_API_URL = process.env.PROVISIONING_API_URL;
const PROVISIONING_API_SECRET = process.env.PROVISIONING_API_SECRET;

/**
 * GET /api/nodes/pending
 *
 * Lists pending node pairing requests for the user's gateway instance.
 * Proxies through the provisioning server which can open a short-lived WS
 * connection to call `node.pair.list`.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!profile?.instance_id || !profile?.auth_token) {
      return NextResponse.json({ nodes: [] });
    }

    // Proxy through provisioning server which can make WS calls to the gateway
    if (PROVISIONING_API_URL) {
      try {
        const res = await fetch(
          `${PROVISIONING_API_URL}/instances/${profile.instance_id}/nodes/pending`,
          {
            headers: {
              "Content-Type": "application/json",
              ...(PROVISIONING_API_SECRET
                ? { Authorization: `Bearer ${PROVISIONING_API_SECRET}` }
                : {}),
            },
            signal: AbortSignal.timeout(10000),
          }
        );

        if (res.ok) {
          const data = await res.json();
          const nodes = (data.pending || []).map(
            (node: {
              requestId: string;
              displayName?: string;
              deviceType?: string;
              platform?: string;
              requestedAt?: string;
            }) => ({
              id: node.requestId,
              name: node.displayName || "Unknown Device",
              deviceType: node.deviceType || node.platform || "Mac",
              requestedAt: node.requestedAt || new Date().toISOString(),
            })
          );
          return NextResponse.json({ nodes });
        }

        console.warn(
          "Provisioning nodes/pending returned non-OK:",
          res.status,
          await res.text().catch(() => "")
        );
      } catch (err) {
        console.warn("Provisioning nodes/pending call failed:", err);
      }
    }

    return NextResponse.json({ nodes: [] });
  } catch (err) {
    console.error("Error fetching pending nodes:", err);
    return NextResponse.json({ nodes: [] });
  }
}

/**
 * POST /api/nodes/pending
 * Approve or reject a pending node pairing request.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await getUserProfile(user.id);
    if (!profile?.instance_id || !profile?.auth_token) {
      return NextResponse.json({ error: "No gateway configured" }, { status: 400 });
    }

    const { nodeId, action } = await request.json();

    if (!nodeId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    if (!PROVISIONING_API_URL) {
      return NextResponse.json(
        { error: "Provisioning server not configured" },
        { status: 503 }
      );
    }

    const res = await fetch(
      `${PROVISIONING_API_URL}/instances/${profile.instance_id}/nodes/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(PROVISIONING_API_SECRET
            ? { Authorization: `Bearer ${PROVISIONING_API_SECRET}` }
            : {}),
        },
        body: JSON.stringify({ requestId: nodeId }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error(`Failed to ${action} node via provisioning:`, errorText);
      return NextResponse.json(
        { error: `Failed to ${action} node` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error processing node action:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
