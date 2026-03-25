/**
 * POST /api/brain/import — Bulk import facts with optional deduplication.
 *
 * Auth: Brain API key (dpb_sk_...) or Supabase session
 * Rate limit: 5 req/min (heavy — embeds every fact, dedup queries per fact)
 *
 * Used by the MCP import pipeline after /api/brain/extract has produced
 * structured facts from raw MEMORY.md sections.
 *
 * Request body:
 *   {
 *     facts: [{ content, domain?, source?, source_file? }],
 *     deduplicate?: boolean   // default: true
 *   }
 *
 * Response:
 *   { imported: number, skipped_duplicates: number, total: number }
 *
 * Deduplication: cosine similarity > 0.92 against existing user memories.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireBrainAuth } from '@/lib/brain-api/auth';
import { checkRateLimit } from '@/lib/brain-api/rate-limit';
import { getEmbedding } from '@/lib/brain-api/embeddings';
import { createAdminClient } from '@/lib/supabase/admin';
import { jsonResponse, errorResponse } from '@/lib/api-auth';
import type { ImportRequest, ImportResponse, ImportFact } from '@/lib/brain-api/types';

const DEDUP_THRESHOLD = 0.92;
const MAX_FACTS_PER_REQUEST = 200;

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
    const rl = checkRateLimit(userId, 'import');
    if (!rl.allowed) {
      const res = NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
      res.headers.set('Retry-After', String(rl.retryAfter));
      res.headers.set('Access-Control-Allow-Origin', '*');
      return res;
    }

    // --- Parse & validate input ---
    let body: ImportRequest;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }

    const { facts: rawFacts, deduplicate = true } = body;

    if (!Array.isArray(rawFacts) || rawFacts.length === 0) {
      return errorResponse('facts must be a non-empty array', 400);
    }

    if (rawFacts.length > MAX_FACTS_PER_REQUEST) {
      return errorResponse(
        `Maximum ${MAX_FACTS_PER_REQUEST} facts per request. Split into smaller batches.`,
        400,
      );
    }

    // Validate each fact
    const facts: ImportFact[] = [];
    for (let i = 0; i < rawFacts.length; i++) {
      const f = rawFacts[i];
      if (!f || typeof f !== 'object') {
        return errorResponse(`facts[${i}]: must be an object`, 400);
      }
      if (!f.content || typeof f.content !== 'string' || f.content.trim().length === 0) {
        return errorResponse(`facts[${i}]: content is required and must be a non-empty string`, 400);
      }
      facts.push({
        content: f.content.trim().slice(0, 2000),
        domain: typeof f.domain === 'string' ? f.domain.trim() : undefined,
        source: typeof f.source === 'string' ? f.source.trim() : undefined,
        source_file: typeof f.source_file === 'string' ? f.source_file.trim() : undefined,
      });
    }

    const supabase = createAdminClient();
    let imported = 0;
    let skippedDuplicates = 0;

    // --- Process each fact ---
    for (const fact of facts) {
      // Embed the fact
      const embedding = await getEmbedding(fact.content);

      // --- Deduplication check ---
      if (deduplicate) {
        const { data: dupes } = await supabase.rpc('match_memories', {
          query_embedding: embedding,
          match_user_id: userId,
          match_domain: null,
          match_limit: 1,
          match_threshold: DEDUP_THRESHOLD,
        });

        if (dupes && dupes.length > 0) {
          skippedDuplicates++;
          continue;
        }
      }

      // --- Insert new fact ---
      const { error: insertError } = await supabase.from('memories').insert({
        user_id: userId,
        content: fact.content,
        embedding,
        domain: fact.domain ?? 'general',
        importance: 0.7,
        memory_type: 'brain_fact',
        metadata: {
          source: fact.source ?? auth.keyName ?? 'brain_import',
          source_file: fact.source_file ?? null,
          imported_at: new Date().toISOString(),
        },
      });

      if (insertError) {
        console.error('[api/brain/import] insert error:', insertError);
        // Continue on individual insert failures — don't abort the whole batch
        continue;
      }

      imported++;
    }

    const response: ImportResponse = {
      imported,
      skipped_duplicates: skippedDuplicates,
      total: facts.length,
    };

    const res = jsonResponse(response, 200);
    res.headers.set('Access-Control-Allow-Origin', '*');
    return res;
  } catch (err) {
    console.error('[api/brain/import] error:', err);
    return errorResponse('Internal server error', 500);
  }
}
