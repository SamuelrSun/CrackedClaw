/**
 * Phase 4 — Agent-driven lead discovery endpoint.
 *
 * POST  /api/outreach/campaigns/[id]/discover  — write agent-discovered leads
 * GET   /api/outreach/campaigns/[id]/discover  — discovery status / stats
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/api-auth';
import { logAction } from '@/lib/outreach/log-action';

export const dynamic = 'force-dynamic';

// ── Shared types ──────────────────────────────────────────────────────────────

interface CriterionScore {
  criterion_id: string;
  category: string;
  score: number;
  weight: number;
  weighted_score: number;
  evidence: string;
}

interface DiscoverLeadInput {
  name: string;
  profile_url?: string | null;
  profile_data?: Record<string, string | null | undefined>;
  score?: number;
  rank: 'high' | 'medium' | 'low';
  reasoning?: string;
  criterion_scores?: CriterionScore[];
  source?: string;
  discovery_method?: string;
}

interface DiscoverBody {
  leads: DiscoverLeadInput[];
  batch_id?: string;
}

// ── POST — write agent-discovered leads ───────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const campaignId = params.id;

  // Verify campaign ownership
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  let body: DiscoverBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { leads } = body;

  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: 'leads array is required and must not be empty' }, { status: 400 });
  }

  // Validate ranks
  const validRanks = new Set(['high', 'medium', 'low']);
  for (const lead of leads) {
    if (!validRanks.has(lead.rank)) {
      return NextResponse.json(
        { error: `Invalid rank "${lead.rank}" — must be high, medium, or low` },
        { status: 400 }
      );
    }
  }

  // Check which discovery_method column exists (handle gracefully)
  let hasDiscoveryMethod = true;
  try {
    const { error: colErr } = await supabase
      .from('campaign_leads')
      .select('discovery_method')
      .eq('campaign_id', campaignId)
      .limit(1);
    if (colErr && colErr.message.includes('discovery_method')) {
      hasDiscoveryMethod = false;
    }
  } catch {
    hasDiscoveryMethod = false;
  }

  // Fetch existing profile_urls for this campaign (for deduplication)
  const { data: existingRows } = await supabase
    .from('campaign_leads')
    .select('profile_url')
    .eq('campaign_id', campaignId)
    .not('profile_url', 'is', null);

  const existingUrls = new Set(
    (existingRows ?? [])
      .map((r: { profile_url: string | null }) => r.profile_url)
      .filter(Boolean) as string[]
  );

  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;

  for (const lead of leads) {
    // Deduplicate by profile_url (skip if URL already exists; always insert if URL is null/empty)
    if (lead.profile_url) {
      if (existingUrls.has(lead.profile_url)) {
        skipped++;
        continue;
      }
      existingUrls.add(lead.profile_url); // prevent dups within the same batch
    }

    const row: Record<string, unknown> = {
      campaign_id: campaignId,
      name: lead.name,
      profile_url: lead.profile_url ?? null,
      profile_data: lead.profile_data ?? {},
      rank: lead.rank,
      score: lead.score ?? 0,
      criterion_scores: lead.criterion_scores ?? [],
      reasoning: lead.reasoning ?? null,
      source: lead.source ?? 'agent_discovery',
      scored_at: new Date().toISOString(),
      approval_status: 'pending',
    };

    if (hasDiscoveryMethod) {
      row.discovery_method = lead.discovery_method ?? null;
    }

    toInsert.push(row);
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, skipped, leads: [] });
  }

  const { data: inserted, error: insertError } = await supabase
    .from('campaign_leads')
    .insert(toInsert)
    .select('id, name, rank');

  if (insertError) {
    console.error('Discover insert error:', insertError);
    return NextResponse.json(
      { error: 'Failed to save leads: ' + insertError.message },
      { status: 500 }
    );
  }

  const insertedCount = inserted?.length ?? 0;

  // Log lead discovery
  const highCount = (inserted ?? []).filter((l: { rank: string }) => l.rank === 'high').length;
  const discoveryMethod = toInsert[0]?.discovery_method as string | undefined ?? 'agent';
  await logAction(campaignId, user!.id, 'lead_discovered', {
    count: insertedCount,
    method: discoveryMethod,
    high_count: highCount,
  });

  return NextResponse.json({
    inserted: insertedCount,
    skipped,
    leads: inserted ?? [],
  });
}

// ── GET — discovery status ────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const campaignId = params.id;
  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status'); // e.g. 'pending'

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

  // If status=pending, return pending leads with full data
  if (statusFilter === 'pending') {
    const { data: pendingLeads, error: pendingErr } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('source', 'agent_discovery')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false });

    if (pendingErr) {
      return NextResponse.json({ error: pendingErr.message }, { status: 500 });
    }

    return NextResponse.json({ leads: pendingLeads ?? [], total: pendingLeads?.length ?? 0 });
  }

  // Fetch all leads for stats
  const { data: allLeads, error: queryError } = await supabase
    .from('campaign_leads')
    .select('id, name, rank, source, created_at')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 500 });
  }

  const leads = allLeads ?? [];
  const total = leads.length;

  // Count by source
  const bySource: Record<string, number> = {};
  for (const l of leads) {
    const src: string = (l as { source?: string }).source ?? 'dataset';
    bySource[src] = (bySource[src] ?? 0) + 1;
  }

  // Count by rank
  const byRank = { high: 0, medium: 0, low: 0 };
  for (const l of leads) {
    const rank = (l as { rank: string }).rank as 'high' | 'medium' | 'low';
    if (rank in byRank) byRank[rank]++;
  }

  // Recent agent-discovered leads (last 10)
  const recentDiscoveries = leads
    .filter((l) => (l as { source?: string }).source === 'agent_discovery')
    .slice(0, 10)
    .map((l) => ({
      id: (l as { id: string }).id,
      name: (l as { name: string }).name,
      rank: (l as { rank: string }).rank,
      source: (l as { source?: string }).source ?? 'agent_discovery',
      created_at: (l as { created_at: string }).created_at,
    }));

  return NextResponse.json({
    total_leads: total,
    by_source: {
      dataset: bySource['dataset'] ?? 0,
      agent_discovery: bySource['agent_discovery'] ?? 0,
      ...bySource,
    },
    by_rank: byRank,
    recent_discoveries: recentDiscoveries,
  });
}
