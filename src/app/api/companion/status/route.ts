import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const RELAY_STATUS_URL = 'https://companion.crackedclaw.com/api/companion/status';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch relay status from companion server
    const relayRes = await fetch(RELAY_STATUS_URL, {
      next: { revalidate: 0 },
    }).catch(() => null);

    if (!relayRes || !relayRes.ok) {
      return NextResponse.json({ connected: false, error: 'Relay unavailable' });
    }

    const status = await relayRes.json();
    const orgId = user.user_metadata?.org_id || user.id;
    const connected = status.connected?.includes(orgId) ?? false;

    return NextResponse.json({ connected, token: orgId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
