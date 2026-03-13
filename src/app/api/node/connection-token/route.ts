import { requireApiAuth, jsonResponse } from "@/lib/api-auth";
import { getUserProfile } from "@/lib/supabase/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error || !user) return jsonResponse({ error: "Unauthorized" }, 401);

  const profile = await getUserProfile(user.id);
  if (!profile?.instance_id) {
    return jsonResponse({ error: "No instance configured" }, 400);
  }

  // Include operator_device_token from instance_settings so Companion can approve node pairings
  const operatorToken = profile.instance_settings?.operator_device_token as string | undefined;

  const payload = {
    gatewayUrl: profile.gateway_url,
    instanceId: profile.instance_id,
    authToken: profile.auth_token,
    webAppUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://usedopl.com',
    ...(operatorToken ? { operatorToken } : {}),
  };

  const token = Buffer.from(JSON.stringify(payload)).toString("base64");
  return jsonResponse({ token, gatewayUrl: profile.gateway_url, instanceId: profile.instance_id });
}
