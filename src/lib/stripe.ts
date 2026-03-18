/**
 * Stripe SDK client — SERVER-ONLY. Never import this from "use client" components.
 * For plan definitions, import from '@/lib/plans' instead.
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
  starter: process.env.STRIPE_STARTER_PRICE_ID || '',
  pro: process.env.STRIPE_PRO_PRICE_ID || '',
  power: process.env.STRIPE_POWER_PRICE_ID || '',
};

export function getPriceId(planSlug: string): string | undefined {
  return PRICE_IDS[planSlug];
}
