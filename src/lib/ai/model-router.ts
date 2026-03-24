/**
 * Central model router — maps task types to cost-effective models.
 *
 * Routing philosophy:
 * - Extraction/classification/synthesis → Haiku (cheap, fast, structured output)
 * - Analysis/generation → Sonnet (needs nuance and quality)
 * - Coding/complex reasoning → Opus (precision, depth)
 * - Chat → User's selected model (default Sonnet)
 */

export type TaskType =
  | 'chat'           // Main conversation — user's choice
  | 'extraction'     // Fact extraction, session summaries, data parsing
  | 'classification' // Domain classification, signal analysis, intent detection
  | 'synthesis'      // Brain criteria synthesis, pattern aggregation
  | 'analysis'       // Lead scoring, feedback analysis, correlations
  | 'generation'     // Template generation, email drafts, content creation
  | 'coding'         // Code generation, technical implementation
  | 'reasoning';     // Complex multi-step reasoning, planning

const TASK_MODEL_MAP: Record<TaskType, string> = {
  extraction:     'claude-haiku-4-20250514',
  classification: 'claude-haiku-4-20250514',
  synthesis:      'claude-haiku-4-20250514',
  analysis:       'claude-sonnet-4-20250514',
  generation:     'claude-sonnet-4-20250514',
  coding:         'claude-sonnet-4-20250514', // Sonnet for most coding; Opus only if user selects
  reasoning:      'claude-sonnet-4-20250514',
  chat:           'claude-sonnet-4-20250514', // Default; overridden by user selection
};

/**
 * Get the recommended model for a task type.
 * For 'chat', pass userModel to respect user selection.
 */
export function getModelForTask(task: TaskType, userModel?: string): string {
  if (task === 'chat' && userModel) return userModel;
  return TASK_MODEL_MAP[task];
}

/**
 * Model cost tiers for reference:
 * - Haiku:  input $0.80/MTok, output $4/MTok   (cheapest)
 * - Sonnet: input $3/MTok,    output $15/MTok   (balanced)
 * - Opus:   input $15/MTok,   output $75/MTok   (premium)
 *
 * Haiku is ~4x cheaper than Sonnet for input, ~4x cheaper for output.
 * Using Haiku for extraction/classification saves ~75% per call.
 */
