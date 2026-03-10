import { fetchGoogleData } from './fetcher-google';
import { ALL_PASSES, type PassName } from './analysis-passes';
import { correlateEntities } from './correlator';
import { mem0Write } from '@/lib/memory/mem0-client';
import { analyzeWorkflowOpportunities } from './workflow-intelligence';
import type {
  IntegrationData, AnalysisPassResult, ExtractedEntity,
  UnifiedEntity, EngineResult, ProgressCallback,
} from './types';

export async function runDeepAnalysis(
  userId: string,
  provider: string,
  apiKey: string,
  onProgress?: ProgressCallback,
): Promise<EngineResult> {
  const startTime = Date.now();

  // ── Phase 1: Fetch data ───────────────────────────────────
  onProgress?.({ phase: 'fetching', progress: 0, message: 'Connecting to ' + provider + '...' });

  let data: IntegrationData;
  if (provider === 'google') {
    data = await fetchGoogleData(userId, (msg) => {
      onProgress?.({ phase: 'fetching', progress: 20, message: msg });
    });
  } else {
    throw new Error('Provider ' + provider + ' not yet supported for deep analysis');
  }

  onProgress?.({ phase: 'fetching', progress: 100, message: 'Fetched ' + data.emails.totalSent + ' sent + ' + data.emails.totalReceived + ' received emails, ' + (data.calendar.pastEvents.length + data.calendar.futureEvents.length) + ' calendar events' });

  // ── Phase 2: Run analysis passes (all in parallel) ────────
  onProgress?.({ phase: 'analyzing', progress: 0, message: 'Starting 10 analysis passes...' });

  const passNames = Object.keys(ALL_PASSES) as PassName[];
  const passPromises = passNames.map(async (name, i) => {
    onProgress?.({ phase: 'analyzing', pass: name, progress: Math.round((i / passNames.length) * 50), message: 'Running ' + name + ' analysis...' });
    try {
      const result = await ALL_PASSES[name](data, apiKey);
      onProgress?.({ phase: 'analyzing', pass: name, progress: Math.round(((i + 1) / passNames.length) * 100), message: name + ' complete — ' + result.memories.length + ' insights, ' + result.entities.length + ' entities' });
      return result;
    } catch (err) {
      console.error('Pass ' + name + ' failed:', err);
      onProgress?.({ phase: 'analyzing', pass: name, progress: Math.round(((i + 1) / passNames.length) * 100), message: name + ' failed: ' + String(err) });
      return { passName: name, memories: [], entities: [] } as AnalysisPassResult;
    }
  });

  const passResults = await Promise.all(passPromises);

  // ── Phase 3: Correlate entities across passes ──────────────
  onProgress?.({ phase: 'correlating', progress: 0, message: 'Correlating entities across data sources...' });

  const allEntities: ExtractedEntity[] = passResults.flatMap(p => p.entities);
  let unifiedEntities: UnifiedEntity[] = [];

  if (allEntities.length > 0) {
    try {
      unifiedEntities = await correlateEntities(allEntities, apiKey);
      onProgress?.({ phase: 'correlating', progress: 100, message: 'Resolved ' + allEntities.length + ' entities into ' + unifiedEntities.length + ' unified profiles' });
    } catch (err) {
      console.error('Correlation failed:', err);
      onProgress?.({ phase: 'correlating', progress: 100, message: 'Entity correlation failed, continuing with raw entities' });
    }
  }

  // ── Phase 4: Store everything to mem0 ──────────────────────
  onProgress?.({ phase: 'storing', progress: 0, message: 'Saving insights to memory...' });

  let totalMemories = 0;
  const allMemories = passResults.flatMap(p => p.memories);

  // Store pass memories
  const STORE_BATCH = 5;
  for (let i = 0; i < allMemories.length; i += STORE_BATCH) {
    const batch = allMemories.slice(i, i + STORE_BATCH);
    await Promise.all(batch.map(m =>
      mem0Write(userId, m.content, {
        domain: m.page_path.split('/')[0] || 'general',
        importance: m.importance,
        source: 'deep_scan',
        metadata: { page_path: m.page_path, temporal: m.temporal, provider },
      }).catch(err => console.error('Failed to store memory:', err))
    ));
    totalMemories += batch.length;
    onProgress?.({ phase: 'storing', progress: Math.round((i / allMemories.length) * 80), message: 'Stored ' + totalMemories + '/' + allMemories.length + ' memories...' });
  }

  // Store unified entities as relationship/project pages
  for (const entity of unifiedEntities) {
    const pagePath = entity.type === 'person' ? 'relationships/' + entity.name.toLowerCase().replace(/\s+/g, '-')
      : entity.type === 'project' ? 'projects/' + entity.name.toLowerCase().replace(/\s+/g, '-')
      : entity.type === 'company' ? 'companies/' + entity.name.toLowerCase().replace(/\s+/g, '-')
      : 'entities/' + entity.name.toLowerCase().replace(/\s+/g, '-');

    const content = entity.description + '\n\nSources: ' + entity.sources.join(', ') + '\nAttributes: ' + Object.entries(entity.attributes).map(([k, v]) => k + ': ' + v).join(', ') + (entity.relationships.length > 0 ? '\nRelationships: ' + entity.relationships.map(r => r.relation + ' → ' + r.entity).join(', ') : '');

    await mem0Write(userId, content, {
      domain: entity.type === 'person' ? 'email' : 'general',
      importance: 0.7,
      source: 'deep_scan',
      metadata: { page_path: pagePath, temporal: 'permanent', provider, entity_type: entity.type },
    }).catch(() => {});
    totalMemories++;
  }

  // Store account info
  await mem0Write(userId, 'Google account: ' + data.accountEmail + ' — ' + data.emails.totalSent + ' sent emails, ' + data.emails.totalReceived + ' received, ' + data.labels.filter(l => l.type === 'user').length + ' custom labels', {
    domain: 'general',
    importance: 0.8,
    source: 'deep_scan',
    metadata: { page_path: 'accounts/' + data.accountEmail + '/profile', temporal: 'permanent', provider },
  }).catch(() => {});
  totalMemories++;

  onProgress?.({ phase: 'storing', progress: 100, message: 'Complete! ' + totalMemories + ' memories stored.' });

  // ── Phase 5: Workflow Intelligence ────────────────────────
  onProgress?.({ phase: 'analyzing', pass: 'workflows', progress: 0, message: 'Identifying automation opportunities...' });

  let workflowSuggestions: import('./workflow-intelligence').AutomationSuggestion[] = [];
  let topPainPoints: string[] = [];
  try {
    const workflowResult = await analyzeWorkflowOpportunities(userId, data, passResults, unifiedEntities, apiKey, onProgress);
    workflowSuggestions = workflowResult.suggestions;
    topPainPoints = workflowResult.topPainPoints;
    totalMemories += workflowResult.totalDetected;
  } catch (err) {
    console.error('Workflow intelligence failed:', err);
    onProgress?.({ phase: 'analyzing', pass: 'workflows', progress: 100, message: 'Workflow analysis failed: ' + String(err) });
  }

  // ── Build summary ──────────────────────────────────────────
  const duration = Date.now() - startTime;
  const summary = 'Deep analysis of ' + provider + ' (' + data.accountEmail + ') completed in ' + Math.round(duration / 1000) + 's. Analyzed ' + data.emails.totalSent + ' sent + ' + data.emails.totalReceived + ' received emails, ' + (data.calendar.pastEvents.length + data.calendar.futureEvents.length) + ' calendar events. Generated ' + totalMemories + ' memories across ' + passResults.length + ' analysis passes. Identified ' + unifiedEntities.length + ' unified entities.' + (workflowSuggestions.length > 0 ? ' Found ' + workflowSuggestions.length + ' automation opportunities.' : '');

  return {
    provider,
    accountEmail: data.accountEmail,
    passResults,
    unifiedEntities,
    totalMemoriesCreated: totalMemories,
    totalEntities: unifiedEntities.length,
    durationMs: duration,
    summary,
    workflowSuggestions,
    topPainPoints,
  };
}
