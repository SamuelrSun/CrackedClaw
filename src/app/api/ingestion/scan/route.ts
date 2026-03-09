import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { runScopedScan, isAgentScanNeeded, isNodeScanNeeded } from '@/lib/ingestion/engine';
import { INTEGRATIONS } from '@/lib/integrations/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { provider?: string; scope?: string } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const provider = body.provider || 'google';
  const scope = body.scope === 'quick' ? 'quick' : 'full';

  // Check consent
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const supabase = createAdminClient();
  const { data: integration } = await supabase
    .from('user_integrations')
    .select('scan_consent')
    .eq('user_id', user.id)
    .eq('provider', provider)
    .single();

  if (!integration?.scan_consent) {
    return NextResponse.json(
      { error: 'User has not consented to data scanning for this provider', code: 'consent_required' },
      { status: 403 }
    );
  }

  try {
    const result = await runScopedScan(user.id, provider, scope as 'full' | 'quick');

    // ── Agent scan fallback ──────────────────────────────────────────────────
    if (isAgentScanNeeded(result)) {
      return NextResponse.json(result); // { needsAgentScan: true, provider, capabilities, authType }
    }

    // ── Node scan needed (messaging providers) ─────────────────────────────
    if (isNodeScanNeeded(result)) {
      return NextResponse.json(result); // { needsNode: true, provider, instructions, capabilities }
    }

    // ── Native scan completed ────────────────────────────────────────────────
    const { insights, metadata } = result;

    const summaryParts: string[] = [
      `Scanned ${metadata.itemsScanned} items from ${provider} in ${(metadata.timeMs / 1000).toFixed(1)}s.`,
    ];
    if (insights.topics && insights.topics.length > 0) {
      summaryParts.push(`Top topics: ${insights.topics.slice(0, 5).join(', ')}.`);
    }
    if (insights.writingStyle) {
      summaryParts.push(`Writing tone: ${insights.writingStyle.tone}.`);
    }
    if (insights.automationOpportunities && insights.automationOpportunities.length > 0) {
      summaryParts.push(`Found ${insights.automationOpportunities.length} automation opportunities.`);
    }

    return NextResponse.json({
      insights,
      summary: summaryParts.join(' '),
      memoriesSaved: true,
      provider,
      scope,
    });
  } catch (err) {
    console.error('Ingestion scan error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
