/**
 * Dataset upload/connect/retrieve endpoint.
 * POST — upload CSV or connect Google Sheet URL
 * GET  — retrieve parsed dataset
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { parseCSV, toCSVExportUrl, detectUrlColumns } from '@/lib/outreach/dataset-parser';
import { logAction } from '@/lib/outreach/log-action';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ─── GET — retrieve dataset ───────────────────────────────────────────────────

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

    // Fetch the latest dataset for this campaign
    const { data: dataset } = await supabase
      .from('campaign_datasets')
      .select('*')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!dataset) {
      return NextResponse.json({ dataset: null });
    }

    // Auto-detect url_columns if empty
    const dbUrlColumns: string[] = Array.isArray(dataset.url_columns) ? dataset.url_columns : [];
    const dbColumns: string[] = Array.isArray(dataset.columns) ? dataset.columns : [];
    const urlColumns = dbUrlColumns.length > 0 ? dbUrlColumns : detectUrlColumns(dbColumns);
    const enrichedRows = Array.isArray(dataset.enriched_rows) ? dataset.enriched_rows : [];

    return NextResponse.json({
      dataset: {
        id: dataset.id,
        source_type: dataset.source_type,
        source_url: dataset.source_url,
        source_name: dataset.source_name,
        columns: dataset.columns,
        rows: dataset.rows,
        row_count: dataset.row_count,
        created_at: dataset.created_at,
        enriched_count: enrichedRows.length,
        url_columns: urlColumns,
        enriched_rows: enrichedRows,
      },
    });
  } catch (err) {
    console.error('Dataset GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — upload/connect dataset ───────────────────────────────────────────

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
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const contentType = request.headers.get('content-type') ?? '';
    let csvText = '';
    let sourceType: 'csv' | 'google_sheet' = 'csv';
    let sourceUrl: string | null = null;
    let sourceName: string | null = null;

    if (contentType.includes('multipart/form-data')) {
      // CSV file upload
      const formData = await request.formData();
      const file = formData.get('file');

      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      const blob = file as File;
      sourceName = blob.name;
      sourceType = 'csv';

      const buffer = await blob.arrayBuffer();
      csvText = new TextDecoder('utf-8').decode(buffer);
    } else {
      // JSON body with sheet_url
      const body = await request.json().catch(() => ({}));
      const sheetUrl = (body.sheet_url as string | undefined)?.trim();

      if (!sheetUrl) {
        return NextResponse.json({ error: 'sheet_url is required' }, { status: 400 });
      }

      const exportUrl = toCSVExportUrl(sheetUrl);
      if (!exportUrl) {
        return NextResponse.json(
          { error: 'Invalid Google Sheet URL. Make sure it includes /spreadsheets/d/{id}' },
          { status: 400 }
        );
      }

      sourceType = 'google_sheet';
      sourceUrl = sheetUrl;

      // Fetch CSV from Google Sheets
      const response = await fetch(exportUrl, {
        headers: { Accept: 'text/csv' },
        redirect: 'follow',
      });

      if (!response.ok) {
        return NextResponse.json(
          {
            error:
              'Could not fetch Google Sheet. Make sure the sheet is publicly accessible (Share → Anyone with the link).',
          },
          { status: 400 }
        );
      }

      csvText = await response.text();

      // Extract sheet name from URL if possible
      const titleMatch = csvText.match(/<title>([^<]+)<\/title>/i);
      sourceName = titleMatch ? titleMatch[1] : 'Google Sheet';
    }

    if (!csvText.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 });
    }

    // Parse CSV
    const parsed = parseCSV(csvText);

    if (parsed.columns.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse CSV — no columns found. Check the file format.' },
        { status: 400 }
      );
    }

    // Store in Supabase (upsert — replace existing dataset for this campaign)
    const { data: existing } = await supabase
      .from('campaign_datasets')
      .select('id')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let datasetId: string;

    if (existing) {
      const { data: updated, error } = await supabase
        .from('campaign_datasets')
        .update({
          source_type: sourceType,
          source_url: sourceUrl,
          source_name: sourceName,
          columns: parsed.columns,
          rows: parsed.rows,
          row_count: parsed.row_count,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error || !updated) {
        console.error('Dataset update error:', error);
        return NextResponse.json({ error: 'Failed to save dataset' }, { status: 500 });
      }
      datasetId = updated.id;
    } else {
      const { data: inserted, error } = await supabase
        .from('campaign_datasets')
        .insert({
          campaign_id: params.id,
          source_type: sourceType,
          source_url: sourceUrl,
          source_name: sourceName,
          columns: parsed.columns,
          rows: parsed.rows,
          row_count: parsed.row_count,
        })
        .select()
        .single();

      if (error || !inserted) {
        console.error('Dataset insert error:', error);
        return NextResponse.json({ error: 'Failed to save dataset' }, { status: 500 });
      }
      datasetId = inserted.id;
    }

    // Update campaign config with dataset metadata
    const currentConfig = (campaign.config as Record<string, unknown>) || {};
    await supabase
      .from('campaigns')
      .update({
        config: {
          ...currentConfig,
          data_source_type: sourceType,
          sheet_url: sourceUrl,
          source_name: sourceName,
          row_count: parsed.row_count,
          columns: parsed.columns,
          dataset_id: datasetId,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.id);

    const sampleRows = parsed.rows.slice(0, 5);

    // Log dataset connection
    await logAction(params.id, user.id, 'dataset_connected', {
      source_name: sourceName,
      row_count: parsed.row_count,
      source_type: sourceType,
    });

    return NextResponse.json({
      success: true,
      row_count: parsed.row_count,
      columns: parsed.columns,
      sample_rows: sampleRows,
      source_type: sourceType,
      source_name: sourceName,
    });
  } catch (err) {
    console.error('Dataset POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
