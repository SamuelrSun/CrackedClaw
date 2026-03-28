import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { hasMatonApiKey } from '@/lib/integrations/maton-key';

export const dynamic = 'force-dynamic';

export async function GET() {
  // Direct OAuth is no longer supported — all services go through Maton
  const configured: string[] = [];

  // Check per-user Maton API key
  let hasMatonKey = !!process.env.MATON_API_KEY;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const userHasKey = await hasMatonApiKey(user.id);
      hasMatonKey = hasMatonKey || userHasKey;
    }
  } catch {
    // Fail silently
  }

  return NextResponse.json({ providers: configured, hasMatonKey });
}
