import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * POST /api/conversations
 * Create a new conversation immediately (before any messages are sent).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = body.title || "New conversation";

    const { data: newConvo, error } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title,
      })
      .select()
      .single();

    if (error || !newConvo) {
      console.error("Failed to create conversation:", error);
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    }

    return NextResponse.json({
      conversation: {
        id: newConvo.id,
        title: newConvo.title,
        lastMessage: "",
        timestamp: newConvo.updated_at || newConvo.created_at || new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Create conversation error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ conversations: [] });
    }

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)  // explicit filter — don't rely solely on RLS
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch conversations:', error);
      return NextResponse.json({ conversations: [] });
    }

    const conversations = (data || []).map((c) => ({
      id: c.id,
      title: c.title,
      lastMessage: c.last_message || '',
      timestamp: c.updated_at || 'Unknown',
    }));

    return NextResponse.json({ conversations });
  } catch (err) {
    console.error('Conversations API error:', err);
    return NextResponse.json({ conversations: [] });
  }
}
