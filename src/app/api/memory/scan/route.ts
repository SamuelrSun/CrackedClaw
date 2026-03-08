import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { scanGoogleData } from '@/lib/memory/scanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST() {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  try {
    const result = await scanGoogleData(user.id);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
