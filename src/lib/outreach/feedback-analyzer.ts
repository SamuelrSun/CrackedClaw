/**
 * Feedback analyzer — analyzes user corrections to improve the criteria model.
 */

import type { Criterion, CriteriaModel } from './criteria-engine';

export interface FeedbackEntry {
  lead_name: string;
  ai_rank: string;
  user_rank: string;
  user_feedback: string | null;
  profile_data: Record<string, string>;
}

export interface FeedbackAnalysis {
  adjustments: CriterionAdjustment[];
  new_criteria: Criterion[];
  removed_anti_patterns: string[];
  new_anti_patterns: string[];
  summary: string;
}

export interface CriterionAdjustment {
  criterion_id: string;
  old_importance: number;
  new_importance: number;
  reason: string;
}

export async function analyzeFeedback(
  feedbackEntries: FeedbackEntry[],
  currentCriteria: CriteriaModel
): Promise<FeedbackAnalysis> {
  if (feedbackEntries.length < 3) {
    return {
      adjustments: [],
      new_criteria: [],
      removed_anti_patterns: [],
      new_anti_patterns: [],
      summary: 'Not enough corrections to suggest changes (need at least 3).',
    };
  }

  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const criteriaJson = JSON.stringify(currentCriteria, null, 2);

  const correctionsList = feedbackEntries
    .map((entry, i) => {
      const profileSummary = Object.entries(entry.profile_data)
        .filter(([, v]) => v && v.trim())
        .slice(0, 5)
        .map(([k, v]) => `  ${k}: ${v}`)
        .join('\n');
      return [
        `Correction ${i + 1}: ${entry.lead_name}`,
        `  AI rank: ${entry.ai_rank} → User rank: ${entry.user_rank}`,
        entry.user_feedback ? `  User feedback: "${entry.user_feedback}"` : '',
        `  Profile:`,
        profileSummary,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const systemPrompt = `You are analyzing user corrections to an AI lead scoring system to improve the criteria model.

CURRENT CRITERIA MODEL:
${criteriaJson}

USER CORRECTIONS:
The user manually changed these lead rankings. For each, the AI assigned a rank but the user overrode it.
${correctionsList}

Analyze the corrections to identify:
1. WEIGHT ADJUSTMENTS: Which criteria should be weighted more/less? If the user keeps upgrading leads that scored low on a criterion, that criterion may be over-weighted.
2. NEW CRITERIA: Are there patterns in the user's corrections that suggest criteria not yet captured?
3. ANTI-PATTERN CHANGES: Should any exclusion rules be added or removed?
4. INTERACTION EFFECTS: Are there new conditional rules suggested by the corrections?

Be conservative — only suggest changes with clear evidence from multiple corrections.
Do NOT create hard rules from single corrections. Treat each as a soft signal.

Return ONLY a JSON object with this exact structure:
{
  "adjustments": [
    {
      "criterion_id": "school-tier",
      "old_importance": 0.7,
      "new_importance": 0.5,
      "reason": "User upgraded 3 leads from non-top schools, suggesting school matters less than initially stated"
    }
  ],
  "new_criteria": [],
  "removed_anti_patterns": [],
  "new_anti_patterns": [],
  "summary": "Human-readable summary of what changed and why"
}

If there are no changes to suggest, return empty arrays and explain why in the summary.`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Analyze these ${feedbackEntries.length} user corrections and suggest criteria improvements.`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '{}';

  // Extract JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.warn('FeedbackAnalyzer: no JSON found in response');
    return {
      adjustments: [],
      new_criteria: [],
      removed_anti_patterns: [],
      new_anti_patterns: [],
      summary: 'Analysis failed to return structured results.',
    };
  }

  try {
    const parsed = JSON.parse(match[0]) as FeedbackAnalysis;
    // Validate and sanitize adjustments
    const validatedAdjustments = (parsed.adjustments ?? []).filter((adj) => {
      const criterion = currentCriteria.criteria.find(
        (c) => c.id === adj.criterion_id
      );
      return criterion !== undefined;
    }).map((adj) => ({
      ...adj,
      old_importance: currentCriteria.criteria.find(
        (c) => c.id === adj.criterion_id
      )!.importance,
      new_importance: Math.max(0, Math.min(1, adj.new_importance)),
    }));

    return {
      adjustments: validatedAdjustments,
      new_criteria: parsed.new_criteria ?? [],
      removed_anti_patterns: parsed.removed_anti_patterns ?? [],
      new_anti_patterns: parsed.new_anti_patterns ?? [],
      summary: parsed.summary ?? 'Analysis complete.',
    };
  } catch {
    console.warn('FeedbackAnalyzer: failed to parse JSON response');
    return {
      adjustments: [],
      new_criteria: [],
      removed_anti_patterns: [],
      new_anti_patterns: [],
      summary: 'Analysis failed to parse results.',
    };
  }
}
