/**
 * Criteria refinement API — analyze user corrections and update criteria model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/api-auth';
import { loadCriteria, saveCriteria, updateCriterion } from '@/lib/outreach/criteria-store';
import { analyzeFeedback } from '@/lib/outreach/feedback-analyzer';
import type { FeedbackEntry } from '@/lib/outreach/feedback-analyzer';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ── GET — feedback summary ────────────────────────────────────────────────────

export async function GET(
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
    .select('id')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Count leads with overrides
  const { data: leads } = await supabase
    .from('campaign_leads')
    .select('rank, user_override_rank')
    .eq('campaign_id', campaignId)
    .not('user_override_rank', 'is', null);

  const total_overrides = leads?.length ?? 0;
  let upgrades = 0;
  let downgrades = 0;

  const rankOrder = { high: 3, medium: 2, low: 1 };

  for (const lead of leads ?? []) {
    const ai = rankOrder[lead.rank as keyof typeof rankOrder] ?? 0;
    const user_r = rankOrder[lead.user_override_rank as keyof typeof rankOrder] ?? 0;
    if (user_r > ai) upgrades++;
    else if (user_r < ai) downgrades++;
  }

  return NextResponse.json({
    total_overrides,
    upgrades,
    downgrades,
    has_enough_for_refinement: total_overrides >= 3,
  });
}

// ── POST — trigger criteria refinement ───────────────────────────────────────

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const campaignId = params.id;

  // Verify ownership and get campaign slug
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  // Load all leads with user overrides
  const { data: overriddenLeads } = await supabase
    .from('campaign_leads')
    .select('*')
    .eq('campaign_id', campaignId)
    .not('user_override_rank', 'is', null);

  if (!overriddenLeads || overriddenLeads.length < 3) {
    return NextResponse.json(
      { error: 'Need at least 3 user corrections to refine criteria.' },
      { status: 400 }
    );
  }

  // Load current criteria
  const currentCriteria = await loadCriteria(user!.id, campaign.slug);
  if (!currentCriteria || currentCriteria.criteria.length === 0) {
    return NextResponse.json(
      { error: 'No criteria found for this campaign.' },
      { status: 400 }
    );
  }

  // Build feedback entries
  const feedbackEntries: FeedbackEntry[] = overriddenLeads.map((lead) => ({
    lead_name: lead.name as string,
    ai_rank: lead.rank as string,
    user_rank: lead.user_override_rank as string,
    user_feedback: lead.user_feedback as string | null,
    profile_data: (lead.profile_data as Record<string, string>) ?? {},
  }));

  // Analyze feedback
  let analysis;
  try {
    analysis = await analyzeFeedback(feedbackEntries, currentCriteria);
  } catch (err) {
    console.error('Feedback analysis error:', err);
    return NextResponse.json(
      { error: 'Analysis failed: ' + (err instanceof Error ? err.message : 'unknown error') },
      { status: 500 }
    );
  }

  // Apply adjustments — update each criterion
  for (const adjustment of analysis.adjustments) {
    try {
      await updateCriterion(user!.id, campaign.slug, adjustment.criterion_id, {
        importance: adjustment.new_importance,
        source: 'refined',
      });
    } catch (err) {
      console.warn(`Failed to update criterion ${adjustment.criterion_id}:`, err);
    }
  }

  // Save new criteria (new criteria + updated anti-patterns)
  if (analysis.new_criteria.length > 0 || analysis.new_anti_patterns.length > 0 || analysis.removed_anti_patterns.length > 0) {
    const updatedCriteria = { ...currentCriteria };

    // Apply new criteria
    if (analysis.new_criteria.length > 0) {
      updatedCriteria.criteria = [
        ...updatedCriteria.criteria,
        ...analysis.new_criteria,
      ];
    }

    // Update anti-patterns
    if (analysis.removed_anti_patterns.length > 0) {
      updatedCriteria.anti_patterns = updatedCriteria.anti_patterns.filter(
        (ap) => !analysis.removed_anti_patterns.some(
          (removed) => ap.toLowerCase().includes(removed.toLowerCase())
        )
      );
    }
    if (analysis.new_anti_patterns.length > 0) {
      updatedCriteria.anti_patterns = [
        ...updatedCriteria.anti_patterns,
        ...analysis.new_anti_patterns,
      ];
    }

    updatedCriteria.version = (updatedCriteria.version ?? 1) + 1;
    updatedCriteria.updated_at = new Date().toISOString();

    try {
      await saveCriteria(user!.id, campaign.slug, updatedCriteria);
    } catch (err) {
      console.warn('Failed to save updated criteria:', err);
    }
  }

  return NextResponse.json({ analysis });
}
