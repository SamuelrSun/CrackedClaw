import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
