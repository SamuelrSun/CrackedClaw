import { NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/api-auth';
import { getWalletStatus, getTodaySpend, getSpendBreakdown } from '@/lib/usage/wallet';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const [wallet, todaySpend, breakdown] = await Promise.all([
      getWalletStatus(user!.id),
      getTodaySpend(user!.id),
      getSpendBreakdown(user!.id),
    ]);

    return NextResponse.json({
      balance_usd: wallet.balance,
      total_deposited_usd: wallet.totalDeposited,
      total_spent_usd: wallet.totalSpent,
      today_spent_usd: todaySpend,
      allowed: wallet.allowed,
      reason: wallet.reason,
      auto_reload: wallet.autoReload,
      breakdown,
    });
  } catch (err) {
    console.error('Usage status error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
