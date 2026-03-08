import { createAdminClient } from '@/lib/supabase/admin';

export async function incrementUsage(userId: string, tokens = 0, toolCalls = 0): Promise<void> {
  try {
    const supabase = createAdminClient();
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase.rpc('increment_usage', {
      p_user_id: userId,
      p_date: today,
      p_messages: 1,
      p_tokens: tokens,
      p_tool_calls: toolCalls,
    });

    if (error) {
      // Fallback: upsert manually
      await supabase.from('user_usage').upsert(
        {
          user_id: userId,
          date: today,
          messages_sent: 1,
          tokens_used: tokens,
          tool_calls: toolCalls,
        },
        { onConflict: 'user_id,date' }
      );
    }
  } catch {
    // Swallow errors — usage tracking is non-critical
  }
}
