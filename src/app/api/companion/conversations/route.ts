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
 * GET /api/companion/conversations
 * List conversations for the authenticated companion user.
 */
export async function GET(request: NextRequest) {
  const { userId, error } = await authenticateCompanion(request);
  if (error) return error;

  const { data, error: queryError } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("user_id", userId!)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (queryError) {
    console.error("companion/conversations GET error:", queryError);
    return NextResponse.json({ error: "Failed to fetch conversations" }, { status: 500 });
  }

  return NextResponse.json({ conversations: data || [] });
}

/**
 * POST /api/companion/conversations
 * Create a new conversation for the authenticated companion user.
 * Body: { title: string }
 */
export async function POST(request: NextRequest) {
  const { userId, error } = await authenticateCompanion(request);
  if (error) return error;

  let body: { title?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine — use default title
  }

  const title = body.title?.trim() || "New conversation";
  const now = new Date().toISOString();

  const { data, error: insertError } = await supabaseAdmin
    .from("conversations")
    .insert({ user_id: userId!, title, created_at: now, updated_at: now })
    .select("id, title, created_at")
    .single();

  if (insertError || !data) {
    console.error("companion/conversations POST error:", insertError);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, title: data.title, created_at: data.created_at }, { status: 201 });
}
