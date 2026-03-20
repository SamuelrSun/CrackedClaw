/**
 * Enrichment endpoint — read and write enriched row data for a campaign's dataset.
 *
 * GET  — returns enrichment status (total, enriched, url_columns, enriched_rows)
 * POST — accepts enriched data for one or more rows (upsert by row_index)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectUrlColumns } from '@/lib/outreach/dataset-parser';
import { logAction } from '@/lib/outreach/log-action';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── Shared types ─────────────────────────────────────────────────────────────

interface EnrichedRow {
  row_index: number;
  data: Record<string, string>;
  enriched_at: string;
}

interface DatasetRow {
  id: string;
  campaign_id: string;
  row_count: number;
  columns: string[];
  enriched_rows: EnrichedRow[];
  url_columns: string[];
}

// ─── GET — enrichment status ──────────────────────────────────────────────────

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

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    // Fetch the latest dataset
    const { data: dataset } = await supabase
      .from('campaign_datasets')
      .select('id, campaign_id, row_count, columns, enriched_rows, url_columns')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!dataset) {
      return NextResponse.json({
        total: 0,
        enriched: 0,
        url_columns: [],
        enriched_rows: [],
      });
    }

    const ds = dataset as DatasetRow;
    const enrichedRows: EnrichedRow[] = Array.isArray(ds.enriched_rows) ? ds.enriched_rows : [];
    const columns: string[] = Array.isArray(ds.columns) ? ds.columns : [];

    // Auto-detect url_columns if empty
    let urlColumns: string[] = Array.isArray(ds.url_columns) ? ds.url_columns : [];
    if (urlColumns.length === 0 && columns.length > 0) {
      urlColumns = detectUrlColumns(columns);
    }

    return NextResponse.json({
      total: ds.row_count ?? 0,
      enriched: enrichedRows.length,
      url_columns: urlColumns,
      enriched_rows: enrichedRows,
    });
  } catch (err) {
    console.error('Enrich GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — write enriched rows ───────────────────────────────────────────────

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

    // Verify campaign ownership
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, config')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const incomingRows = body.rows as Array<{ row_index: number; data: Record<string, string> }> | undefined;
    const incomingUrlColumns = body.url_columns as string[] | undefined;

    if (!Array.isArray(incomingRows) || incomingRows.length === 0) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

    // Fetch the latest dataset
    const { data: dataset } = await supabase
      .from('campaign_datasets')
      .select('id, campaign_id, row_count, columns, enriched_rows, url_columns')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!dataset) {
      return NextResponse.json({ error: 'No dataset found for this campaign' }, { status: 404 });
    }

    const ds = dataset as DatasetRow;
    const existingRows: EnrichedRow[] = Array.isArray(ds.enriched_rows) ? ds.enriched_rows : [];
    const columns: string[] = Array.isArray(ds.columns) ? ds.columns : [];

    // Build index map for fast upsert
    const rowMap = new Map<number, EnrichedRow>();
    for (const r of existingRows) {
      rowMap.set(r.row_index, r);
    }

    // Merge incoming rows (upsert by row_index)
    const now = new Date().toISOString();
    for (const incoming of incomingRows) {
      if (typeof incoming.row_index !== 'number') continue;
      rowMap.set(incoming.row_index, {
        row_index: incoming.row_index,
        data: incoming.data ?? {},
        enriched_at: now,
      });
    }

    const mergedRows = Array.from(rowMap.values()).sort((a, b) => a.row_index - b.row_index);

    // Determine url_columns
    let urlColumns: string[] = Array.isArray(ds.url_columns) ? ds.url_columns : [];
    if (incomingUrlColumns && incomingUrlColumns.length > 0) {
      urlColumns = incomingUrlColumns;
    } else if (urlColumns.length === 0 && columns.length > 0) {
      urlColumns = detectUrlColumns(columns);
    }

    // Update dataset
    const { error: updateError } = await supabase
      .from('campaign_datasets')
      .update({
        enriched_rows: mergedRows,
        url_columns: urlColumns,
        updated_at: now,
      })
      .eq('id', ds.id);

    if (updateError) {
      console.error('Enrich update error:', updateError);
      return NextResponse.json({ error: 'Failed to save enriched data' }, { status: 500 });
    }

    // Update campaigns.config with url_columns if changed
    if (incomingUrlColumns && incomingUrlColumns.length > 0) {
      const currentConfig = (campaign.config as Record<string, unknown>) ?? {};
      await supabase
        .from('campaigns')
        .update({
          config: { ...currentConfig, url_columns: urlColumns },
          updated_at: now,
        })
        .eq('id', params.id);
    }

    // Log enrichment action
    const detectedUrlColumn = urlColumns[0] ?? incomingUrlColumns?.[0] ?? 'unknown';
    await logAction(params.id, user.id, 'enrichment', {
      count: incomingRows.length,
      url_column: detectedUrlColumn,
    });

    return NextResponse.json({
      total: ds.row_count ?? 0,
      enriched: mergedRows.length,
      url_columns: urlColumns,
      enriched_rows: mergedRows,
    });
  } catch (err) {
    console.error('Enrich POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
