import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { BrainLandingPage } from '@/components/brain/landing-page';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Your AI Brain — Dopl',
  description: 'Build a personal AI brain that learns from your conversations and works with Claude Code, Cursor, VS Code, ChatGPT, and more.',
};

export default async function GetBrainPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Already signed in → go to the brain tab inside the app
  if (user) redirect('/brain');

  return <BrainLandingPage />;
}
