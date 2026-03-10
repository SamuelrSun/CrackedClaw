import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { runDeepAnalysis } from '@/lib/engine/engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 5 minutes

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const provider = body.provider || 'google';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Use SSE for progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const result = await runDeepAnalysis(user!.id, provider, apiKey, (event) => {
          controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n'));
        });
        controller.enqueue(encoder.encode('data: ' + JSON.stringify({
          phase: 'complete',
          progress: 100,
          message: result.summary,
          result: {
            totalMemories: result.totalMemoriesCreated,
            totalEntities: result.totalEntities,
            durationMs: result.durationMs,
            accountEmail: result.accountEmail,
          },
        }) + '\n\n'));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify({ phase: 'error', progress: 0, message: String(err) }) + '\n\n'));
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
