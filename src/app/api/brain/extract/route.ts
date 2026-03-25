/**
 * POST /api/brain/extract — LLM-based fact extraction from raw text.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 10 req/min (LLM call on each request)
 *
 * Used by the MCP import pipeline to extract structured facts from raw
 * MEMORY.md sections before calling /api/brain/import.
 * Cost absorbed by Dopl (meteredBackground — not billed to user).
 *
 * Request body:
 *   { text: string, max_facts?: number }
 *
 * Response:
 *   { facts: [{ content, domain }], tokens_used: { input, output } }
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import { getModelForTask } from '@/lib/ai/model-router';
import type { ExtractRequest, ExtractResponse, ExtractedFact } from '@/lib/brain-api/types';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // --- Auth ---
    const auth = await requireBrainAuth(request);
    if ('error' in auth) return auth.error;
    const userId = auth.user.id;

    // --- Rate limit ---
    const rl = checkRateLimit(userId, 'extract');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Parse & validate input ---
    let body: ExtractRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { text, max_facts: rawMaxFacts } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return errorResponse('text is required and must be a non-empty string', 400);
    }

    if (text.trim().length > 20_000) {
      return errorResponse('text must be 20,000 characters or fewer', 400);
    }

    const maxFacts = Math.min(Math.max(1, rawMaxFacts ?? 20), 50);

    // --- LLM extraction (Haiku — cheap, fast, structured output) ---
    const { meteredBackground } = await import('@/lib/ai/metered-client');

    const response = await meteredBackground(
      {
        model: getModelForTask('extraction'),
        max_tokens: 2048,
        system: `You are a fact extraction engine. Extract discrete, self-contained facts from the provided text.

Rules:
- Each fact must be a complete, standalone statement a person could remember
- Assign a domain from: general, work, personal, preferences, projects, health, relationships, learning, finance, travel
- Focus on durable facts (not transient details like today's date)
- Skip meta-commentary, headings, or organizational text
- Return ONLY valid JSON — no markdown fences, no commentary

Output format (JSON array, max ${maxFacts} items):
[
  { "content": "User prefers concise email subject lines", "domain": "preferences" },
  { "content": "User is building an AR glasses startup called Fenna", "domain": "projects" }
]

If no facts worth extracting, return: []`,
        messages: [
          {
            role: 'user',
            content: `Extract up to ${maxFacts} facts from this text:\n\n${text.trim()}`,
          },
        ],
      },
      { userId, source: 'brain_extract' },
    );

    // --- Parse LLM output ---
    const raw =
      response.content[0]?.type === 'text' ? response.content[0].text.trim() : '[]';

    let facts: ExtractedFact[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        facts = parsed
          .filter(
            (f): f is { content: string; domain: string } =>
              f &&
              typeof f === 'object' &&
              typeof f.content === 'string' &&
              f.content.trim().length > 0,
          )
          .slice(0, maxFacts)
          .map((f) => ({
            content: f.content.trim(),
            domain: typeof f.domain === 'string' ? f.domain.trim() : 'general',
          }));
      }
    } catch (parseErr) {
      console.error('[api/brain/extract] failed to parse LLM response:', raw, parseErr);
      // Return empty facts rather than 500 — extraction is best-effort
    }

    const extractResponse: ExtractResponse = {
      facts,
      tokens_used: {
        input: response.usage.input_tokens,
        output: response.usage.output_tokens,
      },
    };

    const res = jsonResponse(extractResponse);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/extract] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
