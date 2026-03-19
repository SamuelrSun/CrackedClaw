/**
 * Outreach API — template generation and message personalization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireApiAuth } from '@/lib/api-auth';
import { loadCriteria } from '@/lib/outreach/criteria-store';
import {
  generateTemplate,
  personalizeMessage,
  personalizeMessages,
} from '@/lib/outreach/template-engine';
import type { OutreachTemplate } from '@/lib/outreach/template-engine';
import type { LeadScore } from '@/lib/outreach/scoring-engine';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// ── GET — list templates and drafts ──────────────────────────────────────────

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
    .select('id, config')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const config = (campaign.config as Record<string, unknown>) ?? {};
  const templates = (config.templates as OutreachTemplate[]) ?? [];

  // Load leads with drafts
  const { data: leads } = await supabase
    .from('campaign_leads')
    .select('id, name, draft_subject, draft_body, draft_channel')
    .eq('campaign_id', campaignId)
    .not('draft_body', 'is', null);

  const drafts = (leads ?? []).map((lead) => ({
    lead_id: lead.id,
    lead_name: lead.name,
    subject: lead.draft_subject ?? '',
    body: lead.draft_body ?? '',
    channel: lead.draft_channel ?? 'email',
    variables_filled: {},
  }));

  return NextResponse.json({ templates, drafts });
}

// ── POST — generate template or personalize messages ─────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const campaignId = params.id;

  // Verify ownership and get campaign info
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, slug, config, name')
    .eq('id', campaignId)
    .eq('user_id', user!.id)
    .single();

  if (!campaign) {
    return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string;

  // ── Action: generate_template ─────────────────────────────────────────────

  if (action === 'generate_template') {
    const channel = (body.channel as 'email' | 'linkedin') ?? 'email';

    // Load criteria
    const criteria = await loadCriteria(user!.id, campaign.slug);
    if (!criteria || criteria.criteria.length === 0) {
      return NextResponse.json(
        { error: 'No criteria found. Extract criteria first.' },
        { status: 400 }
      );
    }

    const campaignNotes = (body.notes as string) ?? (campaign.name as string) ?? '';

    let template: OutreachTemplate;
    try {
      template = await generateTemplate(criteria, campaignNotes, channel);
    } catch (err) {
      console.error('Template generation error:', err);
      return NextResponse.json(
        { error: 'Template generation failed: ' + (err instanceof Error ? err.message : 'unknown') },
        { status: 500 }
      );
    }

    // Save template to campaign config
    const config = (campaign.config as Record<string, unknown>) ?? {};
    const existingTemplates = (config.templates as OutreachTemplate[]) ?? [];
    const updatedTemplates = [...existingTemplates, template];

    await supabase
      .from('campaigns')
      .update({ config: { ...config, templates: updatedTemplates } })
      .eq('id', campaignId);

    return NextResponse.json({ template });
  }

  // ── Action: personalize ───────────────────────────────────────────────────

  if (action === 'personalize') {
    const lead_ids = (body.lead_ids as string[]) ?? [];
    const template = body.template as OutreachTemplate;

    if (!template || !template.body) {
      return NextResponse.json(
        { error: 'Template is required.' },
        { status: 400 }
      );
    }

    if (lead_ids.length === 0) {
      return NextResponse.json(
        { error: 'lead_ids is required.' },
        { status: 400 }
      );
    }

    // Load the specified leads
    const { data: leadRows } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('id', lead_ids);

    if (!leadRows || leadRows.length === 0) {
      return NextResponse.json({ error: 'No leads found.' }, { status: 404 });
    }

    const leads: LeadScore[] = leadRows.map((row) => ({
      lead_id: row.id as string,
      name: row.name as string,
      profile_url: row.profile_url as string | undefined,
      profile_data: (row.profile_data as Record<string, string>) ?? {},
      rank: row.rank as 'high' | 'medium' | 'low',
      score: row.score as number,
      criterion_scores: (row.criterion_scores as LeadScore['criterion_scores']) ?? [],
      reasoning: row.reasoning as string ?? '',
      scored_at: row.scored_at as string ?? new Date().toISOString(),
    }));

    let messages;
    try {
      messages = await personalizeMessages(template, leads);
    } catch (err) {
      console.error('Personalization error:', err);
      return NextResponse.json(
        { error: 'Personalization failed: ' + (err instanceof Error ? err.message : 'unknown') },
        { status: 500 }
      );
    }

    // Save draft messages to campaign_leads
    for (const msg of messages) {
      await supabase
        .from('campaign_leads')
        .update({
          draft_subject: msg.subject,
          draft_body: msg.body,
          draft_channel: msg.channel,
        })
        .eq('id', msg.lead_id)
        .eq('campaign_id', campaignId);
    }

    return NextResponse.json({ messages, count: messages.length });
  }

  // ── Action: personalize_all ───────────────────────────────────────────────

  if (action === 'personalize_all') {
    const template = body.template as OutreachTemplate;

    if (!template || !template.body) {
      return NextResponse.json(
        { error: 'Template is required.' },
        { status: 400 }
      );
    }

    // Load all high + medium leads
    const { data: leadRows } = await supabase
      .from('campaign_leads')
      .select('*')
      .eq('campaign_id', campaignId)
      .in('rank', ['high', 'medium'])
      .order('score', { ascending: false });

    if (!leadRows || leadRows.length === 0) {
      return NextResponse.json(
        { error: 'No high or medium leads found.' },
        { status: 404 }
      );
    }

    const leads: LeadScore[] = leadRows.map((row) => ({
      lead_id: row.id as string,
      name: row.name as string,
      profile_url: row.profile_url as string | undefined,
      profile_data: (row.profile_data as Record<string, string>) ?? {},
      rank: row.rank as 'high' | 'medium' | 'low',
      score: row.score as number,
      criterion_scores: (row.criterion_scores as LeadScore['criterion_scores']) ?? [],
      reasoning: row.reasoning as string ?? '',
      scored_at: row.scored_at as string ?? new Date().toISOString(),
    }));

    let messages;
    try {
      // Batch 5 at a time
      messages = await personalizeMessages(template, leads, { batchSize: 5 });
    } catch (err) {
      console.error('Batch personalization error:', err);
      return NextResponse.json(
        { error: 'Batch personalization failed: ' + (err instanceof Error ? err.message : 'unknown') },
        { status: 500 }
      );
    }

    // Save draft messages
    for (const msg of messages) {
      await supabase
        .from('campaign_leads')
        .update({
          draft_subject: msg.subject,
          draft_body: msg.body,
          draft_channel: msg.channel,
        })
        .eq('id', msg.lead_id)
        .eq('campaign_id', campaignId);
    }

    return NextResponse.json({ messages, count: messages.length });
  }

  return NextResponse.json(
    { error: `Unknown action: ${action}` },
    { status: 400 }
  );
}
