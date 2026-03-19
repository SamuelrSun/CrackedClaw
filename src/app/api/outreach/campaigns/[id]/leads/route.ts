/**
 * Lead scoring API — POST to score, GET to list.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/api-auth';
import { scoreLeads } from '@/lib/outreach/scoring-engine';
import { loadCriteria } from '@/lib/outreach/criteria-store';
import { parseCSV } from '@/lib/outreach/dataset-parser';
import type { DatasetRow } from '@/lib/outreach/dataset-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── POST — score dataset leads ────────────────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const campaignId = params.id;

  // Verify ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug, status')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Load criteria
  const criteria = await loadCriteria(user!.id, campaign.slug);
  if (!criteria || criteria.criteria.length === 0) {
    return NextResponse.json(
      { error: 'No criteria found. Extract criteria from your conversation first.' },
      { status: 400 }
    );
  }

  // Load dataset
  const { data: datasetRow } = await supabase
    .from('campaign_datasets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!datasetRow) {
    return NextResponse.json(
      { error: 'No dataset connected. Connect a dataset first.' },
      { status: 400 }
    );
  }

  let rows: DatasetRow[] = [];

  if (datasetRow.raw_csv) {
    const parsed = parseCSV(datasetRow.raw_csv as string);
    rows = parsed.rows;
  } else if (datasetRow.rows) {
    rows = datasetRow.rows as DatasetRow[];
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'Dataset is empty' }, { status: 400 });
  }

  // Score all leads
  let result;
  try {
    result = await scoreLeads(rows, criteria);
  } catch (err) {
    console.error('Scoring error:', err);
    return NextResponse.json(
      { error: 'Scoring failed: ' + (err instanceof Error ? err.message : 'unknown error') },
      { status: 500 }
    );
  }

  // Upsert into campaign_leads
  // Delete existing scored leads first, then insert fresh
  await supabase
    .from('campaign_leads')
    .delete()
    .eq('campaign_id', campaignId)
    .eq('source', 'dataset');

  const toInsert = result.leads.map((lead) => ({
    campaign_id: campaignId,
    name: lead.name,
    profile_url: lead.profile_url ?? null,
    profile_data: lead.profile_data,
    rank: lead.rank,
    score: lead.score,
    criterion_scores: lead.criterion_scores,
    reasoning: lead.reasoning,
    source: 'dataset',
    scored_at: lead.scored_at,
  }));

  const { error: insertError } = await supabase
    .from('campaign_leads')
    .insert(toInsert);

  if (insertError) {
    console.error('Insert error:', insertError);
    return NextResponse.json(
      { error: 'Failed to save leads: ' + insertError.message },
      { status: 500 }
    );
  }

  // Count by rank
  const high = result.leads.filter((l) => l.rank === 'high').length;
  const medium = result.leads.filter((l) => l.rank === 'medium').length;
  const low = result.leads.filter((l) => l.rank === 'low').length;

  // Update campaign status to active if it was scanning
  if (campaign.status === 'scanning' || campaign.status === 'setup') {
    await supabase
      .from('campaigns')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', campaignId);
  }

  return NextResponse.json({
    scored: result.leads.length,
    high,
    medium,
    low,
    criteria_used: result.criteria_used,
  });
}

// ── GET — list scored leads ────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const campaignId = params.id;

  // Verify ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const rankFilter = searchParams.get('rank');
  const limit = parseInt(searchParams.get('limit') ?? '100', 10);
  const offset = parseInt(searchParams.get('offset') ?? '0', 10);

  let query = supabase
    .from('campaign_leads')
    .select('*', { count: 'exact' })
    .eq('campaign_id', campaignId)
    .order('score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (rankFilter && ['high', 'medium', 'low'].includes(rankFilter)) {
    query = query.eq('rank', rankFilter);
  }

  const { data: leads, error: queryError, count } = await query;

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  // Count by rank (always full counts regardless of filter)
  const { data: countData } = await supabase
    .from('campaign_leads')
    .select('rank')
    .eq('campaign_id', campaignId);

  const by_rank = { high: 0, medium: 0, low: 0 };
  for (const row of countData ?? []) {
    const effectiveRank = (row as { rank: string }).rank as 'high' | 'medium' | 'low';
    if (effectiveRank in by_rank) by_rank[effectiveRank]++;
  }

  return NextResponse.json({
    leads: leads ?? [],
    total: count ?? 0,
    by_rank,
  });
}
