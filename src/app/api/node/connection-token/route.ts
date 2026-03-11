import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { getOrganization } from "@/lib/supabase/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const org = await getOrganization(user.id);
  if (!org?.openclaw_instance_id) {
    return jsonResponse({ error: "No instance configured" }, 400);
  }

  // Include operator_device_token from settings so Companion can approve node pairings
  const settings = (org as Record<string, unknown>).settings as Record<string, unknown> | null;
  const operatorToken = settings?.operator_device_token as string | undefined;

  const payload = {
    gatewayUrl: org.openclaw_gateway_url,
    instanceId: org.openclaw_instance_id,
    authToken: org.openclaw_auth_token,
    ...(operatorToken ? { operatorToken } : {}),
  };

  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
  return jsonResponse({ token, gatewayUrl: org.openclaw_gateway_url, instanceId: org.openclaw_instance_id });
}
