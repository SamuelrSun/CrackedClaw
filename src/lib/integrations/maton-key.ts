/**
 * Maton API Key management — per-user key stored in profiles.instance_settings
 */

import { createClient } from '@/lib/supabase/server';

const SETTINGS_KEY = 'maton_api_key';

/**
 * Get the user's Maton API key from their profile settings.
 */
export async function getMatonApiKey(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('instance_settings')
    .eq('id', userId)
    .single();

  if (!data?.instance_settings) return null;
  const settings = data.instance_settings as Record<string, unknown>;
  return (settings[SETTINGS_KEY] as string) || null;
}

/**
 * Save the user's Maton API key to their profile settings.
 */
export async function saveMatonApiKey(userId: string, apiKey: string): Promise<boolean> {
  const supabase = await createClient();

  // Get current settings
  const { data: profile } = await supabase
    .from('profiles')
    .select('instance_settings')
    .eq('id', userId)
    .single();

  const currentSettings = (profile?.instance_settings as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from('profiles')
    .update({
      instance_settings: {
        ...currentSettings,
        [SETTINGS_KEY]: apiKey,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return !error;
}

/**
 * Check if a user has a Maton API key configured.
 */
export async function hasMatonApiKey(userId: string): Promise<boolean> {
  const key = await getMatonApiKey(userId);
  return !!key;
}

/**
 * Validate a Maton API key by listing connections.
 */
export async function validateMatonApiKey(apiKey: string): Promise<boolean> {
  try {
    const res = await fetch('https://ctrl.maton.ai/connections?status=ACTIVE', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
