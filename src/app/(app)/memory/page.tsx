import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { MemoryClient } from './client';

export const dynamic = 'force-dynamic';

export const metadata = { title: "Memory — CrackedClaw" };

export default async function MemoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/memory`);

  const { data: rawMemories } = await supabase
    .from('memories')
    .select('id, content, domain, metadata, importance, created_at, updated_at')
    .eq('user_id', user.id)
    .order('importance', { ascending: false })
    .order('updated_at', { ascending: false });

  const memories = (rawMemories || []).map((m: { id: string; content: string; domain: string; metadata: Record<string, unknown> | null; importance: number; created_at: string; updated_at: string }) => ({
    id: m.id,
    content: m.content || '',
    domain: m.domain || 'general',
    importance: m.importance || 0.5,
    source: String((m.metadata as Record<string, unknown>)?.source || 'chat'),
    page_path: ((m.metadata as Record<string, unknown>)?.page_path as string) || null,
    temporal: String((m.metadata as Record<string, unknown>)?.temporal || 'permanent'),
    created_at: m.created_at,
    updated_at: m.updated_at,
  }));

  return <MemoryClient initialMemories={memories || []} />;
}
