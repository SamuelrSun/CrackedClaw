import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { runScopedScan } from '@/lib/ingestion/engine';

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
    const insights = await runScopedScan(user.id, provider, scope as 'full' | 'quick');

    const summary = [
      `Scanned ${insights.meta.emailsScanned} emails and ${insights.meta.eventsScanned} calendar events.`,
      insights.topics.length > 0 ? `Top topics: ${insights.topics.slice(0, 5).join(', ')}.` : '',
      `Writing style: ${insights.writingStyle.tone}, avg ${insights.writingStyle.avgLength} words/email.`,
      insights.schedulePatterns.busiestDays.length > 0
        ? `Busiest days: ${insights.schedulePatterns.busiestDays.join(', ')}, ~${insights.schedulePatterns.avgMeetingsPerWeek} meetings/week.`
        : '',
      insights.automationOpportunities.length > 0
        ? `Found ${insights.automationOpportunities.length} automation opportunities.`
        : '',
    ].filter(Boolean).join(' ');

    return NextResponse.json({ insights, summary, memoriesSaved: true });
  } catch (err) {
    console.error('Ingestion scan error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
