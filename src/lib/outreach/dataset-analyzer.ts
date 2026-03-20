/**
 * Dataset analyzer — multi-pass pattern discovery engine.
 * Takes a parsed dataset + existing criteria and runs LLM-based analysis
 * to discover implicit patterns and refine existing criteria.
 */

import type { Criterion, CriteriaModel } from './criteria-engine';
import { summarizeDataset, type ParsedDataset, type DatasetSummary } from './dataset-parser';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisFinding {
  criterion_id?: string;
  category: string;
  description: string;
  evidence: string;
  prevalence?: number;
  suggested_importance: number;
  source: 'agent_discovered';
  is_new: boolean;
}

export interface AnalysisPass {
  pass_number: number;
  pass_name: string;
  findings: AnalysisFinding[];
}

export interface AnalysisReport {
  passes: AnalysisPass[];
  refined_criteria: Criterion[];
  new_criteria: Criterion[];
  anti_patterns: string[];
  summary: string;
  scanned_rows: number;
  scanned_columns: number;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a dataset pattern analyzer for a lead qualification system.

The user has a dataset of leads/contacts they've previously selected. Your job is to analyze the dataset and discover patterns that reveal the user's implicit selection criteria.

IMPORTANT — URL COLUMN HANDLING:
If a column contains URLs (especially LinkedIn URLs, Twitter/X URLs, GitHub URLs, or personal website URLs):
- These are REFERENCES to profiles, not data to analyze statistically
- Do NOT report "all leads lack LinkedIn data" — the URLs ARE the LinkedIn data
- These URLs could be enriched by visiting them to extract full profile details
- Treat URL columns as identity/reference columns and focus analysis on what other data IS available
- If the dataset is primarily URLs with minimal other fields, flag it as a "URL-reference dataset" and recommend enrichment as the primary next step rather than trying to find statistical patterns in limited fields
- Example correct summary: "Dataset contains 19 LinkedIn profile URLs. Recommend enrichment to extract professional details (title, company, skills) before scoring leads."

You will receive:
1. A statistical summary of the dataset (columns, value distributions, sample rows)
2. Any existing criteria the user has already stated (may be empty)

Run these analysis passes:

PASS 1 — UNIVERSALS (>80% prevalence): What's true of almost all entries?
PASS 2 — STRONG PATTERNS (50-80% prevalence): Important but flexible criteria
PASS 3 — DISTRIBUTIONS: Within each dimension, what's the spread? (e.g., 60% Ivy, 30% UC, 10% other)
PASS 4 — ABSENCES: What types are completely missing? These are implicit exclusion criteria.
PASS 5 — CORRELATIONS: Which criteria interact? (e.g., junior people are all at top companies)

For each finding, specify:
- criterion_id: (optional) the id of an existing criterion this refines, or omit if new
- category: the dimension category (industry, seniority, education, location, company-size, activity, etc.)
- description: what the pattern reveals in plain language
- evidence: counts and percentages backing this up (e.g. "85/100 leads match this")
- prevalence: a number 0-1 representing how common this is
- suggested_importance: a number 0-1 for how important this criterion should be
- source: always "agent_discovered"
- is_new: true if not linked to existing criterion, false if refining one

Also compare against existing criteria:
- Which stated criteria are CONFIRMED by the data?
- Which stated criteria should have adjusted importance weights?
- What new patterns were discovered?

Return ONLY valid JSON in this exact schema:
{
  "passes": [
    {
      "pass_number": 1,
      "pass_name": "Universals",
      "findings": [
        {
          "criterion_id": "optional-existing-id",
          "category": "location",
          "description": "Almost all leads are US-based",
          "evidence": "92/100 leads have US location",
          "prevalence": 0.92,
          "suggested_importance": 0.9,
          "source": "agent_discovered",
          "is_new": true
        }
      ]
    }
  ],
  "refined_criteria": [
    {
      "id": "existing-criterion-id",
      "category": "...",
      "description": "...",
      "importance": 0.85,
      "source": "refined",
      "thresholds": "...",
      "interaction_effects": []
    }
  ],
  "new_criteria": [
    {
      "id": "new-kebab-id",
      "category": "...",
      "description": "...",
      "importance": 0.8,
      "source": "agent_discovered",
      "thresholds": "...",
      "interaction_effects": []
    }
  ],
  "anti_patterns": ["Pattern to exclude..."],
  "summary": "A 2-3 sentence human-readable summary of key findings."
}`;

// ─── Main analyzer function ───────────────────────────────────────────────────

export async function analyzeDataset(
  dataset: ParsedDataset,
  existingCriteria: CriteriaModel | null,
  userDescription?: string
): Promise<AnalysisReport> {
  // Step 1: Compute statistical summary
  const summary: DatasetSummary = summarizeDataset(dataset);

  // Step 2: Build the prompt
  const descriptionSection = userDescription
    ? `\n\nUSER'S DESCRIPTION OF WHO THEY'RE LOOKING FOR:\n${userDescription}\n\nUse this context to understand WHY these leads were selected and what patterns matter most.`
    : '';

  const criteriaSection = existingCriteria && existingCriteria.criteria.length > 0
    ? `\n\nEXISTING CRITERIA (from user conversation):\n${JSON.stringify(existingCriteria.criteria, null, 2)}\n\nEXISTING ANTI-PATTERNS:\n${JSON.stringify(existingCriteria.anti_patterns, null, 2)}`
    : '\n\nNo existing criteria — discover everything from scratch.';

  const summaryText = formatSummaryForPrompt(summary);

  const userMessage = `DATASET STATISTICAL SUMMARY:\n${summaryText}${descriptionSection}${criteriaSection}\n\nPlease run all 5 analysis passes and return the JSON report.`;

  // Step 3: Call Claude
  const Anthropic = (await import('@anthropic-ai/sdk')).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: ANALYSIS_SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    // Return empty report on parse failure
    return {
      passes: [],
      refined_criteria: [],
      new_criteria: [],
      anti_patterns: [],
      summary: 'Analysis could not be completed. Please try again.',
      scanned_rows: dataset.row_count,
      scanned_columns: dataset.columns.length,
    };
  }

  let parsed: Partial<AnalysisReport>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return {
      passes: [],
      refined_criteria: [],
      new_criteria: [],
      anti_patterns: [],
      summary: 'Analysis response could not be parsed. Please try again.',
      scanned_rows: dataset.row_count,
      scanned_columns: dataset.columns.length,
    };
  }

  // Ensure source field is correct on all new criteria
  const newCriteria = (parsed.new_criteria ?? []).map((c) => ({
    ...c,
    source: 'agent_discovered' as const,
  }));

  const refinedCriteria = (parsed.refined_criteria ?? []).map((c) => ({
    ...c,
    source: 'refined' as const,
  }));

  return {
    passes: parsed.passes ?? [],
    refined_criteria: refinedCriteria,
    new_criteria: newCriteria,
    anti_patterns: parsed.anti_patterns ?? [],
    summary: parsed.summary ?? 'Analysis complete.',
    scanned_rows: dataset.row_count,
    scanned_columns: dataset.columns.length,
  };
}

// ─── Helper: Format summary for prompt ───────────────────────────────────────

function formatSummaryForPrompt(summary: DatasetSummary): string {
  const lines: string[] = [
    `Total rows: ${summary.row_count}`,
    `Columns (${summary.column_count}): ${summary.columns.map((c) => c.column).join(', ')}`,
    '',
    'Column statistics:',
  ];

  for (const col of summary.columns) {
    lines.push(`\n  [${col.column}]`);
    lines.push(`    Unique values: ${col.unique_count}`);
    lines.push(`    Null/empty: ${col.null_count} (${(col.null_rate * 100).toFixed(1)}%)`);
    if (col.top_values.length > 0) {
      lines.push(`    Top values:`);
      for (const tv of col.top_values) {
        lines.push(`      "${tv.value}": ${tv.count} occurrences`);
      }
    }
  }

  lines.push('');
  lines.push(`Sample rows (${summary.sample_rows.length} diverse samples):`);
  for (let i = 0; i < summary.sample_rows.length; i++) {
    lines.push(`  Row ${i + 1}: ${JSON.stringify(summary.sample_rows[i])}`);
  }

  return lines.join('\n');
}
