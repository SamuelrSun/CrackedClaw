/**
 * Extended workflow type for intent matching.
 * Extends the base Workflow with fields needed for matching.
 */
export interface MatchableWorkflow {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  trigger_phrases: string[];
}

export interface MatchResult {
  workflow: MatchableWorkflow;
  confidence: number; // 0-1
  matchedPhrase?: string;
}

/**
 * Check if a user message matches any saved workflows.
 * Uses trigger_phrases for exact/fuzzy matching.
 */
export function matchWorkflow(message: string, workflows: MatchableWorkflow[]): MatchResult | null {
  const lowerMsg = message.toLowerCase().trim();

  for (const workflow of workflows) {
    for (const phrase of workflow.trigger_phrases) {
      const lowerPhrase = phrase.toLowerCase().trim();
      // Exact match
      if (lowerMsg.includes(lowerPhrase)) {
        return { workflow, confidence: 1.0, matchedPhrase: phrase };
      }
      // Word overlap scoring
      const phraseWords = lowerPhrase.split(/\s+/);
      const msgWords = lowerMsg.split(/\s+/);
      const overlap = phraseWords.filter((w: string) => msgWords.includes(w)).length;
      const score = overlap / phraseWords.length;
      if (score >= 0.8) {
        return { workflow, confidence: score, matchedPhrase: phrase };
      }
    }
  }
  return null;
}

/**
 * Build an injected system context string for a matched workflow.
 */
export function buildWorkflowContext(workflow: MatchableWorkflow): string {
  return `[WORKFLOW CONTEXT]
The user wants to run a saved workflow: "${workflow.name}"
${workflow.description ? `Description: ${workflow.description}` : ""}

Workflow instructions:
${workflow.prompt}

Follow these instructions to help the user complete this workflow. Ask clarifying questions if needed before proceeding.
[END WORKFLOW CONTEXT]`;
}
