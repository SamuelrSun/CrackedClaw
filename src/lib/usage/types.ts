/**
 * Shared types for the credit system.
 * Safe to import from both client and server components.
 */

export interface CreditStatus {
  plan: string;
  isTrial: boolean;
  daily: {
    usedPercent: number;   // 0-100
    remaining: number;     // raw credits remaining (for internal use)
    limit: number;         // daily cap (0 = unlimited for trial)
    resetsAt: string;
  };
  weekly: {
    usedPercent: number;   // 0-100
    remaining: number;
    limit: number;
    resetsAt: string;
  };
  trial: {
    total: number;         // 10
    remaining: number;     // how many left
    usedPercent: number;   // 0-100
    exhausted: boolean;
  };
  // For the UI bars — these are the main things shown
  allowed: boolean;
  upgradeNeeded: boolean;
  reason?: string;
}
