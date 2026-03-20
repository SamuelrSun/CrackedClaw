/**
 * Campaign Workflows API
 *
 * GET    — list all workflows for a campaign
 * POST   — create or update a workflow (upsert by campaign_id + name)
 * DELETE — delete a workflow by ?workflow_id=<id>
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { WorkflowStep, WorkflowType } from '@/lib/outreach/workflow-types';

export const dynamic = 'force-dynamic';

// ─── GET — list workflows ─────────────────────────────────────────────────────

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

    const { data: workflows, error } = await supabase
      .from('campaign_workflows')
      .select('*')
      .eq('campaign_id', params.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching workflows:', error);
      return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 });
    }

    return NextResponse.json({ workflows: workflows ?? [] });
  } catch (err) {
    console.error('Workflows GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — create or update workflow ────────────────────────────────────────

interface WorkflowPostBody {
  name: string;
  type: WorkflowType;
  steps: WorkflowStep[];
  linked_criteria: string[];
  source: 'user_stated' | 'agent_inferred';
}

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
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const body = (await request.json()) as WorkflowPostBody;
    const { name, type, steps, linked_criteria, source } = body;

    if (!name || !type) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 });
    }

    const validTypes: WorkflowType[] = ['discovery', 'enrichment', 'outreach', 'custom'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ error: 'Invalid workflow type' }, { status: 400 });
    }

    // Check if workflow with this name already exists for this campaign
    const { data: existing } = await supabase
      .from('campaign_workflows')
      .select('id')
      .eq('campaign_id', params.id)
      .eq('name', name)
      .single();

    let result;
    if (existing) {
      // Update existing
      const { data, error } = await supabase
        .from('campaign_workflows')
        .update({
          type,
          steps: steps ?? [],
          linked_criteria: linked_criteria ?? [],
          source: source ?? 'agent_inferred',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Insert new
      const { data, error } = await supabase
        .from('campaign_workflows')
        .insert({
          campaign_id: params.id,
          name,
          type,
          steps: steps ?? [],
          linked_criteria: linked_criteria ?? [],
          source: source ?? 'agent_inferred',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    return NextResponse.json({ workflow: result });
  } catch (err) {
    console.error('Workflows POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE — delete a workflow ───────────────────────────────────────────────

export async function DELETE(
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
      .select('id')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single();

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const workflowId = url.searchParams.get('workflow_id');

    if (!workflowId) {
      return NextResponse.json({ error: 'workflow_id query param required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('campaign_workflows')
      .delete()
      .eq('id', workflowId)
      .eq('campaign_id', params.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Workflows DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
