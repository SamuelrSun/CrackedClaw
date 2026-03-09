import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/gateway/messages?conversation_id=<id> - Read messages from Supabase
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const conversationId = request.nextUrl.searchParams.get("conversation_id");
  if (!conversationId) return errorResponse("conversation_id required", 400);

  try {
    const supabase = await createClient();

    // Verify the conversation belongs to this user
    const { data: convo } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!convo) return errorResponse("Conversation not found", 404);

    const { data: messages, error: dbError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (dbError) {
      console.error("Failed to fetch messages:", dbError);
      return jsonResponse({ messages: [] });
    }

    return jsonResponse({ messages: messages || [] });
  } catch (err) {
    console.error("Failed to fetch messages:", err);
    return jsonResponse({ messages: [] });
  }
}
