/**
 * Signal buffer — batches brain signals in memory and flushes to Supabase periodically.
 *
 * Fire-and-forget: never blocks the chat response path.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { BrainSignal } from './types';

const FLUSH_THRESHOLD = 20;
const FLUSH_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

interface BufferEntry {
  signals: BrainSignal[];
  lastFlush: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const buffers = new Map<string, BufferEntry>();

function getBuffer(userId: string): BufferEntry {
  let entry = buffers.get(userId);
  if (!entry) {
    entry = { signals: [], lastFlush: Date.now(), timer: null };
    buffers.set(userId, entry);
  }
  return entry;
}

/**
 * Record a signal into the in-memory buffer.
 * Automatically triggers a flush when thresholds are met.
 */
export function recordSignal(signal: BrainSignal): void {
  const buf = getBuffer(signal.user_id);
  buf.signals.push(signal);

  // Flush if threshold reached
  if (buf.signals.length >= FLUSH_THRESHOLD) {
    void flushSignals(signal.user_id);
    return;
  }

  // Set a timer for time-based flush if not already set
  if (!buf.timer) {
    buf.timer = setTimeout(() => {
      void flushSignals(signal.user_id);
    }, FLUSH_INTERVAL_MS);
  }
}

/**
 * Flush all buffered signals for a user to Supabase.
 * Fire-and-forget — errors are logged but never thrown.
 */
export async function flushSignals(userId: string): Promise<void> {
  const buf = buffers.get(userId);
  if (!buf || buf.signals.length === 0) return;

  // Grab and clear the buffer atomically
  const toFlush = buf.signals.splice(0);
  buf.lastFlush = Date.now();

  if (buf.timer) {
    clearTimeout(buf.timer);
    buf.timer = null;
  }

  try {
    const supabase = createAdminClient();

    const rows = toFlush.map((s) => ({
      user_id: s.user_id,
      signal_type: s.signal_type,
      domain: s.domain ?? null,
      subdomain: s.subdomain ?? null,
      context: s.context ?? null,
      signal_data: s.signal_data,
      session_id: s.session_id ?? null,
    }));

    const { error } = await supabase.from('brain_signals').insert(rows);
    if (error) {
      console.error('[brain/signal-buffer] flush failed:', error.message);
    }
  } catch (err) {
    console.error('[brain/signal-buffer] flush error:', err);
  }
}
