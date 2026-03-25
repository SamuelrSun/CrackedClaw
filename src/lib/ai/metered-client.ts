/**
 * Metered Anthropic client — wraps messages.create() to log usage to usage_ledger.
 *
 * Two modes:
 * - meteredChat(): For chat calls — logs with charged=true, deducts from wallet
 * - meteredBackground(): For background calls — logs with charged=false (absorbed by Dopl)
 *
 * Both return the original Anthropic response unchanged.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming } from '@anthropic-ai/sdk/resources/messages';
import { createClient } from '@supabase/supabase-js';
import { calculateUserCost, calculateRawCost, getProvider } from '@/lib/usage/pricing';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface MeteredOptions {
  userId: string;
  source: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Make an Anthropic messages.create() call and log usage to the ledger.
 * For background calls only (charged=false, cost absorbed by Dopl).
 */
export async function meteredBackground(
  params: MessageCreateParamsNonStreaming,
  options: MeteredOptions
): Promise<Anthropic.Message> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const response = await client.messages.create(params);

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = calculateRawCost(params.model, inputTokens, outputTokens);

  // Fire-and-forget ledger insert
  supabaseAdmin
    .from('usage_ledger')
    .insert({
      user_id: options.userId,
      model: params.model,
      provider: getProvider(params.model),
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      charged: false,
      source: options.source,
      conversation_id: options.conversationId || null,
      metadata: options.metadata || {},
    })
    .then(({ error }) => {
      if (error) console.error('[metered] Failed to log usage:', error.message);
    })
    .catch((err) => {
      console.error('[metered] Failed to log usage:', err);
    });

  return response;
}

/**
 * Log a chat call's usage to the ledger with charged=true.
 * Called from the chat stream handler AFTER the response completes,
 * since streaming means we don't have usage until the end.
 *
 * Returns the cost in USD that was charged.
 */
export async function logChatUsage(options: {
  userId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  conversationId?: string;
}): Promise<number> {
  const costUsd = calculateUserCost(options.model, options.inputTokens, options.outputTokens);

  try {
    await supabaseAdmin.from('usage_ledger').insert({
      user_id: options.userId,
      model: options.model,
      provider: getProvider(options.model),
      input_tokens: options.inputTokens,
      output_tokens: options.outputTokens,
      cost_usd: costUsd,
      charged: true,
      source: 'chat',
      conversation_id: options.conversationId || null,
      metadata: {},
    });
  } catch (err) {
    console.error('[metered] Failed to log chat usage:', err);
  }

  return costUsd;
}

/**
 * Log an embedding call to the ledger (absorbed, not charged).
 */
export async function logEmbeddingUsage(options: {
  userId: string;
  model: string;
  inputTokens: number;
}): Promise<void> {
  const costUsd = calculateRawCost(options.model, options.inputTokens, 0);

  supabaseAdmin
    .from('usage_ledger')
    .insert({
      user_id: options.userId,
      model: options.model,
      provider: 'openai',
      input_tokens: options.inputTokens,
      output_tokens: 0,
      cost_usd: costUsd,
      charged: false,
      source: 'embedding',
      metadata: {},
    })
    .then(({ error }) => {
      if (error) console.error('[metered] Failed to log embedding usage:', error.message);
    })
    .catch(() => {});
}
