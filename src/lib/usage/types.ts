/**
 * Shared types for the credit system.
 * Safe to import from both client and server components.
 */

export interface CreditStatus {
  plan: string;
  daily: {
    used: number;
    limit: number;
    remaining: number;
    resetsAt: string;
  };
  monthly: {
    poolBalance: number;
    poolLimit: number;
    resetsAt: string;
  };
  welcomeGrant: {
    total: number;
    used: boolean;
    remaining: number;
  };
  totalAvailableToday: number;
  totalUsedThisMonth: number;
}
