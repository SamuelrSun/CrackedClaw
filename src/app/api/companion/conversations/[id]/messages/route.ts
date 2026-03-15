import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authenticateCompanion } from "@/lib/companion-auth";

export const dynamic = "force-dynamic";

// Service-role client for all companion operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/companion/conversations/[id]/messages
 * Load messages for a conversation (verifies ownership first).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await authenticateCompanion(request);
  if (error) return error;

  const { id } = await params;

  // Verify the conversation belongs to this user
  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId!)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  // Fetch messages ordered chronologically
  const { data: messages, error: msgError } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("companion/messages GET error:", msgError);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }

  return NextResponse.json({ messages: messages || [] });
}

/**
 * POST /api/companion/conversations/[id]/messages
 * Save a message to a conversation (verifies ownership first).
 * Body: { role: string, content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, error } = await authenticateCompanion(request);
  if (error) return error;

  const { id } = await params;

  // Verify the conversation belongs to this user
  const { data: conversation, error: convError } = await supabaseAdmin
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", userId!)
    .single();

  if (convError || !conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  let body: { role?: string; content?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { role, content } = body;
  if (!role || !content) {
    return NextResponse.json({ error: "role and content are required" }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data: message, error: insertError } = await supabaseAdmin
    .from("messages")
    .insert({ conversation_id: id, role, content, created_at: now })
    .select("id, role, content, created_at")
    .single();

  if (insertError || !message) {
    console.error("companion/messages POST error:", insertError);
    return NextResponse.json({ error: "Failed to save message" }, { status: 500 });
  }

  // Bump conversation updated_at
  await supabaseAdmin
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", id);

  return NextResponse.json(
    { id: message.id, role: message.role, content: message.content, created_at: message.created_at },
    { status: 201 }
  );
}
