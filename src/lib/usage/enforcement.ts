import { checkCreditLimit } from './credits';

export interface TokenLimitResult {
  allowed: boolean;
  reason?: string;
  usage: {
    monthly: number;
    monthlyLimit: number;
  };
}

export async function checkTokenLimit(userId: string): Promise<TokenLimitResult> {
  try {
    const { allowed, reason, status } = await checkCreditLimit(userId);

    return {
      allowed,
      reason,
      usage: {
        monthly: status.totalUsedThisMonth,
        monthlyLimit: status.daily.limit * 30 + status.monthly.poolLimit,
      },
    };
  } catch (err) {
    console.error('Token limit check failed:', err);
    return {
      allowed: true,
      usage: { monthly: 0, monthlyLimit: 999 },
    };
  }
}
