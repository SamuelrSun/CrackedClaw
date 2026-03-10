import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();

  // Last 30 days
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const { data: daily } = await supabase
    .from('user_usage')
    .select('date, messages_sent, tokens_used, tool_calls')
    .eq('user_id', user.id)
    .gte('date', since)
    .order('date', { ascending: true });

  const totals = (daily || []).reduce(
    (acc, row) => ({
      messages: acc.messages + (row.messages_sent || 0),
      tokens: acc.tokens + (row.tokens_used || 0),
      toolCalls: acc.toolCalls + (row.tool_calls || 0),
    }),
    { messages: 0, tokens: 0, toolCalls: 0 }
  );

  // Memory count
  const { count: memoryCount } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id);

  return jsonResponse({ daily: daily || [], totals, memoryCount: memoryCount || 0 });
}
