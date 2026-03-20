/**
 * Communication style API.
 * POST /api/outreach/style/extract — analyze sample messages, save style model
 * POST /api/outreach/style/draft   — draft a message for a specific lead using style model
 * GET  /api/outreach/style         — return current style model summary
 *
 * Note: sub-paths (extract/draft) are handled via the `action` query param or
 * matched by routing. This single route.ts handles GET + POST with action dispatch.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { mem0Write, mem0GetAll } from '@/lib/memory/mem0-client';
import {
  extractStyleFromSamples,
  draftWithStyle,
  loadStyleModel,
  buildFallbackStyle,
  type StyleModel,
} from '@/lib/outreach/extract-style';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ── GET /api/outreach/style ───────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const style = await loadStyleModel(user!.id);

    if (!style) {
      return NextResponse.json({
        has_style_model: false,
        style: null,
        sample_count: 0,
      });
    }

    return NextResponse.json({
      has_style_model: true,
      style,
      sample_count: style.sample_count,
    });
  } catch (err) {
    console.error('[style] GET error:', err);
    return NextResponse.json(
      { error: 'Failed to load style model' },
      { status: 500 }
    );
  }
}

// ── POST /api/outreach/style ──────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const url = new URL(request.url);
  // Support both ?action=extract and path-based routing
  const pathSegments = url.pathname.split('/').filter(Boolean);
  const lastSegment = pathSegments[pathSegments.length - 1];
  const action = url.searchParams.get('action') ?? lastSegment;

  try {
    const body = await request.json();

    if (action === 'extract') {
      return handleExtract(user!.id, body);
    } else if (action === 'draft') {
      return handleDraft(user!.id, body);
    } else {
      // Default: check body for discriminant
      if ('samples' in body) return handleExtract(user!.id, body);
      if ('lead' in body) return handleDraft(user!.id, body);
      return NextResponse.json(
        { error: 'Unknown action. Use ?action=extract or ?action=draft' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('[style] POST error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Request failed' },
      { status: 500 }
    );
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleExtract(
  userId: string,
  body: { samples?: string[]; context?: string }
): Promise<NextResponse> {
  const { samples, context } = body;

  if (!samples || !Array.isArray(samples) || samples.length === 0) {
    return NextResponse.json(
      { error: 'samples is required (array of message strings)' },
      { status: 400 }
    );
  }

  // Extract style model
  const style = await extractStyleFromSamples(samples, context);

  // Store the raw style model as a single memory entry (prefixed for easy retrieval)
  const memoryId = await mem0Write(
    userId,
    `style_model:${JSON.stringify(style)}`,
    {
      domain: 'user:communication',
      importance: 0.9,
      source: 'style_extraction',
    }
  );

  // Also store human-readable summary
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

  await mem0Write(userId, summaryLines, {
    domain: 'user:communication',
    importance: 0.8,
    source: 'style_extraction',
  });

  return NextResponse.json({ style, memory_id: memoryId });
}

async function handleDraft(
  userId: string,
  body: {
    lead?: {
      name: string;
      title: string;
      company: string;
      profile_data: Record<string, string>;
    };
    purpose?: string;
    campaign_id?: string;
  }
): Promise<NextResponse> {
  const { lead, purpose, campaign_id } = body;

  if (!lead || !lead.name) {
    return NextResponse.json(
      { error: 'lead.name is required' },
      { status: 400 }
    );
  }

  // Load style model, fall back to generic
  let style: StyleModel;
  const stored = await loadStyleModel(userId);
  if (stored) {
    style = stored;
  } else {
    style = buildFallbackStyle();
  }

  // Load campaign context if provided
  let campaignContext: string | undefined;
  if (campaign_id) {
    try {
      const supabase = await createClient();
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('name, notes')
        .eq('id', campaign_id)
        .eq('user_id', userId)
        .single();
      if (campaign) {
        campaignContext = [campaign.name, campaign.notes].filter(Boolean).join(' — ');
      }
    } catch {
      // ignore — campaign context is optional
    }
  }

  const purposeStr = purpose ?? 'introduce and connect';
  const draft = await draftWithStyle(style, lead, purposeStr, campaignContext);

  return NextResponse.json(draft);
}
