import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { UsageClient } from './client';

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return <UsageClient />;
}
