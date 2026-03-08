import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { analyzeForWorkflow } from "@/lib/workflows/extractor";

// POST /api/workflows/suggest - Analyze a conversation for workflow suggestions
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId || typeof conversationId !== "string") {
      return errorResponse("conversationId is required", 400);
    }

    const supabase = await createClient();

    // Verify conversation belongs to user
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();

    if (!conversation) {
      return errorResponse("Conversation not found", 404);
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (!messages || messages.length === 0) {
      return NextResponse.json({
        suggestion: { shouldSuggest: false },
      });
    }

    const suggestion = analyzeForWorkflow(messages);

    return NextResponse.json({ suggestion });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
