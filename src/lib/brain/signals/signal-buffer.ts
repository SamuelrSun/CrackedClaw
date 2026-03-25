/**
 * Signal buffer — directly inserts brain signals to Supabase.
 *
 * Fire-and-forget: never blocks the chat response path.
 *
 * NOTE: The previous in-memory Map buffer was removed because it doesn't
 * survive Vercel serverless cold starts — signals were being silently dropped.
 * All inserts are now direct to the DB.
 *
 * DB index recommended for scale:
 *   CREATE INDEX IF NOT EXISTS idx_brain_signals_user_processed
 *   ON brain_signals(user_id, processed_at, created_at);
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { BrainSignal } from './types';

/**
 * Record a signal directly to the brain_signals table.
 * Fire-and-forget — never throws, never blocks.
 */
export function recordSignal(signal: BrainSignal): void {
  const supabase = createAdminClient();

  supabase
    .from('brain_signals')
    .insert({
      user_id: signal.user_id,
      signal_type: signal.signal_type,
      domain: signal.domain ?? null,
      subdomain: signal.subdomain ?? null,
      context: signal.context ?? null,
      signal_data: signal.signal_data,
      session_id: signal.session_id ?? null,
      source: signal.source ?? 'dopl',
    })
    .then(() => {})
    .catch((err) => console.error('[brain-signal] Insert failed:', err));
}

/**
 * No-op kept for backward compatibility.
 * Previously flushed the in-memory buffer to Supabase.
 * Now a no-op since all signals are inserted directly.
 */
export async function flushSignals(_userId: string): Promise<void> {
  // No-op — direct insert in recordSignal() replaces buffering
}

/**
 * Prune processed signals older than N days for a user.
 * Call after successful aggregation to keep the table lean.
 *
 * Returns the number of rows deleted (0 on error).
 */
export async function pruneOldSignals(userId: string, daysToKeep = 30): Promise<number> {
  const cutoff = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000).toISOString();

  try {
    const supabase = createAdminClient();
    const { count } = await supabase
      .from('brain_signals')
      .delete({ count: 'exact' })
      .eq('user_id', userId)
      .not('processed_at', 'is', null)
      .lt('created_at', cutoff);

    return count ?? 0;
  } catch (err) {
    console.error('[brain-signal] pruneOldSignals failed:', err);
    return 0;
  }
}
