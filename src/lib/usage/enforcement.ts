import { checkWalletBalance } from './wallet';

export interface TokenLimitResult {
  allowed: boolean;
  reason?: string;
  balance?: number;
  usage: {
    dailyUsedPercent: number;
    weeklyUsedPercent: number;
  };
}

/**
 * Check if a user is allowed to send a message.
 * Now backed by wallet balance (PAYGO) instead of credit limits.
 * 
 * The usage percentages are kept for backward compat but are
 * meaningless in PAYGO — always return 0.
 */
export async function checkTokenLimit(userId: string): Promise<TokenLimitResult> {
  try {
    const { allowed, reason, balance } = await checkWalletBalance(userId);

    return {
      allowed,
      reason,
      balance,
      usage: {
        dailyUsedPercent: 0,
        weeklyUsedPercent: 0,
      },
    };
  } catch (err) {
    console.error('Token limit check failed:', err);
    // Fail open — don't block users on infra errors
    return {
      allowed: true,
      usage: { dailyUsedPercent: 0, weeklyUsedPercent: 0 },
    };
  }
}
