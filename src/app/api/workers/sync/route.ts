import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';
import { getUserInstance } from '@/lib/gateway/openclaw-proxy';

export const dynamic = 'force-dynamic';

// POST /api/workers/sync — sync worker status from OpenClaw gateway cron jobs
export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const instance = await getUserInstance(user.id);
  if (!instance) return jsonResponse({ synced: 0, message: 'No gateway instance' });

  const supabase = await createClient();

  // Get all workers with cron_job_ids
  const { data: workers } = await supabase
    .from('workers')
    .select('id, cron_job_id, status')
    .eq('user_id', user.id)
    .not('cron_job_id', 'is', null);

  if (!workers || workers.length === 0) return jsonResponse({ synced: 0 });

  // Query gateway for cron job list
  const gatewayBase =
    instance.port === 443
      ? `https://${instance.host}`
      : `http://${instance.host}:${instance.port}`;

  let cronJobs: Array<{
    jobId: string;
    enabled: boolean;
    lastRun?: { status: string; endedAt?: string; summary?: string };
  }> = [];

  try {
    const res = await fetch(`${gatewayBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + instance.gatewayToken,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'Run tool: cron list. Return the raw JSON result only, no commentary.' }],
        model: 'claude-sonnet-4',
        stream: false,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        cronJobs = JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('Gateway cron sync failed:', err);
    return jsonResponse({ synced: 0, error: 'Gateway unreachable' });
  }

  // Update workers based on cron status
  let synced = 0;
  for (const worker of workers) {
    const cronJob = cronJobs.find((j) => j.jobId === worker.cron_job_id);
    if (!cronJob) continue;

    const newStatus = !cronJob.enabled
      ? 'paused'
      : cronJob.lastRun?.status === 'failed'
        ? 'error'
        : 'active';

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (newStatus !== worker.status) update.status = newStatus;
    if (cronJob.lastRun?.summary) update.last_result = cronJob.lastRun.summary;
    if (cronJob.lastRun?.endedAt) update.last_active_at = cronJob.lastRun.endedAt;

    await supabase.from('workers').update(update).eq('id', worker.id);
    synced++;
  }

  return jsonResponse({ synced });
}
