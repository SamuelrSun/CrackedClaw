import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getNodeStatus } from "@/lib/node/status";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nodeStatus = await getNodeStatus(user.id);

    const nodes = nodeStatus.nodes.map(node => ({
      id: node.id,
      name: node.name,
      status: node.connected ? "connected" : "disconnected",
      deviceType: "Mac",
      lastSeen: node.lastSeen || new Date().toISOString(),
      capabilities: node.capabilities || [],
    }));

    return NextResponse.json({ nodes });
  } catch (err) {
    console.error("Error fetching node status:", err);
    return NextResponse.json({ nodes: [] });
  }
}
