import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/supabase/data";

export const dynamic = 'force-dynamic';

const PROVISIONING_API_URL = process.env.PROVISIONING_API_URL;
const PROVISIONING_API_SECRET = process.env.PROVISIONING_API_SECRET;

/**
 * GET /api/nodes/pending
 *
 * Lists pending node pairing requests for the user's gateway instance.
 *
 * OpenClaw gateways don't expose REST endpoints for node pairing — it's all
 * WebSocket JSON-RPC. This route proxies through the provisioning server on the
 * VPS, which can open a short-lived WS connection to call `node.pair.list`.
 *
 * Falls back to empty list if provisioning server is unavailable or doesn't
 * support this endpoint yet.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await getOrganization(user.id);
    if (!organization?.openclaw_instance_id || !organization?.openclaw_auth_token) {
      return NextResponse.json({ nodes: [] });
    }

    // Proxy through provisioning server which can make WS calls to the gateway
    if (PROVISIONING_API_URL) {
      try {
        const res = await fetch(
          `${PROVISIONING_API_URL}/instances/${organization.openclaw_instance_id}/nodes/pending`,
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

        // Provisioning server returned error — fall through to empty response
        console.warn(
          "Provisioning nodes/pending returned non-OK:",
          res.status,
          await res.text().catch(() => "")
        );
      } catch (err) {
        console.warn("Provisioning nodes/pending call failed:", err);
      }
    }

    // Fallback: return empty list.
    // Auto-approve via companion app handles most cases.
    // If provisioning server doesn't support this endpoint yet, the UI will just
    // show an empty device list (not broken, just no manual approval available).
    return NextResponse.json({ nodes: [] });
  } catch (err) {
    console.error("Error fetching pending nodes:", err);
    return NextResponse.json({ nodes: [] });
  }
}

/**
 * POST /api/nodes/pending
 *
 * Approve or reject a pending node pairing request.
 * Proxies through the provisioning server which calls `node.pair.approve`
 * or `node.pair.reject` via WebSocket on the gateway.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await getOrganization(user.id);
    if (!organization?.openclaw_instance_id || !organization?.openclaw_auth_token) {
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

    // Proxy the approve/reject through the provisioning server
    const res = await fetch(
      `${PROVISIONING_API_URL}/instances/${organization.openclaw_instance_id}/nodes/${action}`,
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
