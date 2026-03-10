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
  mode: "quick" | "deep" = "quick",
): Promise<EngineResult> {
  const startTime = Date.now();

  // ── Phase 1: Fetch data ───────────────────────────────────
  onProgress?.({ phase: 'fetching', progress: 0, message: 'Connecting to ' + provider + '...' });

  let data: IntegrationData;
  if (provider === 'google') {
    data = await fetchGoogleData(userId, (msg) => {
      onProgress?.({ phase: 'fetching', progress: 20, message: msg });
    }, mode);

  // Log summary of fetched data
  const emailSample = data.emails.sent.slice(0, 8).map(e => '- **To:** ' + (e.to || 'unknown').split('<')[0].trim() + ' — "' + (e.subject || 'No subject') + '"').join('\n');
  const calSample = [...data.calendar.futureEvents, ...data.calendar.pastEvents].slice(0, 5).map(e => '- 📅 ' + e.title + (e.attendees?.length ? ' (' + e.attendees.length + ' attendees)' : '')).join('\n');
  onProgress?.({ phase: 'fetching', progress: 100, message: '### ✅ Data fetched\n**Emails:** ' + data.emails.totalSent + ' sent + ' + data.emails.totalReceived + ' received\n\n**Sample sent emails:**\n' + emailSample + '\n\n**Upcoming calendar:**\n' + calSample });
  } else {
    throw new Error('Provider ' + provider + ' not yet supported for deep analysis');
  }

  onProgress?.({ phase: 'fetching', progress: 100, message: 'Fetched ' + data.emails.totalSent + ' sent + ' + data.emails.totalReceived + ' received emails, ' + (data.calendar.pastEvents.length + data.calendar.futureEvents.length) + ' calendar events' });

  // ── Phase 2: Run analysis passes (sequential to respect rate limits) ────────
  onProgress?.({ phase: 'analyzing', progress: 0, message: 'Starting ' + Object.keys(ALL_PASSES).length + ' analysis passes (' + (mode === 'quick' ? '2 at a time' : 'sequential') + ' to stay within rate limits)...' });

  const passNames = Object.keys(ALL_PASSES) as PassName[];
  const passResults: AnalysisPassResult[] = [];

  const delayMs = mode === 'quick' ? 5000 : 15000;

  {
    // Deep mode: run passes sequentially with 15s gap
    for (let i = 0; i < passNames.length; i++) {
      const name = passNames[i];
      onProgress?.({ phase: 'analyzing', pass: name, progress: Math.round((i / passNames.length) * 100), message: '### 🧠 Running ' + name + ' analysis (' + (i + 1) + '/' + passNames.length + ')\nSending ' + data.emails.totalSent + ' sent emails + ' + (data.calendar.pastEvents.length + data.calendar.futureEvents.length) + ' calendar events to Claude...' });
      try {
        const result = await ALL_PASSES[name](data, apiKey);
        const insightPreview = result.memories.slice(0, 3).map(m => '- ' + m.content.substring(0, 100)).join('\n');
        const entityPreview = result.entities.slice(0, 3).map(e => '- 👤 ' + e.name + ' (' + e.type + ')').join('\n');
        onProgress?.({ phase: 'analyzing', pass: name, progress: Math.round(((i + 1) / passNames.length) * 100), message: '### ✅ ' + name + ' complete\n**' + result.memories.length + ' insights found:**\n' + (insightPreview || '_(none)_') + '\n\n**' + result.entities.length + ' entities:**\n' + (entityPreview || '_(none)_') });
        passResults.push(result);
      } catch (err) {
        console.error('Pass ' + name + ' failed:', err);
        onProgress?.({ phase: 'analyzing', pass: name, progress: Math.round(((i + 1) / passNames.length) * 100), message: name + ' failed: ' + String(err) });
        passResults.push({ passName: name, memories: [], entities: [] } as AnalysisPassResult);
      }
      // Rate limit: wait between passes to stay under 30k tokens/min
      if (i < passNames.length - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }

    // ── Phase 3: Correlate entities across passes ──────────────
  onProgress?.({ phase: 'correlating', progress: 0, message: 'Correlating entities across data sources...' });

  const allEntities: ExtractedEntity[] = passResults.flatMap(p => p.entities);
  let unifiedEntities: UnifiedEntity[] = [];

  if (allEntities.length > 0) {
    try {
      unifiedEntities = await correlateEntities(allEntities, apiKey);
      const profilePreview = unifiedEntities.slice(0, 5).map(e => '- **' + e.name + '** (' + e.type + ') — ' + e.sources.join(', ')).join('\n');
      onProgress?.({ phase: 'correlating', progress: 100, message: '### ✅ Entity correlation complete\nResolved ' + allEntities.length + ' raw entities → ' + unifiedEntities.length + ' unified profiles\n\n' + profilePreview });
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
