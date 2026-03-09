import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { getOrganization } from "@/lib/supabase/data";
import { listSubagents } from "@/lib/gateway/subagent-client";

export const dynamic = 'force-dynamic';

// GET /api/gateway/subagents - List active subagents for the user's gateway
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const activeOrgId = searchParams.get("org_id") || request.headers.get("x-org-id");

    let gatewayUrl: string | null = null;
    let gatewayToken: string | null = null;

    if (activeOrgId) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data: org } = await supabase
        .from("organizations")
        .select("openclaw_gateway_url, openclaw_auth_token")
        .eq("id", activeOrgId)
        .eq("owner_id", user.id)
        .single();
      gatewayUrl = org?.openclaw_gateway_url ?? null;
      gatewayToken = org?.openclaw_auth_token ?? null;
    } else {
      const org = await getOrganization(user.id);
      gatewayUrl = org?.openclaw_gateway_url ?? null;
      gatewayToken = org?.openclaw_auth_token ?? null;
    }

    if (!gatewayUrl || !gatewayToken) {
      return jsonResponse({ subagents: [], connected: false });
    }

    const subagents = await listSubagents(gatewayUrl, gatewayToken);
    return jsonResponse({ subagents, connected: true });
  } catch (err) {
    console.error("Failed to list subagents:", err);
    return jsonResponse({ subagents: [], connected: false, error: String(err) }, 500);
  }
}
