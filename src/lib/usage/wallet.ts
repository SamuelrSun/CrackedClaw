/**
 * Wallet system — prepaid USD balance for pay-as-you-go billing.
 * Replaces the credit/plan-based system.
 *
 * Users deposit money, chat deducts exact cost (with 10% margin).
 * Background AI (memory, brain, embeddings) is absorbed by Dopl.
 */

import { createAdminClient } from '@/lib/supabase/admin';

export interface WalletStatus {
  balance: number;          // Current balance in USD
  totalDeposited: number;   // Lifetime deposits
  totalSpent: number;       // Lifetime spend
  allowed: boolean;         // Can the user send messages?
  reason?: string;          // Why blocked (if not allowed)
  autoReload: {
    enabled: boolean;
    amount: number | null;
    threshold: number | null;
  };
}

/**
 * Get the user's wallet status.
 */
export async function getWalletStatus(userId: string): Promise<WalletStatus> {
  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('balance_usd, total_deposited_usd, total_spent_usd, auto_reload_enabled, auto_reload_amount, auto_reload_threshold')
    .eq('id', userId)
    .single();

  const balance = Number(profile?.balance_usd ?? 0);
  const totalDeposited = Number(profile?.total_deposited_usd ?? 0);
  const totalSpent = Number(profile?.total_spent_usd ?? 0);
  const allowed = balance > 0;

  return {
    balance,
    totalDeposited,
    totalSpent,
    allowed,
    reason: allowed ? undefined : 'Your balance is $0.00. Add funds to continue chatting.',
    autoReload: {
      enabled: profile?.auto_reload_enabled ?? false,
      amount: profile?.auto_reload_amount ? Number(profile.auto_reload_amount) : null,
      threshold: profile?.auto_reload_threshold ? Number(profile.auto_reload_threshold) : null,
    },
  };
}

/**
 * Check if a user can send a message (balance > 0).
 * Drop-in replacement for checkCreditLimit().
 */
export async function checkWalletBalance(userId: string): Promise<{
  allowed: boolean;
  reason?: string;
  balance: number;
}> {
  const status = await getWalletStatus(userId);
  return {
    allowed: status.allowed,
    reason: status.reason,
    balance: status.balance,
  };
}

/**
 * Deduct cost from user's wallet. Called after a chat message completes.
 * Returns the new balance, or -1 if insufficient funds.
 *
 * Note: We deduct AFTER the call completes because we don't know
 * output token count until the response finishes streaming.
 */
export async function deductFromWallet(userId: string, amount: number): Promise<number> {
  if (amount <= 0) return 0;

  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('deduct_balance', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error('[wallet] Deduction failed:', error.message);
    return -1;
  }

  return Number(data);
}

/**
 * Add funds to a user's wallet (called after Stripe payment succeeds).
 * Also records the transaction in wallet_transactions.
 */
export async function addToWallet(
  userId: string,
  amount: number,
  options?: {
    type?: string;           // 'deposit' | 'stipend' | 'refund' | 'auto_reload'
    stripePaymentId?: string;
    description?: string;
  }
): Promise<number> {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('add_balance', {
    p_user_id: userId,
    p_amount: amount,
  });

  if (error) {
    console.error('[wallet] Add funds failed:', error.message);
    return -1;
  }

  // Record transaction
  await supabase.from('wallet_transactions').insert({
    user_id: userId,
    type: options?.type || 'deposit',
    amount_usd: amount,
    stripe_payment_id: options?.stripePaymentId || null,
    description: options?.description || `Added $${amount.toFixed(2)}`,
    metadata: {},
  }).then(({ error: txErr }) => {
    if (txErr) console.error('[wallet] Failed to record transaction:', txErr.message);
  });

  return Number(data);
}

/**
 * Grant the $5 welcome stipend for new signups.
 */
export async function grantWelcomeStipend(userId: string): Promise<void> {
  await addToWallet(userId, 5.00, {
    type: 'stipend',
    description: 'Welcome bonus',
  });
}

/**
 * Get today's spend from usage_ledger (charged=true only).
 */
export async function getTodaySpend(userId: string): Promise<number> {
  const supabase = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const { data } = await supabase
    .from('usage_ledger')
    .select('cost_usd')
    .eq('user_id', userId)
    .eq('charged', true)
    .gte('created_at', `${today}T00:00:00Z`);

  if (!data) return 0;
  return data.reduce((sum, row) => sum + Number(row.cost_usd), 0);
}

/**
 * Get spend breakdown by source for a time period.
 */
export async function getSpendBreakdown(
  userId: string,
  sinceDate?: string
): Promise<Record<string, number>> {
  const supabase = createAdminClient();
  const since = sinceDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('usage_ledger')
    .select('source, cost_usd')
    .eq('user_id', userId)
    .eq('charged', true)
    .gte('created_at', since);

  if (!data) return {};

  const breakdown: Record<string, number> = {};
  for (const row of data) {
    breakdown[row.source] = (breakdown[row.source] || 0) + Number(row.cost_usd);
  }
  return breakdown;
}
