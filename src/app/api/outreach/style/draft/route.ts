/**
 * POST /api/outreach/style/draft
 * Draft a personalized message for a lead using the stored style model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import {
  draftWithStyle,
  loadStyleModel,
  buildFallbackStyle,
  type StyleModel,
} from '@/lib/outreach/extract-style';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json() as {
      lead?: {
        name: string;
        title: string;
        company: string;
        profile_data: Record<string, string>;
      };
      purpose?: string;
      campaign_id?: string;
    };

    const { lead, purpose, campaign_id } = body;

    if (!lead || !lead.name) {
      return NextResponse.json(
        { error: 'lead.name is required' },
        { status: 400 }
      );
    }

    // Load style model, fall back to generic
    let style: StyleModel;
    const stored = await loadStyleModel(user!.id);
    style = stored ?? buildFallbackStyle();

    // Load campaign context if provided
    let campaignContext: string | undefined;
    if (campaign_id) {
      try {
        const supabase = await createClient();
        const { data: campaign } = await supabase
          .from('campaigns')
          .select('name, notes')
          .eq('id', campaign_id)
          .eq('user_id', user!.id)
          .single();
        if (campaign) {
          campaignContext = [campaign.name, campaign.notes].filter(Boolean).join(' — ');
        }
      } catch {
        // ignore — campaign context is optional
      }
    }

    const purposeStr = purpose ?? 'introduce and connect';
    const draft = await draftWithStyle(
      style,
      {
        name: lead.name,
        title: lead.title ?? '',
        company: lead.company ?? '',
        profile_data: lead.profile_data ?? {},
      },
      purposeStr,
      campaignContext
    );

    return NextResponse.json(draft);
  } catch (err) {
    console.error('[style/draft] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Draft generation failed' },
      { status: 500 }
    );
  }
}
