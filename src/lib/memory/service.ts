import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/crypto';
import { mem0Write, mem0Search, mem0GetAll, mem0Delete, mem0Update, mem0Add } from './mem0-client';

export type MemoryCategory = 'credential' | 'preference' | 'project' | 'contact' | 'fact' | 'context' | 'schedule' | 'personal';
export type MemorySource = 'chat' | 'scan' | 'user_input' | 'onboarding';

export interface MemoryEntry {
  id: string;
  user_id: string;
  key: string;
  value: string;
  category: MemoryCategory;
  tags: string[];
  importance: number;
  source: MemorySource;
  summary?: string;
  created_at: string;
  updated_at: string;
  // Fields from mem0 system
  domain?: string;
  content?: string;
  metadata?: Record<string, unknown> | null;
}

// Enhanced [[REMEMBER:]] parser — supports optional category
// Format: [[REMEMBER: key=value]] or [[REMEMBER(category): key=value]]
export function parseMemoryMarkers(text: string): Array<{key: string, value: string, category?: MemoryCategory}> {
  const results: Array<{key: string, value: string, category?: MemoryCategory}> = [];

  // With category: [[REMEMBER(credential): twilio_sid=ACxxx]]
  const withCategory = /\[\[REMEMBER\((\w+)\):\s*([^=\]]+)=([^\]]+)\]\]/g;
  let match;
  while ((match = withCategory.exec(text)) !== null) {
    results.push({
      key: match[2].trim(),
      value: match[3].trim(),
      category: match[1] as MemoryCategory
    });
  }

  // Without category: [[REMEMBER: key=value]]
  const withoutCategory = /\[\[REMEMBER:\s*([^=\]]+)=([^\]]+)\]\]/g;
  while ((match = withoutCategory.exec(text)) !== null) {
    results.push({ key: match[1].trim(), value: match[2].trim() });
  }

  return results;
}

export function parseForgetMarkers(text: string): string[] {
  const regex = /\[\[FORGET:\s*([^\]]+)\]\]/g;
  const results: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

export function parseSecretMarkers(text: string): Array<{name: string, value: string}> {
  const regex = /\[\[STORE_SECRET:\s*([^=\]]+)=([^\]]+)\]\]/g;
  const results: Array<{name: string, value: string}> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ name: match[1].trim(), value: match[2].trim() });
  }
  return results;
}

export function stripMarkers(text: string): string {
  return text
    .replace(/\[\[REMEMBER(\([^)]*\))?:[^\]]+\]\]/g, '')
    .replace(/\[\[FORGET:[^\]]+\]\]/g, '')
    .replace(/\[\[STORE_SECRET:[^\]]+\]\]/g, '')
    .replace(/\[\[user_name:[^\]]+\]\]/g, '')
    .replace(/\[\[agent_name:[^\]]+\]\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Map category to mem0 domain
function categoryToDomain(category?: MemoryCategory): string | undefined {
  if (!category) return undefined;
  switch (category) {
    case 'credential': return 'general';
    case 'preference': return 'general';
    case 'project': return 'coding';
    case 'contact': return 'email';
    case 'schedule': return 'calendar';
    default: return 'general';
  }
}

export async function saveMemory(
  userId: string,
  key: string,
  value: string,
  options: { category?: MemoryCategory; source?: MemorySource; importance?: number; tags?: string[] } = {}
): Promise<void> {
  try {
    await mem0Write(userId, `${key}: ${value}`, {
      domain: categoryToDomain(options.category),
      source: options.source || 'chat',
      importance: options.importance ? options.importance / 5.0 : 0.5, // convert 1-5 to 0-1
      metadata: { original_key: key, category: options.category, tags: options.tags },
    });
  } catch (err) {
    console.error('[memory] saveMemory failed:', err);
  }
}

export async function deleteMemory(userId: string, key: string): Promise<void> {
  try {
    // Semantic search for the key, delete best match
    const results = await mem0Search(key, userId, { limit: 1, threshold: 0.3 });
    if (results.length > 0) {
      await mem0Delete(results[0].id);
    }
  } catch (err) {
    console.error('[memory] deleteMemory failed:', err);
  }
}

export async function deleteMemoryById(userId: string, id: string): Promise<void> {
  try {
    await mem0Delete(id);
  } catch (err) {
    console.error('[memory] deleteMemoryById failed:', err);
  }
}

export async function updateMemory(userId: string, id: string, updates: Partial<Pick<MemoryEntry, 'value' | 'category' | 'importance' | 'tags' | 'summary'>>): Promise<void> {
  try {
    await mem0Update(id, {
      content: updates.value,
      importance: updates.importance ? updates.importance / 5.0 : undefined,
      domain: updates.category ? categoryToDomain(updates.category) : undefined,
    });
  } catch (err) {
    console.error('[memory] updateMemory failed:', err);
  }
}

// Get memories relevant to a given message via semantic search
export async function getRelevantMemories(userId: string, message: string, limit = 10): Promise<MemoryEntry[]> {
  try {
    const results = await mem0Search(message, userId, { limit, threshold: 0.3 });
    return results.map(mem0ToMemoryEntry);
  } catch (err) {
    console.error('[memory] getRelevantMemories failed:', err);
    return [];
  }
}

export async function getAllMemories(userId: string): Promise<MemoryEntry[]> {
  try {
    const results = await mem0GetAll(userId);
    return results.map(mem0ToMemoryEntry);
  } catch (err) {
    console.error('[memory] getAllMemories failed:', err);
    return [];
  }
}

function mem0ToMemoryEntry(m: { id: string; memory?: string; content?: string; domain?: string; metadata?: Record<string, unknown> | null; importance?: number; created_at?: Date; updated_at?: Date }): MemoryEntry {
  const content = m.memory || m.content || '';
  const colonIdx = content.indexOf(':');
  const key = colonIdx > 0 ? content.substring(0, colonIdx).trim() : content.substring(0, 30);
  const value = colonIdx > 0 ? content.substring(colonIdx + 1).trim() : content;
  const meta = m.metadata as Record<string, unknown> | null;
  return {
    id: m.id,
    user_id: '',
    key,
    value,
    category: (meta?.category as MemoryCategory) || (m.domain as MemoryCategory) || 'fact',
    tags: (meta?.tags as string[]) || [],
    importance: Math.round((m.importance || 0.5) * 5),
    source: (meta?.source as MemorySource) || 'chat',
    created_at: m.created_at?.toISOString() || new Date().toISOString(),
    updated_at: m.updated_at?.toISOString() || new Date().toISOString(),
    domain: m.domain,
    content: content,
    metadata: m.metadata,
  };
}

export async function saveSecret(userId: string, name: string, value: string): Promise<void> {
  const supabase = createAdminClient();
  const encrypted = encrypt(value);
  await supabase.from('user_secrets').upsert(
    { user_id: userId, name, encrypted_value: encrypted, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,name' }
  );
}

export async function getSecret(userId: string, name: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_secrets')
    .select('encrypted_value')
    .eq('user_id', userId)
    .eq('name', name)
    .single();
  if (!data) return null;
  return decrypt(data.encrypted_value);
}

export async function processAgentResponse(userId: string, responseText: string, userMessage?: string): Promise<string> {
  const memoryMarkers = parseMemoryMarkers(responseText);
  const forgetMarkers = parseForgetMarkers(responseText);
  const secretMarkers = parseSecretMarkers(responseText);

  await Promise.all([
    ...memoryMarkers.map(m => mem0Write(userId, `${m.key}: ${m.value}`, {
      domain: categoryToDomain(m.category),
      source: 'chat',
      importance: 0.7,
      metadata: { original_key: m.key, category: m.category, marker: true },
    })),
    ...forgetMarkers.map(async (k) => {
      const results = await mem0Search(k, userId, { limit: 1, threshold: 0.3 });
      if (results.length > 0) await mem0Delete(results[0].id);
    }),
    ...secretMarkers.map(s => saveSecret(userId, s.name, s.value)),
  ]);

  // Auto-extract facts via mem0Add in background (don't block response)
  if (userMessage) {
    mem0Add(
      [{ role: 'user', content: userMessage }, { role: 'assistant', content: responseText }],
      userId,
    ).catch(() => {});
  }

  return stripMarkers(responseText);
}
