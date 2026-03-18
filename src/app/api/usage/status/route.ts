import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { getCreditStatus } from '@/lib/usage/credits';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const status = await getCreditStatus(user!.id);
    return NextResponse.json(status);
  } catch (err) {
    console.error('Usage status error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
