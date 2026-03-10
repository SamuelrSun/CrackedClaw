import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/crypto';

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
}

// Infer category from key name
function inferCategory(key: string): MemoryCategory {
  const k = key.toLowerCase();
  if (k.includes('password') || k.includes('token') || k.includes('key') || k.includes('secret') || k.includes('sid') || k.includes('api')) return 'credential';
  if (k.includes('prefer') || k.includes('style') || k.includes('tone') || k.includes('format') || k.includes('language')) return 'preference';
  if (k.includes('project') || k.includes('app') || k.includes('startup') || k.includes('product') || k.includes('repo')) return 'project';
  if (k.includes('contact') || k.includes('email') || k.includes('person') || k.includes('team') || k.includes('founder')) return 'contact';
  if (k.includes('schedule') || k.includes('meeting') || k.includes('calendar') || k.includes('timezone') || k.includes('time')) return 'schedule';
  if (k.includes('context') || k.includes('background') || k.includes('goal') || k.includes('objective')) return 'context';
  return 'fact';
}

// Infer importance from category and key
function inferImportance(key: string, category: MemoryCategory): number {
  if (category === 'credential') return 5;
  if (category === 'preference') return 4;
  if (category === 'project') return 4;
  if (category === 'contact') return 3;
  if (category === 'schedule') return 3;
  return 2;
}

// Extract tags from key and value
function extractTags(key: string, value: string): string[] {
  const tags = new Set<string>();
  const words = (key + ' ' + value).toLowerCase().split(/[\s_\-=.,]/);
  const meaningful = words.filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'will', 'been', 'were'].includes(w));
  meaningful.slice(0, 5).forEach(w => tags.add(w));
  return Array.from(tags);
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
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function saveMemory(
  userId: string, 
  key: string, 
  value: string,
  options: { category?: MemoryCategory; source?: MemorySource; importance?: number; tags?: string[] } = {}
): Promise<void> {
  const supabase = createAdminClient();
  const category = options.category || inferCategory(key);
  const importance = options.importance || inferImportance(key, category);
  const tags = options.tags || extractTags(key, value);
  const source = options.source || 'chat';
  
  await supabase.from('user_memory').upsert(
    { 
      user_id: userId, key, value, category, tags, importance, source,
      updated_at: new Date().toISOString() 
    },
    { onConflict: 'user_id,key' }
  );
}

export async function deleteMemory(userId: string, key: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('user_memory').delete().eq('user_id', userId).eq('key', key);
}

export async function deleteMemoryById(userId: string, id: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('user_memory').delete().eq('user_id', userId).eq('id', id);
}

export async function updateMemory(userId: string, id: string, updates: Partial<Pick<MemoryEntry, 'value' | 'category' | 'importance' | 'tags' | 'summary'>>): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('user_memory')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id);
}

// Get memories relevant to a given message (keyword/tag matching)
export async function getRelevantMemories(userId: string, message: string, limit = 10): Promise<MemoryEntry[]> {
  const supabase = createAdminClient();
  
  // Extract keywords from message
  const words = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  
  // Get all memories ordered by importance
  const { data } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .limit(100);
  
  if (!data || data.length === 0) return [];
  
  // Score each memory by relevance to message
  const scored = data.map(m => {
    let score = m.importance;
    const haystack = (m.key + ' ' + m.value + ' ' + (m.summary || '') + ' ' + (m.tags || []).join(' ')).toLowerCase();
    for (const word of words) {
      if (haystack.includes(word)) score += 2;
    }
    return { ...m, _score: score };
  });
  
  // Return top N most relevant
  return scored
    .sort((a, b) => b._score - a._score)
    .slice(0, limit)
    .map(({ _score, ...m }) => m as MemoryEntry);
}

export async function getAllMemories(userId: string): Promise<MemoryEntry[]> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', userId)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false });
  return (data || []) as MemoryEntry[];
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

export async function processAgentResponse(userId: string, responseText: string): Promise<string> {
  const memoryMarkers = parseMemoryMarkers(responseText);
  const forgetMarkers = parseForgetMarkers(responseText);
  const secretMarkers = parseSecretMarkers(responseText);

  await Promise.all([
    ...memoryMarkers.map(m => saveMemory(userId, m.key, m.value, { category: m.category, source: 'chat' })),
    ...forgetMarkers.map(k => deleteMemory(userId, k)),
    ...secretMarkers.map(s => saveSecret(userId, s.name, s.value)),
  ]);

  return stripMarkers(responseText);
}
