/**
 * GET /api/billing/history
 * Returns combined billing history: wallet transactions + chat spend from usage_ledger.
 * Paginated with ?limit=20&offset=0&filter=all|deposits|spend
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface HistoryEntry {
  id: string;
  created_at: string;
  type: 'deposit' | 'stipend' | 'refund' | 'auto_reload' | 'chat_spend';
  amount_usd: number;
  description: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
}

export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');
  const filter = searchParams.get('filter') || 'all';

  const supabase = createAdminClient();
  const entries: HistoryEntry[] = [];

  // Fetch wallet transactions (deposits, stipends, refunds)
  if (filter === 'all' || filter === 'deposits') {
    const { data: txns } = await supabase
      .from('wallet_transactions')
      .select('id, created_at, type, amount_usd, description')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (txns) {
      for (const tx of txns) {
        entries.push({
          id: tx.id,
          created_at: tx.created_at,
          type: tx.type as HistoryEntry['type'],
          amount_usd: Number(tx.amount_usd),
          description: tx.description || `${tx.type}: $${Number(tx.amount_usd).toFixed(2)}`,
        });
      }
    }
  }

  // Fetch chat spend from usage_ledger (charged=true only)
  if (filter === 'all' || filter === 'spend') {
    const { data: usage } = await supabase
      .from('usage_ledger')
      .select('id, created_at, model, cost_usd, input_tokens, output_tokens, source')
      .eq('user_id', user.id)
      .eq('charged', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (usage) {
      for (const row of usage) {
        // Friendly model name
        const modelName = row.model
          ?.replace('claude-', '')
          .replace(/-\d{8}$/, '')
          .replace(/^(\w)/, (_: string, c: string) => c.toUpperCase()) || 'Unknown';

        entries.push({
          id: row.id,
          created_at: row.created_at,
          type: 'chat_spend',
          amount_usd: Number(row.cost_usd),
          description: `Chat (${modelName})`,
          model: row.model,
          input_tokens: row.input_tokens,
          output_tokens: row.output_tokens,
        });
      }
    }
  }

  // Sort combined entries by date descending
  entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Trim to limit
  const trimmed = entries.slice(0, limit);

  return NextResponse.json({
    entries: trimmed,
    hasMore: entries.length > limit,
  });
}
