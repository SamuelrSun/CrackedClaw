import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireApiAuth } from "@/lib/api-auth";

export const dynamic = 'force-dynamic';

// GET /api/conversations/[id]/context
// Returns context summary + linked conversations
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  // Verify ownership
  const { data: convo } = await supabase
    .from("conversations")
    .select("id, title, user_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Get linked conversations (both directions)
  const { data: links } = await supabase
    .from("conversation_links")
    .select(`
      id,
      link_type,
      source_conversation_id,
      target_conversation_id,
      created_at
    `)
    .or(`source_conversation_id.eq.${id},target_conversation_id.eq.${id}`);

  // Collect all linked conversation IDs
  const linkedIds = (links || []).map((l) =>
    l.source_conversation_id === id ? l.target_conversation_id : l.source_conversation_id
  );

  let linkedConversations: Array<{
    id: string;
    title: string;
    link_type: string;
    link_id: string;
    summary?: string;
    last_message_at?: string;
  }> = [];

  if (linkedIds.length > 0) {
    const { data: linkedConvos } = await supabase
      .from("conversations")
      .select("id, title, updated_at")
      .in("id", linkedIds)
      .eq("user_id", user.id);

    // For each linked convo, get a brief summary (last 5 messages)
    linkedConversations = await Promise.all(
      (linkedConvos || []).map(async (lc) => {
        const link = (links || []).find(
          (l) => l.source_conversation_id === lc.id || l.target_conversation_id === lc.id
        );

        const { data: msgs } = await supabase
          .from("messages")
          .select("role, content")
          .eq("conversation_id", lc.id)
          .order("created_at", { ascending: false })
          .limit(6);

        const reversed = (msgs || []).reverse();
        const summary = reversed
          .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 120)}${m.content.length > 120 ? "..." : ""}`)
          .join("\n");

        return {
          id: lc.id,
          title: lc.title || "Untitled",
          link_type: link?.link_type || "context",
          link_id: link?.id || "",
          summary,
          last_message_at: lc.updated_at,
        };
      })
    );
  }

  // Also get summary of THIS conversation (last 5 messages)
  const { data: myMsgs } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(10);

  const mySummary = (myMsgs || [])
    .reverse()
    .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 200)}${m.content.length > 200 ? "..." : ""}`)
    .join("\n");

  return NextResponse.json({
    conversation_id: id,
    title: convo.title,
    summary: mySummary,
    linked_conversations: linkedConversations,
  });
}

// POST /api/conversations/[id]/context
// Body: { target_id: string, link_type?: string }
// Links target conversation to this one
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const { target_id, link_type = "context" } = body;

  if (!target_id) {
    return NextResponse.json({ error: "target_id is required" }, { status: 400 });
  }

  if (target_id === id) {
    return NextResponse.json({ error: "Cannot link a conversation to itself" }, { status: 400 });
  }

  // Verify both conversations belong to user
  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .in("id", [id, target_id])
    .eq("user_id", user.id);

  if (!convos || convos.length < 2) {
    return NextResponse.json({ error: "One or both conversations not found" }, { status: 404 });
  }

  // Create link (upsert to handle duplicates)
  const { data: link, error: linkError } = await supabase
    .from("conversation_links")
    .upsert(
      {
        source_conversation_id: id,
        target_conversation_id: target_id,
        link_type,
      },
      { onConflict: "source_conversation_id,target_conversation_id" }
    )
    .select()
    .single();

  if (linkError) {
    console.error("Failed to create link:", linkError);
    return NextResponse.json({ error: "Failed to create link" }, { status: 500 });
  }

  return NextResponse.json({ link });
}

// DELETE /api/conversations/[id]/context
// Body: { target_id: string } OR { link_id: string }
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;
  const supabase = await createClient();

  const body = await request.json();
  const { target_id, link_id } = body;

  // Verify conversation ownership
  const { data: convo } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!convo) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  if (link_id) {
    await supabase.from("conversation_links").delete().eq("id", link_id);
  } else if (target_id) {
    await supabase
      .from("conversation_links")
      .delete()
      .or(
        `and(source_conversation_id.eq.${id},target_conversation_id.eq.${target_id}),and(source_conversation_id.eq.${target_id},target_conversation_id.eq.${id})`
      );
  } else {
    return NextResponse.json({ error: "target_id or link_id required" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
