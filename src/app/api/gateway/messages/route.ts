import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getOrganization } from "@/lib/supabase/data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) return errorResponse("conversation_id required", 400);

  try {
    const org = await getOrganization(user.id);
    if (!org?.openclaw_gateway_url || !org?.openclaw_auth_token) {
      return jsonResponse({ messages: [] });
    }

    const res = await fetch(
      `${org.openclaw_gateway_url}/api/messages?conversation_id=${conversationId}&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${org.openclaw_auth_token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) return jsonResponse({ messages: [] });

    const data = await res.json();
    return jsonResponse({ messages: data.messages || data || [] });
  } catch {
    return jsonResponse({ messages: [] });
  }
}
