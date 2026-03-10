import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { runScan } from '@/lib/engine/v2';
import type { ScanProgressCallback } from '@/lib/engine/v2/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const provider = body.provider; // undefined = scan all connected
  const mode = body.mode === 'deep' ? 'deep' : 'quick';
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const onProgress: ScanProgressCallback = (event) => {
          try {
            controller.enqueue(encoder.encode('data: ' + JSON.stringify(event) + '\n\n'));
          } catch { /* stream closed */ }
        };

        const result = await runScan(user!.id, apiKey, mode as 'quick' | 'deep', onProgress, provider);

        controller.enqueue(encoder.encode('data: ' + JSON.stringify({
          phase: 'complete',
          progress: 100,
          message: 'Scan complete',
          result: {
            scanId: result.scanId,
            totalMemories: result.totalMemories,
            durationMs: result.totalDurationMs,
            integrations: result.integrationResults.map(r => ({
              provider: r.provider,
              memories: r.memoriesCreated,
              error: r.error,
            })),
            workflowSuggestions: result.synthesis?.workflowSuggestions || [],
          },
        }) + '\n\n'));
        controller.close();
      } catch (err) {
        controller.enqueue(encoder.encode('data: ' + JSON.stringify({
          phase: 'error',
          progress: 0,
          message: String(err),
        }) + '\n\n'));
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
