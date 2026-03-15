import { NextRequest, NextResponse } from 'next/server';
import { updateMemoryContext } from '@/lib/gateway/workspace';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Server-to-server auth: only accept calls from our own backend
    const pushSecret = process.env.CHAT_PUSH_SECRET || 'dopl-push-2026';
    const body = await request.json();
    const { userId, provider, memoriesCreated, conversationId, secret } = body;

    // Accept if: (1) secret matches push_secret, OR (2) called from same origin (localhost/internal)
    const origin = request.headers.get('origin') || '';
    const isInternal = !origin || origin.includes('localhost') || origin.includes('usedopl.com');
    if (secret !== pushSecret && !isInternal) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    // Update MEMORY_CONTEXT.md on the instance (fire-and-forget)
    updateMemoryContext(userId).catch(err =>
      console.error('[scan/notify] Failed to update MEMORY_CONTEXT.md:', err)
    );

    // Push scan summary to active conversation
    if (conversationId && memoriesCreated > 0) {
      const pushUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://usedopl.com'}/api/chat/push`;
      fetch(pushUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: conversationId,
          content: `[Quick scan complete: ${provider}. Found ${memoriesCreated} key facts — contacts, calendar patterns, work topics. I've stored this context and will use it going forward.]`,
          push_secret: process.env.CHAT_PUSH_SECRET || 'dopl-push-2026',
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[scan/notify] Error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
