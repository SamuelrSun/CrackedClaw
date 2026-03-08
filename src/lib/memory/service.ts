import { createAdminClient } from '@/lib/supabase/admin';
import { encrypt, decrypt } from '@/lib/crypto';

// Parse [[REMEMBER: key=value]] markers from agent response
export function parseMemoryMarkers(text: string): Array<{key: string, value: string}> {
  const regex = /\[\[REMEMBER:\s*([^=\]]+)=([^\]]+)\]\]/g;
  const results: Array<{key: string, value: string}> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ key: match[1].trim(), value: match[2].trim() });
  }
  return results;
}

// Parse [[FORGET: key]] markers
export function parseForgetMarkers(text: string): string[] {
  const regex = /\[\[FORGET:\s*([^\]]+)\]\]/g;
  const results: string[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push(match[1].trim());
  }
  return results;
}

// Parse [[STORE_SECRET: name=value]] markers
export function parseSecretMarkers(text: string): Array<{name: string, value: string}> {
  const regex = /\[\[STORE_SECRET:\s*([^=\]]+)=([^\]]+)\]\]/g;
  const results: Array<{name: string, value: string}> = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ name: match[1].trim(), value: match[2].trim() });
  }
  return results;
}

// Strip all markers from text before showing to user
export function stripMarkers(text: string): string {
  return text
    .replace(/\[\[REMEMBER:[^\]]+\]\]/g, '')
    .replace(/\[\[FORGET:[^\]]+\]\]/g, '')
    .replace(/\[\[STORE_SECRET:[^\]]+\]\]/g, '')
    .trim();
}

export async function saveMemory(userId: string, key: string, value: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('user_memory').upsert(
    { user_id: userId, key, value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,key' }
  );
}

export async function deleteMemory(userId: string, key: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from('user_memory').delete().eq('user_id', userId).eq('key', key);
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

// Process agent response: save any memory/secret markers, return cleaned text
export async function processAgentResponse(userId: string, responseText: string): Promise<string> {
  const memoryMarkers = parseMemoryMarkers(responseText);
  const forgetMarkers = parseForgetMarkers(responseText);
  const secretMarkers = parseSecretMarkers(responseText);

  await Promise.all([
    ...memoryMarkers.map(m => saveMemory(userId, m.key, m.value)),
    ...forgetMarkers.map(k => deleteMemory(userId, k)),
    ...secretMarkers.map(s => saveSecret(userId, s.name, s.value)),
  ]);

  return stripMarkers(responseText);
}
