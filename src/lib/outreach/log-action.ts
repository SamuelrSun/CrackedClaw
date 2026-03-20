import { createClient } from '@/lib/supabase/server';

/**
 * Non-critical logging helper — writes a campaign activity log entry.
 * Never throws; errors are swallowed so they don't affect the main request.
 */
export async function logAction(
  campaignId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('campaign_logs').insert({
      campaign_id: campaignId,
      user_id: userId,
      action,
      details,
    });
  } catch {
    // Non-critical — never throw
  }
}
