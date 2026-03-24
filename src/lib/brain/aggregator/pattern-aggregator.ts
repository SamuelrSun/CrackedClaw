/**
 * Pattern Aggregator — reads raw signals from brain_signals and identifies recurring patterns.
 *
 * Uses simple statistical analysis (word overlap, frequency counts) — NO LLM calls.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { AggregatedPattern, SignalEvidence, SignalRow } from './types';

const MIN_SIGNALS_FOR_PATTERN = 3; // default; lowered to 2 for new brains (no criteria yet)
const MAX_CONFIDENCE = 0.95;
const BASE_CONFIDENCE = 0.5;
const CONFIDENCE_INCREMENT = 0.1;

/**
 * Aggregate unprocessed signals into patterns for a user.
 */
export async function aggregatePatterns(userId: string): Promise<AggregatedPattern[]> {
  const supabase = createAdminClient();

  // Check if this is a new brain (no existing criteria) to use lower thresholds
  const { count: criteriaCount } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('memory_type', 'criterion')
    .is('valid_until', null);

  const isNewBrain = (criteriaCount ?? 0) === 0;
  const minSignals = isNewBrain ? 2 : MIN_SIGNALS_FOR_PATTERN;

  // 1. Fetch unprocessed signals (last 500)
  const { data: signals, error } = await supabase
    .from('brain_signals')
    .select('*')
    .eq('user_id', userId)
    .is('processed_at', null)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error || !signals || signals.length === 0) {
    return [];
  }

  const rows = signals as SignalRow[];

  // 2. Group signals by (domain, signal_type)
  const groups = new Map<string, SignalRow[]>();
  for (const signal of rows) {
    const domain = signal.domain || 'general';
    const key = `${domain}::${signal.signal_type}`;
    const group = groups.get(key) || [];
    group.push(signal);
    groups.set(key, group);
  }

  // 3. Detect patterns from each group
  const patterns: AggregatedPattern[] = [];

  for (const [key, groupSignals] of groups) {
    if (groupSignals.length < minSignals) continue;

    const [domain, signalType] = key.split('::');
    const detected = detectPatternsFromGroup(domain, signalType, groupSignals, minSignals);
    patterns.push(...detected);
  }

  // 4. Upsert patterns into brain_patterns table
  const processedSignalIds: string[] = [];

  for (const pattern of patterns) {
    await upsertPattern(supabase, userId, pattern);
    // Collect signal IDs from evidence
    for (const ev of pattern.evidence) {
      // evidence summaries include the signal ID prefix
      const match = ev.summary.match(/^\[([a-f0-9-]+)\]/);
      if (match) processedSignalIds.push(match[1]);
    }
  }

  // 5. Mark all fetched signals as processed
  const allIds = rows.map((r) => r.id);
  if (allIds.length > 0) {
    const now = new Date().toISOString();
    // Batch update in chunks of 100
    for (let i = 0; i < allIds.length; i += 100) {
      const chunk = allIds.slice(i, i + 100);
      await supabase
        .from('brain_signals')
        .update({ processed_at: now })
        .in('id', chunk);
    }
  }

  return patterns;
}

/**
 * Detect patterns from a group of signals sharing the same domain + signal_type.
 */
function detectPatternsFromGroup(
  domain: string,
  signalType: string,
  signals: SignalRow[],
  minSignals = MIN_SIGNALS_FOR_PATTERN
): AggregatedPattern[] {
  switch (signalType) {
    case 'correction':
      return detectCorrectionPatterns(domain, signals, minSignals);
    case 'edit_delta':
      return detectEditDeltaPatterns(domain, signals, minSignals);
    case 'accept':
    case 'reject':
    case 'ignore':
      return detectAcceptRejectPatterns(domain, signalType, signals, minSignals);
    case 'engagement':
      return detectEngagementPatterns(domain, signals, minSignals);
    default:
      return [];
  }
}

/**
 * Correction patterns: cluster corrections by word overlap and find recurring themes.
 */
function detectCorrectionPatterns(domain: string, signals: SignalRow[], minSignals = MIN_SIGNALS_FOR_PATTERN): AggregatedPattern[] {
  const clusters = clusterByTextSimilarity(
    signals,
    (s) => (s.signal_data.correction_text as string) || ''
  );

  const patterns: AggregatedPattern[] = [];

  for (const cluster of clusters) {
    if (cluster.length < minSignals) continue;

    const correctionTexts = cluster.map(
      (s) => (s.signal_data.correction_text as string) || ''
    );
    const commonWords = findCommonKeywords(correctionTexts);
    const description = `User repeatedly corrects AI about: ${commonWords.join(', ')} in ${domain} context`;

    patterns.push({
      domain,
      subdomain: cluster[0].subdomain || undefined,
      context: cluster[0].context || undefined,
      pattern_type: 'preference',
      description,
      evidence: cluster.map((s) => ({
        signal_type: 'correction',
        summary: `[${s.id}] Correction: "${truncate((s.signal_data.correction_text as string) || '', 80)}"`,
        created_at: s.created_at,
      })),
      occurrence_count: cluster.length,
      confidence: calcConfidence(cluster.length),
    });
  }

  return patterns;
}

/**
 * Edit delta patterns: cluster by diff_summary to find consistent editing behaviors.
 */
function detectEditDeltaPatterns(domain: string, signals: SignalRow[], minSignals = MIN_SIGNALS_FOR_PATTERN): AggregatedPattern[] {
  const clusters = clusterByTextSimilarity(
    signals,
    (s) => (s.signal_data.diff_summary as string) || ''
  );

  const patterns: AggregatedPattern[] = [];

  for (const cluster of clusters) {
    if (cluster.length < minSignals) continue;

    const summaries = cluster.map(
      (s) => (s.signal_data.diff_summary as string) || ''
    );
    const commonWords = findCommonKeywords(summaries);
    const description = `User consistently edits AI output: ${commonWords.join(', ')} in ${domain} context`;

    patterns.push({
      domain,
      subdomain: cluster[0].subdomain || undefined,
      pattern_type: 'style',
      description,
      evidence: cluster.map((s) => ({
        signal_type: 'edit_delta',
        summary: `[${s.id}] Edit: "${truncate((s.signal_data.diff_summary as string) || '', 80)}"`,
        created_at: s.created_at,
      })),
      occurrence_count: cluster.length,
      confidence: calcConfidence(cluster.length),
    });
  }

  return patterns;
}

/**
 * Accept/reject patterns: look for consistent acceptance or rejection of suggestion types.
 */
function detectAcceptRejectPatterns(
  domain: string,
  signalType: string,
  signals: SignalRow[],
  minSignals = MIN_SIGNALS_FOR_PATTERN
): AggregatedPattern[] {
  // Group by suggestion_type
  const byType = new Map<string, SignalRow[]>();
  for (const s of signals) {
    const sType = (s.signal_data.suggestion_type as string) || 'unknown';
    const group = byType.get(sType) || [];
    group.push(s);
    byType.set(sType, group);
  }

  const patterns: AggregatedPattern[] = [];

  for (const [suggestionType, group] of byType) {
    if (group.length < minSignals) continue;

    const isReject = signalType === 'reject';
    const patternType = isReject ? 'anti_pattern' : 'preference';
    const verb = isReject ? 'rejects' : signalType === 'accept' ? 'accepts' : 'ignores';
    const description = `User consistently ${verb} ${suggestionType} suggestions in ${domain} context`;

    patterns.push({
      domain,
      subdomain: group[0].subdomain || undefined,
      pattern_type: patternType,
      description,
      evidence: group.map((s) => ({
        signal_type: signalType,
        summary: `[${s.id}] ${signalType}: "${truncate((s.signal_data.suggestion_snippet as string) || '', 80)}"`,
        created_at: s.created_at,
      })),
      occurrence_count: group.length,
      confidence: calcConfidence(group.length),
    });
  }

  return patterns;
}

/**
 * Engagement patterns: detect topics with consistently high or low engagement.
 *
 * Thresholds relaxed for better first-time detection:
 *  - High engagement: avg length > 80 chars (was 150), topic_keywords optional
 *  - Topic interest: same keywords across 3+ messages regardless of length
 */
function detectEngagementPatterns(domain: string, signals: SignalRow[], minSignals = MIN_SIGNALS_FOR_PATTERN): AggregatedPattern[] {
  const patterns: AggregatedPattern[] = [];

  const lengths = signals.map((s) => (s.signal_data.message_length as number) || 0);
  const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length;

  // High engagement pattern: average message length > 80 (relaxed from 150)
  const highEngagement = signals.filter(
    (s) => ((s.signal_data.message_length as number) || 0) > 80
  );
  if (highEngagement.length >= minSignals && avgLength > 80) {
    // Collect common keywords — optional, not required
    const allKeywords = highEngagement.flatMap(
      (s) => (s.signal_data.topic_keywords as string[]) || []
    );
    const topKeywords = findTopKeywords(allKeywords, 5);

    const topicClause = topKeywords.length > 0
      ? ` on topics: ${topKeywords.join(', ')}`
      : '';

    patterns.push({
      domain,
      pattern_type: 'behavior',
      description: `User shows high engagement${topicClause} in ${domain} context`,
      evidence: highEngagement.slice(0, 10).map((s) => ({
        signal_type: 'engagement',
        summary: `[${s.id}] High engagement: ${(s.signal_data.message_length as number) || 0} chars${topKeywords.length > 0 ? ', keywords: ' + ((s.signal_data.topic_keywords as string[]) || []).join(', ') : ''}`,
        created_at: s.created_at,
      })),
      occurrence_count: highEngagement.length,
      confidence: calcConfidence(highEngagement.length),
    });
  }

  // Low engagement pattern: average message length < 30
  const lowEngagement = signals.filter(
    (s) => ((s.signal_data.message_length as number) || 0) < 30
  );
  if (lowEngagement.length >= minSignals && avgLength < 50) {
    patterns.push({
      domain,
      pattern_type: 'behavior',
      description: `User shows low engagement in ${domain} context (consistently short messages)`,
      evidence: lowEngagement.slice(0, 10).map((s) => ({
        signal_type: 'engagement',
        summary: `[${s.id}] Low engagement: ${(s.signal_data.message_length as number) || 0} chars`,
        created_at: s.created_at,
      })),
      occurrence_count: lowEngagement.length,
      confidence: calcConfidence(lowEngagement.length),
    });
  }

  // Topic interest pattern: same keywords appear across 3+ messages (regardless of length)
  const allKeywordsList = signals.flatMap(
    (s) => (s.signal_data.topic_keywords as string[]) || []
  );
  if (allKeywordsList.length > 0) {
    // Count per-signal keyword presence (not per occurrence)
    const keywordSignalCount = new Map<string, Set<string>>();
    for (const s of signals) {
      const kws = (s.signal_data.topic_keywords as string[]) || [];
      for (const kw of kws) {
        const lower = kw.toLowerCase();
        if (!keywordSignalCount.has(lower)) keywordSignalCount.set(lower, new Set());
        keywordSignalCount.get(lower)!.add(s.id);
      }
    }

    // Keywords that appear in 3+ distinct messages
    const TOPIC_INTEREST_MIN = Math.max(3, minSignals);
    const recurringKeywords = [...keywordSignalCount.entries()]
      .filter(([, signalIds]) => signalIds.size >= TOPIC_INTEREST_MIN)
      .sort((a, b) => b[1].size - a[1].size)
      .slice(0, 5)
      .map(([kw]) => kw);

    if (recurringKeywords.length > 0) {
      const topicSignals = signals.filter((s) => {
        const kws = ((s.signal_data.topic_keywords as string[]) || []).map((k) => k.toLowerCase());
        return kws.some((k) => recurringKeywords.includes(k));
      });

      patterns.push({
        domain,
        pattern_type: 'behavior',
        description: `User repeatedly discusses topics: ${recurringKeywords.join(', ')} in ${domain} context`,
        evidence: topicSignals.slice(0, 10).map((s) => ({
          signal_type: 'engagement',
          summary: `[${s.id}] Topic interest: ${((s.signal_data.topic_keywords as string[]) || []).join(', ')}`,
          created_at: s.created_at,
        })),
        occurrence_count: topicSignals.length,
        confidence: calcConfidence(topicSignals.length),
      });
    }
  }

  return patterns;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Cluster signals by text similarity using simple word overlap.
 */
function clusterByTextSimilarity(
  signals: SignalRow[],
  getText: (s: SignalRow) => string
): SignalRow[][] {
  const clusters: SignalRow[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < signals.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [signals[i]];
    assigned.add(i);
    const wordsI = extractWords(getText(signals[i]));

    for (let j = i + 1; j < signals.length; j++) {
      if (assigned.has(j)) continue;

      const wordsJ = extractWords(getText(signals[j]));
      const overlap = wordOverlap(wordsI, wordsJ);

      if (overlap >= 0.3) {
        cluster.push(signals[j]);
        assigned.add(j);
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

/**
 * Calculate word overlap ratio between two word sets (Jaccard similarity).
 */
function wordOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract lowercase meaningful words from text (skip stopwords, short words).
 */
function extractWords(text: string): Set<string> {
  const stopwords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'and', 'but', 'or', 'not', 'no', 'if', 'then',
    'than', 'that', 'this', 'it', 'its', 'i', 'me', 'my', 'we', 'you',
    'your', 'he', 'she', 'they', 'them', 'their', 'what', 'which', 'who',
  ]);

  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w))
  );
}

/**
 * Find common keywords across an array of texts.
 */
function findCommonKeywords(texts: string[]): string[] {
  const wordCounts = new Map<string, number>();
  for (const text of texts) {
    const words = extractWords(text);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Words appearing in at least half of the texts
  const threshold = Math.max(2, Math.floor(texts.length / 2));
  return [...wordCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

/**
 * Find the top N most frequent keywords from a flat array.
 */
function findTopKeywords(keywords: string[], n: number): string[] {
  const counts = new Map<string, number>();
  for (const kw of keywords) {
    const lower = kw.toLowerCase();
    if (lower.length > 2) {
      counts.set(lower, (counts.get(lower) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

/**
 * Calculate confidence from the number of supporting signals.
 */
function calcConfidence(count: number): number {
  return Math.min(MAX_CONFIDENCE, BASE_CONFIDENCE + (count - MIN_SIGNALS_FOR_PATTERN) * CONFIDENCE_INCREMENT);
}

/**
 * Truncate text to a max length.
 */
function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

/**
 * Infer the preference_type from pattern data (signal types, domain, pattern_type).
 */
function inferPreferenceType(pattern: AggregatedPattern): string {
  // Style patterns → 'style'
  if (pattern.pattern_type === 'style') return 'style';

  // Behavior patterns → 'process'
  if (pattern.pattern_type === 'behavior') return 'process';

  // Check signal types in evidence
  const signalTypes = new Set(pattern.evidence.map((e) => e.signal_type));

  // Corrections about how AI communicates → 'personality'
  if (signalTypes.has('correction') && /tone|voice|style|formal|casual|friendly|professional/i.test(pattern.description)) {
    return 'personality';
  }

  // Edit deltas → 'style' (user is editing output format/wording)
  if (signalTypes.has('edit_delta')) return 'style';

  // Domain-specific accept/reject patterns → 'criteria'
  if ((signalTypes.has('accept') || signalTypes.has('reject')) && pattern.domain !== 'general') {
    return 'criteria';
  }

  // Correction patterns in a specific domain → 'knowledge'
  if (signalTypes.has('correction') && pattern.domain !== 'general') {
    return 'knowledge';
  }

  // Default
  return 'general';
}

/**
 * Upsert a pattern into the brain_patterns table.
 * If a similar pattern already exists (same domain + similar description), merge.
 */
async function upsertPattern(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  pattern: AggregatedPattern
): Promise<void> {
  // Check for existing similar pattern
  const { data: existing } = await supabase
    .from('brain_patterns')
    .select('id, description, evidence, occurrence_count, confidence')
    .eq('user_id', userId)
    .eq('domain', pattern.domain)
    .eq('pattern_type', pattern.pattern_type)
    .eq('status', 'pending')
    .limit(20);

  // Find a matching pattern by description similarity (Jaccard > 0.3)
  let matchedRow: { id: string; description?: string; evidence: unknown[]; occurrence_count: number; confidence: number } | null = null;
  if (existing && existing.length > 0) {
    const patternWords = extractWords(pattern.description);
    let bestOverlap = 0;
    let bestRow: typeof matchedRow = null;

    for (const row of existing) {
      const typedRow = row as typeof matchedRow & { description?: string };
      const rowDescription = typedRow?.description || '';
      const rowWords = extractWords(rowDescription);
      const overlap = wordOverlap(patternWords, rowWords);

      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestRow = typedRow;
      }
    }

    // Only merge if description similarity exceeds threshold
    if (bestRow && bestOverlap > 0.3) {
      matchedRow = bestRow;
    }
  }

  if (matchedRow) {
    // Merge: increment occurrence, add evidence, bump confidence
    const existingEvidence = (matchedRow.evidence as SignalEvidence[]) || [];
    const mergedEvidence = [...existingEvidence, ...pattern.evidence].slice(-50); // Keep last 50
    const newCount = matchedRow.occurrence_count + pattern.occurrence_count;
    const newConfidence = Math.min(
      MAX_CONFIDENCE,
      matchedRow.confidence + pattern.occurrence_count * CONFIDENCE_INCREMENT
    );

    await supabase
      .from('brain_patterns')
      .update({
        evidence: mergedEvidence,
        occurrence_count: newCount,
        confidence: newConfidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchedRow.id);
  } else {
    // Insert new pattern with inferred preference_type
    const preferenceType = inferPreferenceType(pattern);
    await supabase.from('brain_patterns').insert({
      user_id: userId,
      domain: pattern.domain,
      subdomain: pattern.subdomain || null,
      context: pattern.context || null,
      pattern_type: pattern.pattern_type,
      preference_type: preferenceType,
      description: pattern.description,
      evidence: pattern.evidence,
      occurrence_count: pattern.occurrence_count,
      confidence: pattern.confidence,
    });
  }
}
