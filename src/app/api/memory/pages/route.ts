import { requireApiAuth, jsonResponse } from '@/lib/api-auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = await createClient();
  const { data } = await supabase
    .from('memories')
    .select('domain, metadata, updated_at')
    .eq('user_id', user.id);

  const pageMap = new Map<string, { count: number; lastUpdated: string }>();
  for (const m of data || []) {
    const meta = m.metadata as Record<string, unknown> | null;
    const path = (meta?.page_path as string) || `${m.domain || 'general'}/uncategorized`;
    const existing = pageMap.get(path);
    if (existing) {
      existing.count++;
      if (m.updated_at > existing.lastUpdated) existing.lastUpdated = m.updated_at;
    } else {
      pageMap.set(path, { count: 1, lastUpdated: m.updated_at });
    }
  }

  return jsonResponse({
    pages: Array.from(pageMap.entries())
      .map(([path, info]) => ({
        path,
        count: info.count,
        lastUpdated: info.lastUpdated,
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  });
}
