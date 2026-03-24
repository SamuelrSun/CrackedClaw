/**
 * Self-hosted memory layer using Supabase pgvector.
 *
 * Replaces the Mem0 cloud API with our own semantic memory system:
 * - Embeddings via OpenAI text-embedding-3-small (1536 dims, ~free)
 * - Vector similarity search via pgvector in Supabase
 * - Memory extraction via Claude
 * - Deduplication at 0.9 cosine similarity threshold
 *
 * Requires: OPENAI_API_KEY (or VOYAGE_API_KEY), NEXT_PUBLIC_SUPABASE_URL,
 *           SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
 */

import { createClient } from '@supabase/supabase-js';
import { getEmbedding } from './embeddings';
import { classifyDomain } from './domain-classifier';
import { getModelForTask } from '@/lib/ai/model-router';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface Mem0Memory {
  id: string;
  memory: string;
  content?: string;
  domain?: string;
  metadata?: Record<string, unknown> | null;
  importance?: number;
  similarity?: number;
  categories?: string[];
  created_at?: Date;
  updated_at?: Date;
  score?: number;
}

interface RawMemory {
  id: string;
  content: string;
  domain: string;
  metadata: Record<string, unknown>;
  importance: number;
  similarity?: number;
  created_at?: string;
  updated_at?: string;
}

function normalizeMemory(m: RawMemory): Mem0Memory {
  return {
    id: m.id,
    memory: m.content,
    content: m.content,
    domain: m.domain,
    metadata: m.metadata,
    importance: m.importance,
    similarity: m.similarity,
    score: m.similarity,
    created_at: m.created_at ? new Date(m.created_at) : undefined,
    updated_at: m.updated_at ? new Date(m.updated_at) : undefined,
  };
}

function hasEmbeddingKey(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.VOYAGE_API_KEY);
}

/**
 * Search memories by semantic similarity.
 */
export async function mem0Search(
  query: string,
  userId: string,
  options?: {
    limit?: number;
    domain?: string;
    threshold?: number;
    filters?: Record<string, unknown>;
  }
): Promise<Mem0Memory[]> {
  try {
    if (hasEmbeddingKey()) {
      const embedding = await getEmbedding(query);
      const { data, error } = await supabase.rpc('match_memories', {
        query_embedding: embedding,
        match_user_id: userId,
        match_domain: options?.domain ?? null,
        match_limit: options?.limit ?? 5,
        match_threshold: options?.threshold ?? 0.5,
      });
      if (error) throw error;
      return (data as RawMemory[] || []).map(normalizeMemory);
    }
    // Fallback: ILIKE text search when no embedding key
    let q = supabase
      .from('memories')
      .select('id, content, domain, metadata, importance, created_at, updated_at')
      .eq('user_id', userId)
      .ilike('content', `%${query}%`)
      .order('importance', { ascending: false })
      .limit(options?.limit ?? 5);
    if (options?.domain) q = q.eq('domain', options.domain);
    const { data, error } = await q;
    if (error) throw error;
    return (data as RawMemory[] || []).map(normalizeMemory);
  } catch (err) {
    console.error('[memory] Search failed:', err);
    return [];
  }
}

/**
 * Extract and add memories from a conversation turn.
 * Deduplicates against existing memories at 0.9 similarity threshold.
 */
export async function mem0Add(
  messages: Array<{ role: string; content: string }>,
  userId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const facts = await extractMemories(messages);
    if (facts.length === 0) return;

    const userMsg = messages.find(m => m.role === 'user')?.content ?? '';
    const domain = classifyDomain(userMsg);

    for (const fact of facts) {
      const embedding = await getEmbedding(fact.content);

      const { data: existing } = await supabase.rpc('match_memories', {
        query_embedding: embedding,
        match_user_id: userId,
        match_domain: null,
        match_limit: 1,
        match_threshold: 0.9, // Very high = duplicate
      });

      if (existing && existing.length > 0) {
        // Update existing memory
        await supabase.from('memories').update({
          content: fact.content,
          embedding,
          importance: Math.max(fact.importance, existing[0].importance),
          updated_at: new Date().toISOString(),
          accessed_at: new Date().toISOString(),
        }).eq('id', existing[0].id);
      } else {
        // Insert new memory
        await supabase.from('memories').insert({
          user_id: userId,
          content: fact.content,
          embedding,
          domain,
          importance: fact.importance,
          metadata: { ...metadata, extractedAt: new Date().toISOString() },
        });
      }
    }
  } catch (err) {
    console.error('[memory] Add failed:', err);
  }
}

/**
 * Extract key facts from a conversation using Claude.
 */
async function extractMemories(
  messages: Array<{ role: string; content: string }>
): Promise<Array<{ content: string; importance: number }>> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const convoText = messages.map(m => `${m.role}: ${m.content}`).join('\n');

  const response = await client.messages.create({
    model: getModelForTask('extraction'),
    max_tokens: 1024,
    system: `Extract key facts, preferences, and important information from this conversation that should be remembered for future interactions. Return a JSON array of objects with "content" (the fact) and "importance" (0-1 score). Only extract genuinely useful long-term facts, not transient details. If nothing worth remembering, return [].

Example output:
[
  {"content": "User prefers morning meetings before 10am", "importance": 0.8},
  {"content": "User is building an AR glasses startup called Fenna", "importance": 0.9}
]`,
    messages: [{ role: 'user', content: convoText }],
  });

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]);
  } catch {
    return [];
  }
}

/**
 * Write a memory with deduplication. If a very similar memory exists (0.9 threshold),
 * update it instead of creating a new one.
 */
export async function mem0Write(
  userId: string,
  content: string,
  options?: {
    domain?: string;
    importance?: number;
    source?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const importance = options?.importance ?? 0.5;
    const domain = options?.domain ?? classifyDomain(content);
    const meta = { ...options?.metadata, source: options?.source ?? 'chat' };

    let embedding: number[] | null = null;
    if (hasEmbeddingKey()) {
      try {
        embedding = await getEmbedding(content);
      } catch (err) {
        console.warn('[memory] Embedding failed, storing without vector:', err);
      }
    }

    // Dedup: check for near-duplicate if we have an embedding
    if (embedding) {
      const { data: existing } = await supabase.rpc('match_memories', {
        query_embedding: embedding,
        match_user_id: userId,
        match_domain: null,
        match_limit: 1,
        match_threshold: 0.9,
      });

      if (existing && existing.length > 0) {
        const { error } = await supabase.from('memories').update({
          content,
          embedding,
          importance: Math.max(importance, existing[0].importance),
          metadata: { ...existing[0].metadata, ...meta },
          updated_at: new Date().toISOString(),
          accessed_at: new Date().toISOString(),
        }).eq('id', existing[0].id);
        if (error) throw error;
        return existing[0].id;
      }
    }

    // Insert new memory
    const { data, error } = await supabase.from('memories').insert({
      user_id: userId,
      content,
      embedding,
      domain,
      importance,
      metadata: meta,
    }).select('id').single();
    if (error) throw error;
    return data?.id ?? null;
  } catch (err) {
    console.error('[memory] Write failed:', err);
    return null;
  }
}

/**
 * Get high-importance core memories regardless of query.
 */
export async function mem0GetCore(
  userId: string,
  options?: { minImportance?: number; limit?: number }
): Promise<Mem0Memory[]> {
  try {
    const { data, error } = await supabase
      .from('memories')
      .select('id, content, domain, metadata, importance, created_at, updated_at')
      .eq('user_id', userId)
      .gte('importance', options?.minImportance ?? 0.7)
      .order('importance', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(options?.limit ?? 10);
    if (error) throw error;
    return (data as RawMemory[] || []).map(normalizeMemory);
  } catch (err) {
    console.error('[memory] GetCore failed:', err);
    return [];
  }
}

/**
 * Update a memory's content (re-embed if content changed).
 */
export async function mem0Update(
  memoryId: string,
  updates: { content?: string; importance?: number; domain?: string; page_path?: string | null }
): Promise<void> {
  try {
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.content !== undefined) {
      updateData.content = updates.content;
      if (hasEmbeddingKey()) {
        try {
          updateData.embedding = await getEmbedding(updates.content);
        } catch (err) {
          console.warn('[memory] Re-embedding failed:', err);
        }
      }
    }
    if (updates.importance !== undefined) updateData.importance = updates.importance;
    if (updates.domain !== undefined) updateData.domain = updates.domain;

    // If page_path is being updated, merge into existing metadata
    if (updates.page_path !== undefined) {
      const { data: existing } = await supabase
        .from('memories')
        .select('metadata')
        .eq('id', memoryId)
        .single();
      const existingMeta = (existing?.metadata as Record<string, unknown>) || {};
      updateData.metadata = { ...existingMeta, page_path: updates.page_path };
    }

    const { error } = await supabase.from('memories').update(updateData).eq('id', memoryId);
    if (error) throw error;
  } catch (err) {
    console.error('[memory] Update failed:', err);
  }
}

/**
 * Get memories created or updated in the last N hours.
 * Catches recent lower-importance facts that mem0GetCore misses.
 */
export async function getRecentMemories(
  userId: string,
  options?: { hoursBack?: number; limit?: number }
): Promise<Mem0Memory[]> {
  try {
    const hoursBack = options?.hoursBack ?? 48;
    const limit = options?.limit ?? 15;
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('memories')
      .select('id, content, domain, metadata, importance, created_at, updated_at')
      .eq('user_id', userId)
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as RawMemory[] || []).map(normalizeMemory);
  } catch (err) {
    console.error('[memory] getRecentMemories failed:', err);
    return [];
  }
}

/**
 * Get session summary memories (source = 'session_summary').
 * Returns [] gracefully if none exist yet (Phase 2 will populate these).
 */
export async function getSessionSummaries(
  userId: string,
  options?: { limit?: number }
): Promise<Mem0Memory[]> {
  try {
    const limit = options?.limit ?? 5;

    const { data, error } = await supabase
      .from('memories')
      .select('id, content, domain, metadata, importance, created_at, updated_at')
      .eq('user_id', userId)
      .eq('metadata->>source', 'session_summary')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      // Don't throw — session summaries may not exist yet
      console.warn('[memory] getSessionSummaries query failed (may be expected):', error.message);
      return [];
    }
    return (data as RawMemory[] || []).map(normalizeMemory);
  } catch (err) {
    console.error('[memory] getSessionSummaries failed:', err);
    return [];
  }
}

/**
 * Retrieve all stored memories for a user, ordered by importance.
 */
export async function mem0GetAll(userId: string, domain?: string): Promise<Mem0Memory[]> {
  let query = supabase
    .from('memories')
    .select('id, content, domain, metadata, importance, created_at, updated_at')
    .eq('user_id', userId)
    .order('importance', { ascending: false });

  if (domain) query = (query as typeof query).eq('domain', domain);

  const { data, error } = await query.limit(100);
  if (error) throw error;
  return (data as RawMemory[] || []).map(normalizeMemory);
}

/**
 * Delete a specific memory by ID.
 */
export async function mem0Delete(memoryId: string): Promise<void> {
  await supabase.from('memories').delete().eq('id', memoryId);
}

/**
 * The memory system is always enabled — gracefully degrades without embeddings.
 */
export function isMem0Enabled(): boolean {
  return true;
}

/**
 * Format memories for injection into a system prompt.
 * Includes source attribution tags from metadata.
 */
export function formatMemoriesForPrompt(memories: Mem0Memory[]): string {
  if (memories.length === 0) return '';
  return (
    'USER MEMORIES:\n' +
    memories
      .filter(m => m.memory)
      .map(m => {
        const meta = m.metadata as Record<string, unknown> | null;
        const source = meta?.source || 'unknown';
        const email = meta?.accountEmail;
        const tag = email ? `${source}/${email}` : source as string;
        return `- [${tag}] ${m.memory}`;
      })
      .join('\n')
  );
}
