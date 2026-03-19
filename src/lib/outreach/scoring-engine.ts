/**
 * Lead scoring engine — scores leads against a criteria model using Claude.
 */

import type { CriteriaModel } from './criteria-engine';
import type { DatasetRow } from './dataset-parser';
import { createClient } from '@/lib/supabase/server';
import { loadCriteria } from './criteria-store';
import { parseCSV } from './dataset-parser';

export interface CriterionScore {
  criterion_id: string;
  category: string;
  score: number;        // 0-1
  weight: number;       // criterion importance (0-1)
  weighted_score: number;
  evidence: string;
}

export interface LeadScore {
  lead_id: string;
  name: string;
  profile_url?: string;
  profile_data: Record<string, string>;
  rank: 'high' | 'medium' | 'low';
  score: number;        // 0-100 aggregate
  criterion_scores: CriterionScore[];
  reasoning: string;
  scored_at: string;
}

export interface ScoringResult {
  leads: LeadScore[];
  scoring_model_version: number;
  criteria_used: number;
  scored_at: string;
}

// ── Claude batch scoring ──────────────────────────────────────────────────────

interface ClaudeLeadResult {
  lead_index: number;
  criterion_scores: Array<{
    criterion_id: string;
    score: number;
    evidence: string;
  }>;
  reasoning: string;
}

async function scoreBatch(
  leads: DatasetRow[],
  criteria: CriteriaModel,
  batchOffset: number
): Promise<ClaudeLeadResult[]> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const criteriaJson = JSON.stringify(
    criteria.criteria.map((c) => ({
      id: c.id,
      category: c.category,
      description: c.description,
      importance: c.importance,
      thresholds: c.thresholds,
      interaction_effects: c.interaction_effects,
    })),
    null,
    2
  );

  const antiPatternsText =
    criteria.anti_patterns.length > 0
      ? criteria.anti_patterns.map((ap) => `- ${ap}`).join('\n')
      : '(none)';

  const systemPrompt = `You are a lead qualification scoring engine. You have a criteria model that defines what makes a good lead, and a batch of candidate leads to evaluate.

CRITERIA MODEL:
${criteriaJson}

ANTI-PATTERNS (exclude if matched):
${antiPatternsText}

For each lead, evaluate against EVERY criterion and provide:
1. A score (0-1) for how well they match each criterion
2. Brief evidence for the score
3. Overall reasoning

Return JSON array:
[
  {
    "lead_index": 0,
    "criterion_scores": [
      {
        "criterion_id": "school-tier",
        "score": 0.9,
        "evidence": "Stanford — top-tier university"
      }
    ],
    "reasoning": "Strong match — top school, active poster, relevant industry experience. Slight gap on company size (startup vs. enterprise preference)."
  }
]

Be nuanced. Consider interaction effects from the criteria model. A lead might score low on one criterion but compensate on another. Return ONLY the JSON array, no other text.`;

  const leadsText = leads
    .map(
      (lead, i) =>
        `Lead ${batchOffset + i}:\n${Object.entries(lead)
          .filter(([, v]) => v && v.trim())
          .map(([k, v]) => `  ${k}: ${v}`)
          .join('\n')}`
    )
    .join('\n\n');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Score these ${leads.length} leads:\n\n${leadsText}`,
      },
    ],
  });

  const text =
    response.content[0].type === 'text' ? response.content[0].text : '[]';

  // Extract JSON array
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn('Scoring: no JSON array found in response');
    return [];
  }

  try {
    return JSON.parse(match[0]) as ClaudeLeadResult[];
  } catch {
    console.warn('Scoring: failed to parse JSON response');
    return [];
  }
}

// ── Name detection ────────────────────────────────────────────────────────────

function extractName(row: DatasetRow): string {
  // Try common name columns
  const nameCols = [
    'name', 'full name', 'full_name', 'display_name', 'displayname',
    'person name', 'person_name', 'contact name', 'contact_name',
  ];
  for (const col of nameCols) {
    if (row[col] && row[col].trim()) return row[col].trim();
  }

  // Try first + last
  const firstCols = ['first name', 'first_name', 'fname', 'first'];
  const lastCols = ['last name', 'last_name', 'lname', 'last', 'surname'];
  let first = '';
  let last = '';
  for (const col of firstCols) {
    if (row[col] && row[col].trim()) { first = row[col].trim(); break; }
  }
  for (const col of lastCols) {
    if (row[col] && row[col].trim()) { last = row[col].trim(); break; }
  }
  if (first || last) return [first, last].filter(Boolean).join(' ');

  // Fallback: first non-empty value
  const firstVal = Object.values(row).find((v) => v && v.trim());
  return firstVal?.trim() ?? 'Unknown';
}

function extractProfileUrl(row: DatasetRow): string | undefined {
  const urlCols = [
    'linkedin', 'linkedin_url', 'li_url', 'profile_url', 'profileurl',
    'linkedin url', 'profile url', 'url', 'link',
  ];
  for (const col of urlCols) {
    if (row[col] && row[col].includes('linkedin.com')) return row[col].trim();
  }
  for (const col of urlCols) {
    if (row[col] && row[col].startsWith('http')) return row[col].trim();
  }
  return undefined;
}

// ── Score aggregation ─────────────────────────────────────────────────────────

function aggregateScore(
  criterionScores: CriterionScore[],
  criteria: CriteriaModel
): number {
  if (criterionScores.length === 0) return 0;

  const totalWeight = criterionScores.reduce((sum, cs) => sum + cs.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedSum = criterionScores.reduce(
    (sum, cs) => sum + cs.weighted_score,
    0
  );

  return Math.round((weightedSum / totalWeight) * 100);
}

function mapRank(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scoreLeads(
  leads: DatasetRow[],
  criteria: CriteriaModel,
  options?: { batchSize?: number }
): Promise<ScoringResult> {
  const batchSize = options?.batchSize ?? 10;
  const scoredAt = new Date().toISOString();
  const results: LeadScore[] = [];

  // Process in batches
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);

    let batchResults: ClaudeLeadResult[] = [];
    try {
      batchResults = await scoreBatch(batch, criteria, i);
    } catch (err) {
      console.error(`Scoring batch ${i}-${i + batchSize} failed:`, err);
      // Continue with empty results for this batch
    }

    for (let j = 0; j < batch.length; j++) {
      const row = batch[j];
      const claudeResult = batchResults.find((r) => r.lead_index === i + j);

      const criterionScores: CriterionScore[] = criteria.criteria.map((criterion) => {
        const found = claudeResult?.criterion_scores.find(
          (cs) => cs.criterion_id === criterion.id
        );
        const score = found?.score ?? 0;
        const weight = criterion.importance;
        return {
          criterion_id: criterion.id,
          category: criterion.category,
          score,
          weight,
          weighted_score: score * weight,
          evidence: found?.evidence ?? '(not evaluated)',
        };
      });

      const aggregated = aggregateScore(criterionScores, criteria);

      results.push({
        lead_id: crypto.randomUUID(),
        name: extractName(row),
        profile_url: extractProfileUrl(row),
        profile_data: row as Record<string, string>,
        rank: mapRank(aggregated),
        score: aggregated,
        criterion_scores: criterionScores,
        reasoning: claudeResult?.reasoning ?? '',
        scored_at: scoredAt,
      });
    }
  }

  return {
    leads: results,
    scoring_model_version: criteria.version,
    criteria_used: criteria.criteria.length,
    scored_at: scoredAt,
  };
}

export async function scoreExistingDataset(
  campaignId: string,
  userId: string
): Promise<ScoringResult> {
  const supabase = await createClient();

  // Load campaign to get slug
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('slug')
    .eq('id', campaignId)
    .single();

  if (!campaign) throw new Error('Campaign not found');

  // Load criteria
  const criteria = await loadCriteria(userId, campaign.slug);
  if (!criteria || criteria.criteria.length === 0) {
    throw new Error('No criteria found for this campaign');
  }

  // Load dataset
  const { data: datasetRow } = await supabase
    .from('campaign_datasets')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!datasetRow) throw new Error('No dataset found for this campaign');

  let rows: DatasetRow[] = [];

  if (datasetRow.raw_csv) {
    const parsed = parseCSV(datasetRow.raw_csv);
    rows = parsed.rows;
  } else if (datasetRow.rows) {
    rows = datasetRow.rows as DatasetRow[];
  }

  if (rows.length === 0) throw new Error('Dataset is empty');

  return scoreLeads(rows, criteria);
}
