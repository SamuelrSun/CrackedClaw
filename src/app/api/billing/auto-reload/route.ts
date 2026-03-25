/**
 * POST /api/billing/auto-reload
 * Configure auto-reload settings for the wallet.
 * When balance drops below threshold, automatically charge saved payment method.
 *
 * GET: Return current auto-reload settings
 * POST: Update auto-reload settings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

const MIN_AMOUNT = 5;
const MAX_AMOUNT = 500;
const MIN_THRESHOLD = 1;

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('auto_reload_enabled, auto_reload_amount, auto_reload_threshold')
    .eq('id', user.id)
    .single();

  return NextResponse.json({
    enabled: profile?.auto_reload_enabled ?? false,
    amount: profile?.auto_reload_amount ? Number(profile.auto_reload_amount) : null,
    threshold: profile?.auto_reload_threshold ? Number(profile.auto_reload_threshold) : null,
  });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  let body: { enabled?: boolean; amount?: number; threshold?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // If disabling, just flip the flag
  if (body.enabled === false) {
    await supabase
      .from('profiles')
      .update({ auto_reload_enabled: false })
      .eq('id', user.id);
    return NextResponse.json({ success: true, enabled: false });
  }

  // Enabling — validate amount and threshold
  const amount = Number(body.amount);
  const threshold = Number(body.threshold);

  if (!amount || amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
    return NextResponse.json(
      { error: `Reload amount must be between $${MIN_AMOUNT} and $${MAX_AMOUNT}` },
      { status: 400 }
    );
  }

  if (!threshold || threshold < MIN_THRESHOLD) {
    return NextResponse.json(
      { error: `Threshold must be at least $${MIN_THRESHOLD}` },
      { status: 400 }
    );
  }

  // Check that user has a saved payment method (must have made at least one payment)
  const { data: profile } = await supabase
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json(
      { error: 'Please add funds at least once before enabling auto-reload' },
      { status: 400 }
    );
  }

  await supabase
    .from('profiles')
    .update({
      auto_reload_enabled: true,
      auto_reload_amount: amount,
      auto_reload_threshold: threshold,
    })
    .eq('id', user.id);

  return NextResponse.json({
    success: true,
    enabled: true,
    amount,
    threshold,
  });
}
