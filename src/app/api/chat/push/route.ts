/**
 * POST /api/chat/push
 * Allows subagents to push results directly into a conversation.
 * Results appear in the chat immediately via Supabase Realtime.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { conversation_id, content, push_secret } = body;

    const expectedSecret = process.env.CHAT_PUSH_SECRET || 'crackedclaw-push-2026';
    if (push_secret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!conversation_id || !content) {
      return NextResponse.json({ error: 'conversation_id and content required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        role: 'assistant',
        content: `📋 **Background Task Complete**\n\n${content}`,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Push message insert failed:', error);
      return NextResponse.json({ error: 'Failed to insert message' }, { status: 500 });
    }

    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversation_id);

    return NextResponse.json({ success: true, message_id: data.id });
  } catch (err) {
    console.error('Push endpoint error:', err);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
