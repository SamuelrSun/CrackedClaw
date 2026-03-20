/**
 * POST /api/outreach/style/extract
 * Analyze sample messages and save style model to user:communication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { mem0Write } from '@/lib/memory/mem0-client';
import { extractStyleFromSamples } from '@/lib/outreach/extract-style';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json() as { samples?: string[]; context?: string };
    const { samples, context } = body;

    if (!samples || !Array.isArray(samples) || samples.length === 0) {
      return NextResponse.json(
        { error: 'samples is required (array of message strings)' },
        { status: 400 }
      );
    }

    const style = await extractStyleFromSamples(samples, context);

    // Store raw style model blob
    const memoryId = await mem0Write(
      user!.id,
      `style_model:${JSON.stringify(style)}`,
      {
        domain: 'user:communication',
        importance: 0.9,
        source: 'style_extraction',
      }
    );

    // Human-readable summary
    const summaryLines = [
      `Sam's outreach style: ${style.tone} tone, ${style.avg_length} messages, ${style.structure} structure.`,
      style.opener_patterns.length > 0
        ? `He opens with patterns like: ${style.opener_patterns.slice(0, 3).join(', ')}.`
        : null,
      style.avoided_phrases.length > 0
        ? `He avoids: ${style.avoided_phrases.slice(0, 4).join(', ')}.`
        : null,
      `His CTA style: "${style.cta_style}". Personalization depth: ${style.personalization_depth}.`,
      style.signature ? `Signs off: "${style.signature}".` : null,
      `(Extracted from ${style.sample_count} message sample${style.sample_count !== 1 ? 's' : ''})`,
    ]
      .filter(Boolean)
      .join(' ');

    await mem0Write(user!.id, summaryLines, {
      domain: 'user:communication',
      importance: 0.8,
      source: 'style_extraction',
    });

    return NextResponse.json({ style, memory_id: memoryId });
  } catch (err) {
    console.error('[style/extract] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    );
  }
}
