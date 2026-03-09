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
  };
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
    model: 'claude-sonnet-4-20250514',
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
 * Retrieve all stored memories for a user, ordered by importance.
 */
export async function mem0GetAll(userId: string, domain?: string): Promise<Mem0Memory[]> {
  let query = supabase
    .from('memories')
    .select('id, content, domain, metadata, importance')
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
 * Check if the memory system is configured (needs embedding API key).
 */
export function isMem0Enabled(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.VOYAGE_API_KEY);
}

/**
 * Format memories for injection into a system prompt.
 */
export function formatMemoriesForPrompt(memories: Mem0Memory[]): string {
  if (memories.length === 0) return '';
  return (
    'USER MEMORIES (from past interactions):\n' +
    memories
      .filter(m => m.memory)
      .map(m => `- ${m.memory}`)
      .join('\n')
  );
}
