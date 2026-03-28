/**
 * POST /api/integrations/sync-workspace
 * Triggers an INTEGRATIONS.md sync to the user's OpenClaw gateway workspace.
 * Called after any integration change (OAuth connect, Maton connect, disconnect).
 * Rate-limited: at most once per 10 seconds per user.
 */

import { NextResponse } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { updateIntegrations } from '@/lib/gateway/workspace';

export const dynamic = 'force-dynamic';

// Simple per-user rate limiting
const lastSyncMap = new Map<string, number>();
const MIN_INTERVAL_MS = 10_000;

export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const now = Date.now();
  const lastSync = lastSyncMap.get(user.id) || 0;
  if (now - lastSync < MIN_INTERVAL_MS) {
    return jsonResponse({ ok: true, skipped: true, reason: 'rate-limited' });
  }
  lastSyncMap.set(user.id, now);

  try {
    await updateIntegrations(user.id);
    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[sync-workspace] Failed:', err);
    return errorResponse('Failed to sync workspace', 500);
  }
}
