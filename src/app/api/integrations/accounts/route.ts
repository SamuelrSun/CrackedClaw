import { NextRequest } from 'next/server';
import { requireApiAuth, jsonResponse, errorResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/integrations/accounts — list all connected accounts
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider');

  const supabase = await createClient();
  let query = supabase
    .from('user_integrations')
    .select('id, provider, account_id, account_email, account_name, account_picture, team_name, is_default, status, created_at')
    .eq('user_id', user.id)
    .order('provider')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true });

  if (provider) {
    query = query.eq('provider', provider);
  }

  const { data, error: dbError } = await query;
  if (dbError) return errorResponse(dbError.message, 500);

  // Group by provider
  const grouped: Record<string, Array<Record<string, unknown>>> = {};
  for (const row of data || []) {
    const p = row.provider;
    if (!grouped[p]) grouped[p] = [];
    grouped[p].push({
      id: row.id,
      account_id: row.account_id,
      email: row.account_email,
      name: row.account_name,
      picture: row.account_picture,
      team_name: row.team_name,
      is_default: row.is_default ?? false,
      status: row.status,
      connected_at: row.created_at,
    });
  }

  return jsonResponse({ accounts: grouped });
}
