/**
 * POST /api/usage/track
 * Track token usage after a WebSocket chat message completes.
 * Called by the browser after handleWSEvent fires type="done".
 */
import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { incrementUsage } from '@/lib/usage/tracker';

export const dynamic = 'force-dynamic';

// Overhead per turn: system prompt (~1500 tokens) + tool defs (~2000) + history context (~500 avg)
const OVERHEAD_PER_TURN = 4000;

export async function POST(req: Request) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await req.json();
    const { userMessageLength, assistantMessageLength } = body as {
      userMessageLength?: number;
      assistantMessageLength?: number;
    };

    const userTokens = Math.ceil((userMessageLength || 0) / 4);
    const assistantTokens = Math.ceil((assistantMessageLength || 0) / 4);
    const estimatedTokens = userTokens + assistantTokens + OVERHEAD_PER_TURN;

    await incrementUsage(user!.id, estimatedTokens, 0);

    return NextResponse.json({
      tracked: true,
      tokens: estimatedTokens,
      breakdown: { user: userTokens, assistant: assistantTokens, overhead: OVERHEAD_PER_TURN },
    });
  } catch (err) {
    console.error('[usage/track] Error:', err);
    return NextResponse.json({ error: 'Failed to track usage' }, { status: 500 });
  }
}
