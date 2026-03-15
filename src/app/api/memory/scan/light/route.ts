/**
 * POST /api/memory/scan/light
 * Lightweight auto-scan triggered after integration OAuth completes.
 * Called server-to-server — authenticated via SUPABASE_SERVICE_ROLE_KEY.
 * Returns 202 immediately; scan runs synchronously (caller fire-and-forgets).
 */

import { NextRequest, NextResponse } from 'next/server';
import { lightScan } from '@/lib/memory/scanner';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Validate auth: must present service role key
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!serviceRoleKey || token !== serviceRoleKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { userId?: string; provider?: string; accountId?: string; accountEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { userId, provider, accountId, accountEmail } = body;

  if (!userId || !provider) {
    return NextResponse.json({ error: 'userId and provider are required' }, { status: 400 });
  }

  // Return 202 immediately — scan runs after
  // Since this is fire-and-forget from caller, we can do the work synchronously
  // but the important thing is never to throw/crash
  const response = NextResponse.json({ status: 'accepted' }, { status: 202 });

  // Run scan in background (Promise not awaited at route level)
  Promise.resolve().then(async () => {
    try {
      const result = await lightScan(userId, provider, accountEmail, accountId);
      console.log(`[scan/light] Completed for user=${userId} provider=${provider}: ${result.memoriesCreated} memories created`);

      // Notify: update MEMORY_CONTEXT.md on the instance + push summary to conversation
      const notifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://usedopl.com'}/api/memory/scan/notify`;
      fetch(notifyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          provider,
          memoriesCreated: result.memoriesCreated,
          summary: `Scanned ${provider}. Found ${result.memoriesCreated} key facts.`,
        }),
      }).catch(err => console.error('[scan/light] Failed to notify:', err));
    } catch (err) {
      console.error('[scan/light] Unexpected error:', err);
    }
  });

  return response;
}
