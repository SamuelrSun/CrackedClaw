/**
 * Dataset scan endpoint — triggers multi-pass pattern analysis.
 * POST — run scan on connected dataset
 * GET  — retrieve cached scan report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { analyzeDataset } from '@/lib/outreach/dataset-analyzer';
import { loadCriteria, saveCriteria, updateCriterion } from '@/lib/outreach/criteria-store';
import type { ParsedDataset } from '@/lib/outreach/dataset-parser';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

// ─── GET — get cached scan report ────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const config = (campaign.config as Record<string, unknown>) || {};
    const report = config.scan_report ?? null;

    return NextResponse.json({ report });
  } catch (err) {
    console.error('Scan GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — trigger scan ──────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Load dataset
    const { data: datasetRow } = await supabase
      .from('campaign_datasets')
      .select('*')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!datasetRow) {
      return NextResponse.json(
        { error: 'No dataset connected. Upload a CSV or connect a Google Sheet first.' },
        { status: 400 }
      );
    }

    const dataset: ParsedDataset = {
      columns: datasetRow.columns as string[],
      rows: datasetRow.rows as Array<Record<string, string>>,
      row_count: datasetRow.row_count,
    };

    // Mark campaign as scanning
    const currentConfig = (campaign.config as Record<string, unknown>) || {};
    await supabase
      .from('campaigns')
      .update({
        status: 'scanning',
        config: { ...currentConfig, scan_started_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    // Load user's description from request body if provided
    let userDescription: string | undefined;
    try {
      const body = await request.json();
      userDescription = body.description;
    } catch { /* no body */ }

    // Load existing criteria
    const existingCriteria = await loadCriteria(user.id, campaign.slug);

    // Run analysis with user's description for context
    const report = await analyzeDataset(dataset, existingCriteria, userDescription);

    // Save refined criteria
    if (report.refined_criteria.length > 0) {
      for (const criterion of report.refined_criteria) {
        await updateCriterion(user.id, campaign.slug, criterion.id, {
          importance: criterion.importance,
          source: 'refined',
          thresholds: criterion.thresholds,
          interaction_effects: criterion.interaction_effects,
        });
      }
    }

    // Save new criteria
    if (report.new_criteria.length > 0 || report.anti_patterns.length > 0) {
      const newModel = {
        version: (existingCriteria?.version ?? 0) + 1,
        campaign_slug: campaign.slug,
        criteria: report.new_criteria,
        anti_patterns: report.anti_patterns,
        notes: `Discovered via dataset scan on ${new Date().toLocaleDateString()}`,
        updated_at: new Date().toISOString(),
      };
      await saveCriteria(user.id, campaign.slug, newModel);
    }

    // Update campaign: mark active, cache report
    await supabase
      .from('campaigns')
      .update({
        status: 'active',
        config: {
          ...currentConfig,
          scan_report: report,
          scan_completed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    return NextResponse.json({ report });
  } catch (err) {
    console.error('Scan POST error:', err);

    // Revert status on failure
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('campaigns')
          .update({ status: 'setup', updated_at: new Date().toISOString() })
          .eq('id', params.id)
          .eq('user_id', user.id);
      }
    } catch {
      // ignore revert error
    }

    return NextResponse.json({ error: 'Scan failed. Please try again.' }, { status: 500 });
  }
}
