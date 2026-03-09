import { createAdminClient } from '@/lib/supabase/admin';

export async function getIntegrationToken(userId: string, provider: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'connected')
    .single();
  return data?.access_token || null;
}
