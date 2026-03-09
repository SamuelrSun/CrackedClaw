import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MemoryClient } from './client';

export const dynamic = 'force-dynamic';

export const metadata = { title: "Memory — CrackedClaw" };

export default async function MemoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/memory`);

  const { data: memories } = await supabase
    .from('user_memory')
    .select('*')
    .eq('user_id', user.id)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false });

  return <MemoryClient initialMemories={memories || []} />;
}
