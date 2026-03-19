import { checkCreditLimit } from './credits';

export interface TokenLimitResult {
  allowed: boolean;
  reason?: string;
  usage: {
    dailyUsedPercent: number;
    weeklyUsedPercent: number;
  };
}

export async function checkTokenLimit(userId: string): Promise<TokenLimitResult> {
  try {
    const { allowed, reason, status } = await checkCreditLimit(userId);

    return {
      allowed,
      reason,
      usage: {
        dailyUsedPercent: status.daily.usedPercent,
        weeklyUsedPercent: status.weekly.usedPercent,
      },
    };
  } catch (err) {
    console.error('Token limit check failed:', err);
    return {
      allowed: true,
      usage: { dailyUsedPercent: 0, weeklyUsedPercent: 0 },
    };
  }
}
