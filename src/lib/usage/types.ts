/**
 * Shared types for the credit system.
 * Safe to import from both client and server components.
 */

export interface CreditStatus {
  plan: string;
  planName: string;
  isTrial: boolean;
  daily: {
    usedPercent: number;   // 0-100
    remaining: number;     // raw credits remaining
    limit: number;         // daily cap
    resetsAt: string;      // ISO timestamp for next reset
  };
  weekly: {
    usedPercent: number;   // 0-100
    remaining: number;
    limit: number;
    resetsAt: string;
  };
  // For the UI bars — these are the main things shown
  allowed: boolean;
  upgradeNeeded: boolean;
  reason?: string;
  nextResetLabel?: string; // human-readable: "Resets tomorrow at midnight" or "Resets Monday"
}
