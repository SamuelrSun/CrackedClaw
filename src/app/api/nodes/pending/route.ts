import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrganization } from "@/lib/supabase/data";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await getOrganization(user.id);
    if (!organization?.openclaw_gateway_url || !organization?.openclaw_auth_token) {
      return NextResponse.json({ nodes: [] });
    }

    // Fetch pending nodes from the gateway
    const res = await fetch(`${organization.openclaw_gateway_url}/api/nodes/pending`, {
      headers: {
        "Authorization": `Bearer ${organization.openclaw_auth_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("Failed to fetch pending nodes:", await res.text());
      return NextResponse.json({ nodes: [] });
    }

    const data = await res.json();
    
    // Transform to expected format
    const nodes = (data.pending || []).map((node: {
      requestId: string;
      displayName?: string;
      deviceType?: string;
      requestedAt?: string;
    }) => ({
      id: node.requestId,
      name: node.displayName || "Unknown Device",
      deviceType: node.deviceType || "Mac",
      requestedAt: node.requestedAt || new Date().toISOString(),
    }));

    return NextResponse.json({ nodes });
  } catch (err) {
    console.error("Error fetching pending nodes:", err);
    return NextResponse.json({ nodes: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await getOrganization(user.id);
    if (!organization?.openclaw_gateway_url || !organization?.openclaw_auth_token) {
      return NextResponse.json({ error: "No gateway configured" }, { status: 400 });
    }

    const { nodeId, action } = await request.json();

    if (!nodeId || !action || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // Send action to gateway
    const res = await fetch(`${organization.openclaw_gateway_url}/api/nodes/${action}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${organization.openclaw_auth_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId: nodeId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`Failed to ${action} node:`, errorText);
      return NextResponse.json({ error: `Failed to ${action} node` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Error processing node action:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
