/**
 * Stripe SDK client — SERVER-ONLY. Never import this from "use client" components.
 * For plan definitions, import from '@/lib/plans' instead.
 *
 * Note: Stripe handles pro-rating automatically with `proration_behavior: 'create_prorations'`
 * when upgrading/downgrading subscriptions mid-cycle.
 */
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-02-25.clover',
});

// Re-export plan helpers for server-side code convenience
export { PLANS, getPlanBySlug, getTokenLimit, tokensToCredits, creditsToTokens, ALL_FEATURES, TOKENS_PER_CREDIT } from '@/lib/plans';
export type { PlanSlug } from '@/lib/plans';

// Price ID lookup (server-only, uses env vars)
export const PRICE_IDS: Record<string, string> = {
  starter: process.env.STRIPE_STARTER_PRICE_ID || process.env.STRIPE_PRICE_STARTER || '',
  pro: process.env.STRIPE_PRO_PRICE_ID || process.env.STRIPE_PRICE_PRO || '',
  power: process.env.STRIPE_POWER_PRICE_ID || process.env.STRIPE_PRICE_POWER || '',
  ultra: process.env.STRIPE_ULTRA_PRICE_ID || process.env.STRIPE_PRICE_ULTRA || '',
};

// Alias for callers that use STRIPE_PRICES naming convention
export const STRIPE_PRICES = PRICE_IDS;

export function getPriceId(planSlug: string): string | undefined {
  return PRICE_IDS[planSlug];
}
