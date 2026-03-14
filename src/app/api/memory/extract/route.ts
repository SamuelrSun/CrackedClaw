/**
 * POST /api/memory/extract
 * Extract and store memories from a conversation.
 * Called after chat turns complete (batched — not every message).
 * Uses Claude Haiku for cost efficiency at scale.
 */

import { NextRequest, NextResponse } from 'next/server';
import { mem0Write } from '@/lib/memory/mem0-client';
import { getEmbedding } from '@/lib/memory/embeddings';
import { classifyDomain } from '@/lib/memory/domain-classifier';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const MAX_FACTS = 5;
const DEDUP_THRESHOLD = 0.9;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Extract key facts from a conversation using Claude Haiku (cost-efficient).
 */
async function extractFactsWithHaiku(
  messages: Array<{ role: string; content: string }>
): Promise<Array<{ content: string; importance: number }>> {
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    const convoText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

    const response = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 512,
      system: `Extract up to ${MAX_FACTS} key facts, preferences, or important information from this conversation worth remembering long-term. Return a JSON array with "content" (the fact) and "importance" (0-1). Skip transient details. If nothing worth saving, return [].

Example:
[{"content": "User prefers async communication over meetings", "importance": 0.8}]`,
      messages: [{ role: 'user', content: convoText }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    // Enforce max facts limit
    return Array.isArray(parsed) ? parsed.slice(0, MAX_FACTS) : [];
  } catch (err) {
    console.error('[memory/extract] Haiku extraction failed:', err);
    return [];
  }
}

export async function POST(request: NextRequest) {
  // Auth: accept service role key or skip in dev (internal route)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Require auth in production
  if (serviceRoleKey && token !== serviceRoleKey) {
    // Allow unauthenticated in development for easier wiring
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: {
    userId?: string;
    messages?: Array<{ role: string; content: string }>;
    conversationId?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, messages, conversationId } = body;

  if (!userId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'userId and messages are required' }, { status: 400 });
  }

  try {
    const facts = await extractFactsWithHaiku(messages);

    if (facts.length === 0) {
      return NextResponse.json({ memoriesCreated: 0, facts: [] });
    }

    const meta = {
      source: 'chat',
      ...(conversationId ? { conversationId } : {}),
    };

    let memoriesCreated = 0;
    const storedFacts: string[] = [];

    for (const fact of facts) {
      try {
        // Embed + dedup at 0.9 threshold
        let embedding: number[] | null = null;
        const hasEmbedKey = !!(process.env.OPENAI_API_KEY || process.env.VOYAGE_API_KEY);
        if (hasEmbedKey) {
          try {
            embedding = await getEmbedding(fact.content);
          } catch (err) {
            console.warn('[memory/extract] Embedding failed:', err);
          }
        }

        if (embedding) {
          const { data: existing } = await supabaseAdmin.rpc('match_memories', {
            query_embedding: embedding,
            match_user_id: userId,
            match_domain: null,
            match_limit: 1,
            match_threshold: DEDUP_THRESHOLD,
          });

          if (existing && existing.length > 0) {
            // Update existing duplicate
            await supabaseAdmin.from('memories').update({
              content: fact.content,
              embedding,
              importance: Math.max(fact.importance, existing[0].importance),
              metadata: { ...existing[0].metadata, ...meta },
              updated_at: new Date().toISOString(),
              accessed_at: new Date().toISOString(),
            }).eq('id', existing[0].id);
            storedFacts.push(fact.content);
            memoriesCreated++;
            continue;
          }
        }

        // Insert new memory via mem0Write (handles dedup + embedding internally)
        const domain = classifyDomain(fact.content);
        const id = await mem0Write(userId, fact.content, {
          domain,
          importance: fact.importance,
          source: 'chat',
          metadata: meta,
        });

        if (id) {
          storedFacts.push(fact.content);
          memoriesCreated++;
        }
      } catch (err) {
        console.error('[memory/extract] Failed to store fact:', fact.content, err);
        // Continue — never crash
      }
    }

    return NextResponse.json({ memoriesCreated, facts: storedFacts });
  } catch (err) {
    console.error('[memory/extract] Error:', err);
    // Return empty success — memory failures must never crash the app
    return NextResponse.json({ memoriesCreated: 0, facts: [] });
  }
}
