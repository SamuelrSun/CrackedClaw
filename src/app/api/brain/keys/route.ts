/**
 * GET  /api/brain/keys — List active API keys for the authenticated user
 * POST /api/brain/keys — Generate a new API key
 */

import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { generateApiKey } from '@/lib/brain-api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MAX_KEYS_PER_USER = 10;

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const admin = createAdminClient();

  const { data: keys, error: dbErr } = await admin
    .from('brain_api_keys')
    .select('id, key_prefix, name, scopes, last_used_at, request_count, created_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (dbErr) {
    console.error('[api/brain/keys] list error:', dbErr);
    return errorResponse('Failed to list keys', 500);
  }

  return jsonResponse({ keys: keys || [] });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const admin = createAdminClient();

  // Check key count limit
  const { count, error: countErr } = await admin
    .from('brain_api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (countErr) {
    console.error('[api/brain/keys] count error:', countErr);
    return errorResponse('Failed to check key count', 500);
  }

  if ((count ?? 0) >= MAX_KEYS_PER_USER) {
    return errorResponse(`Maximum ${MAX_KEYS_PER_USER} active keys allowed`, 400);
  }

  // Parse optional name
  let name = 'Default';
  try {
    const body = await request.json();
    if (body.name && typeof body.name === 'string') {
      name = body.name.trim().slice(0, 64);
    }
  } catch {
    // No body or invalid JSON — use default name
  }

  // Generate key
  const { key, hash, prefix } = generateApiKey();

  const { data: inserted, error: insertErr } = await admin
    .from('brain_api_keys')
    .insert({
      user_id: user.id,
      key_hash: hash,
      key_prefix: prefix,
      name,
    })
    .select('id, key_prefix, name, created_at')
    .single();

  if (insertErr) {
    console.error('[api/brain/keys] insert error:', insertErr);
    return errorResponse('Failed to create key', 500);
  }

  // Return the full key ONCE — it's never stored or returned again
  return jsonResponse({
    key,
    id: inserted.id,
    prefix: inserted.key_prefix,
    name: inserted.name,
    created_at: inserted.created_at,
  }, 201);
}
