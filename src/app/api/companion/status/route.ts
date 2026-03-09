import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const RELAY_STATUS_URL = 'http://127.0.0.1:3201/status';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch relay status
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
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
