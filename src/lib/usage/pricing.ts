/**
 * Token pricing — maps models to per-token USD costs.
 *
 * MARGIN_MULTIPLIER is applied to user-facing (chat) costs only.
 * Background costs (memory, brain, embeddings) are absorbed by Dopl.
 */

// 10% markup on chat costs — covers Stripe fees + slim margin
export const MARGIN_MULTIPLIER = 1.10;

// Raw Anthropic/OpenAI rates (per token, not per MTok)
export const RAW_TOKEN_RATES: Record<string, { input: number; output: number }> = {
  // Anthropic Claude
  'claude-haiku-4':           { input: 0.0000008,  output: 0.000004   },
  'claude-haiku-4-20250514':  { input: 0.0000008,  output: 0.000004   },
  'claude-sonnet-4':          { input: 0.000003,   output: 0.000015   },
  'claude-sonnet-4-20250514': { input: 0.000003,   output: 0.000015   },
  'claude-opus-4':            { input: 0.000015,   output: 0.000075   },
  'claude-opus-4-20250514':   { input: 0.000015,   output: 0.000075   },
  // OpenAI embeddings (absorbed, never charged to user)
  'text-embedding-3-small':   { input: 0.00000002, output: 0          },
};

/**
 * Normalize model names to match rate table.
 * Gateway may return short names like 'claude-sonnet-4' or full like 'claude-sonnet-4-20250514'.
 */
function normalizeModel(model: string): string {
  // Try exact match first
  if (RAW_TOKEN_RATES[model]) return model;
  // Try base name (strip date suffix)
  const base = model.replace(/-\d{8}$/, '');
  if (RAW_TOKEN_RATES[base]) return base;
  // Default to sonnet
  return 'claude-sonnet-4';
}

/**
 * What the USER pays per chat message (raw cost × 1.10 margin).
 */
export function calculateUserCost(model: string, inputTokens: number, outputTokens: number): number {
  const normalized = normalizeModel(model);
  const rates = RAW_TOKEN_RATES[normalized];
  return ((inputTokens * rates.input) + (outputTokens * rates.output)) * MARGIN_MULTIPLIER;
}

/**
 * What Dopl actually pays (raw API cost, no margin).
 * Used for internal cost tracking on background calls.
 */
export function calculateRawCost(model: string, inputTokens: number, outputTokens: number): number {
  const normalized = normalizeModel(model);
  const rates = RAW_TOKEN_RATES[normalized];
  return (inputTokens * rates.input) + (outputTokens * rates.output);
}

/**
 * Get the provider for a model name.
 */
export function getProvider(model: string): string {
  if (model.startsWith('text-embedding') || model.startsWith('gpt')) return 'openai';
  return 'anthropic';
}
