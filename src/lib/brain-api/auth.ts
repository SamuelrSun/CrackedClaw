/**
 * Brain Public API — authentication middleware.
 *
 * Authenticates requests via `Authorization: Bearer dpb_sk_xxx` API key.
 * Re-exports the shared auth utilities from @/lib/brain-api-auth so all
 * Brain API routes can import from a single, consistent location.
 *
 * Usage:
 *   import { requireBrainAuth } from '@/lib/brain-api/auth';
 *
 *   const auth = await requireBrainAuth(request);
 *   if ('error' in auth) return auth.error;
 *   const { userId } = auth; // authenticated user
 */

import { type NextRequest } from 'next/server';
import {
  requireBrainAuth as _requireBrainAuth,
  type BrainAuthResult,
  type BrainAuthError,
} from '@/lib/brain-api-auth';

export type { BrainAuthResult, BrainAuthError };

/**
 * Authenticate a Brain API request.
 *
 * Tries API-key auth first (`Authorization: Bearer dpb_sk_...`),
 * then falls back to Supabase session auth for web-app requests.
 *
 * Returns BrainAuthResult on success or BrainAuthError with a ready-to-return
 * NextResponse on failure.
 */
export async function requireBrainAuth(
  request: NextRequest,
): Promise<BrainAuthResult | BrainAuthError> {
  return _requireBrainAuth(request);
}
