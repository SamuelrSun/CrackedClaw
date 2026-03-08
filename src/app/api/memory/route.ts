import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const supabase = await createClient();
  const { data } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', user.id)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false });
  return jsonResponse({ memory: data || [] });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { key, value, category } = await request.json();
  if (!key || !value) return errorResponse('key and value required', 400);
  const { saveMemory } = await import('@/lib/memory/service');
  await saveMemory(user.id, key, value, { category, source: 'user_input', importance: 4 });
  return jsonResponse({ ok: true });
}

export async function PATCH(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id, ...updates } = await request.json();
  if (!id) return errorResponse('id required', 400);
  const { updateMemory } = await import('@/lib/memory/service');
  await updateMemory(user.id, id, updates);
  return jsonResponse({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { key, id } = await request.json();
  const supabase = await createClient();
  if (id) {
    await supabase.from('user_memory').delete().eq('user_id', user.id).eq('id', id);
  } else if (key) {
    await supabase.from('user_memory').delete().eq('user_id', user.id).eq('key', key);
  } else {
    return errorResponse('key or id required', 400);
  }
  return jsonResponse({ ok: true });
}
