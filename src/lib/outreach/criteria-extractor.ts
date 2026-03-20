/**
 * Criteria extractor — uses Claude to pull structured criteria from a conversation.
 */

import type { CriteriaModel } from './criteria-engine';

const EXTRACTION_SYSTEM = `You are analyzing a conversation where a user describes who they're looking for (leads, contacts, candidates).
Extract every stated and implied criterion as structured data.

For each criterion, identify:
- id: short kebab-case identifier
- category: the dimension (industry, seniority, education, activity, company-size, location, etc.)
- description: what the user wants in plain language
- importance: 0-1 based on how much emphasis the user placed on this
- source: "user_stated" if they said it directly, "agent_discovered" if you inferred it
- thresholds: if applicable, the spectrum of values (e.g. "Ivy (0.9) > State school (0.3)")
- interaction_effects: conditional rules (e.g. "if school_tier < 0.5 then require experience > 5yr")

Also extract:
- anti_patterns: types of people/companies to exclude
- notes: overall context about the search purpose

Return ONLY valid JSON matching this schema:
{
  "version": 1,
  "criteria": [...],
  "anti_patterns": [...],
  "notes": "..."
}`;

export async function extractCriteriaFromConversation(
  messages: Array<{ role: string; content: string }>,
  campaignSlug: string = 'unknown',
  options?: { description?: string; datasetSummary?: string }
): Promise<CriteriaModel> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Build input from all available context: description, dataset, and conversation
  const parts: string[] = [];

  if (options?.description) {
    parts.push(`USER'S DESCRIPTION OF WHO THEY'RE LOOKING FOR:\n${options.description}`);
  }

  if (options?.datasetSummary) {
    parts.push(`CONNECTED DATASET (existing leads the user already selected — reverse-engineer patterns):\n${options.datasetSummary}`);
  }

  if (messages.length > 0) {
    const convoText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');
    parts.push(`CONVERSATION:\n${convoText}`);
  }

  const userContent = parts.length > 0
    ? parts.join('\n\n---\n\n')
    : 'No context available.';

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: EXTRACTION_SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      version: 1,
      campaign_slug: campaignSlug,
      criteria: [],
      anti_patterns: [],
      notes: 'No criteria extracted.',
      updated_at: new Date().toISOString(),
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    version: parsed.version ?? 1,
    campaign_slug: campaignSlug,
    criteria: parsed.criteria ?? [],
    anti_patterns: parsed.anti_patterns ?? [],
    notes: parsed.notes ?? '',
    updated_at: new Date().toISOString(),
  };
}
