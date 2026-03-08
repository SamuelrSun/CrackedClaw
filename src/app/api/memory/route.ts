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
    .select('key, value, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  return jsonResponse({ memory: data || [] });
}

export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { key } = await request.json();
  if (!key) return errorResponse('key required', 400);
  const supabase = await createClient();
  await supabase.from('user_memory').delete().eq('user_id', user.id).eq('key', key);
  return jsonResponse({ ok: true });
}
