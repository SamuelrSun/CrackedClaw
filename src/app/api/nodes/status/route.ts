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

    // Fetch node status from the gateway
    const res = await fetch(`${organization.openclaw_gateway_url}/api/nodes/status`, {
      headers: {
        "Authorization": `Bearer ${organization.openclaw_auth_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("Failed to fetch node status:", await res.text());
      return NextResponse.json({ nodes: [] });
    }

    const data = await res.json();
    
    // Transform to expected format
    const nodes = (data.nodes || []).map((node: {
      id: string;
      name?: string;
      displayName?: string;
      status?: string;
      connected?: boolean;
      deviceType?: string;
      lastSeen?: string;
      capabilities?: string[];
    }) => ({
      id: node.id,
      name: node.displayName || node.name || "Unknown Device",
      status: node.connected || node.status === "connected" ? "connected" : "disconnected",
      deviceType: node.deviceType || "Mac",
      lastSeen: node.lastSeen || new Date().toISOString(),
      capabilities: node.capabilities || [],
    }));

    return NextResponse.json({ nodes });
  } catch (err) {
    console.error("Error fetching node status:", err);
    return NextResponse.json({ nodes: [] });
  }
}
