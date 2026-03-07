import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";

/**
 * GET /api/conversations/[id]/messages
 * Get all messages for a conversation
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const supabase = await createClient();

    // Verify the conversation belongs to the user
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (convError || !conversation) {
      return errorResponse("Conversation not found", 404);
    }

    // Fetch messages
    const { data: messages, error: msgError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Failed to fetch messages:", msgError);
      return errorResponse("Failed to fetch messages", 500);
    }

    // Transform to frontend format
    const formattedMessages = (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));

    return jsonResponse({ messages: formattedMessages });
  } catch (err) {
    console.error("Get messages error:", err);
    return errorResponse("Internal server error", 500);
  }
}
