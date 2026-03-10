/**
 * Scan Engine v2 — Main Orchestrator
 * Parallel per-integration scans → synthesis → memory storage
 */

import { createClient } from '@supabase/supabase-js';
import { mem0Write } from '@/lib/memory/mem0-client';
import { googleFetcher } from './fetcher-google';
import { analyzeIntegration } from './analyzer';
import { synthesize } from './synthesizer';
import type {
  ScanMode, ScanProgressCallback, ScanResult,
  IntegrationScanResult, IntegrationFetcher, ScanMemory,
} from './types';

// Registry of fetchers — add new integrations here
const FETCHERS: Record<string, IntegrationFetcher> = {
  google: googleFetcher,
};

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Run a scan across all connected integrations (or a specific one)
 */
export async function runScan(
  userId: string,
  apiKey: string,
  mode: ScanMode = 'quick',
  onProgress?: ScanProgressCallback,
  targetProvider?: string, // scan only this provider (optional)
): Promise<ScanResult> {
  const startTime = Date.now();
  const scanId = crypto.randomUUID();

  // Save scan record
  try {
    await supabase.from('scan_logs').insert({
      id: scanId,
      user_id: userId,
      mode,
      status: 'running',
      target_provider: targetProvider || null,
      started_at: new Date().toISOString(),
    });
  } catch { /* scan_logs table may not exist yet */ }

  onProgress?.({
    phase: 'fetching',
    progress: 0,
    message: 'Starting ' + mode + ' scan...',
    log: '### 🚀 Starting ' + mode + ' scan\nScan ID: `' + scanId.substring(0, 8) + '`',
  });

  // Determine which integrations to scan
  let providers: string[] = [];
  if (targetProvider) {
    providers = [targetProvider];
  } else {
    // Get all connected integrations that have fetchers
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('provider')
      .eq('user_id', userId)
      .eq('status', 'connected');

    providers = (integrations || [])
      .map(i => i.provider)
      .filter(p => FETCHERS[p]);
  }

  if (providers.length === 0) {
    onProgress?.({
      phase: 'error',
      progress: 0,
      message: 'No scannable integrations connected',
      log: '### ❌ No integrations to scan\nConnect an integration (Google Workspace, etc.) and try again.',
    });
    throw new Error('No scannable integrations connected. Please connect an integration first.');
  }

  onProgress?.({
    phase: 'fetching',
    progress: 5,
    message: 'Scanning ' + providers.length + ' integration(s): ' + providers.join(', '),
    log: '### 📡 Scanning ' + providers.length + ' integration(s)\n' + providers.map(p => '- **' + p + '**').join('\n'),
  });

  // ── Phase 1: Parallel fetch + analyze per integration ──
  const integrationResults: IntegrationScanResult[] = [];

  // Run all integrations in parallel
  const scanPromises = providers.map(async (provider) => {
    const fetcher = FETCHERS[provider];
    if (!fetcher) return null;

    const providerStart = Date.now();
    try {
      // Fetch data
      const rawData = await fetcher.fetch(userId, mode, onProgress);

      // Analyze with single Claude call
      const memories = await analyzeIntegration(rawData, apiKey, mode, onProgress);

      // Store memories
      onProgress?.({
        phase: 'storing',
        provider,
        progress: 50,
        message: 'Saving ' + memories.length + ' memories from ' + provider + '...',
        log: '### 💾 Storing ' + memories.length + ' memories from ' + provider + '...',
      });

      let stored = 0;
      const BATCH = 5;
      for (let i = 0; i < memories.length; i += BATCH) {
        const batch = memories.slice(i, i + BATCH);
        await Promise.all(batch.map(m =>
          mem0Write(userId, m.content, {
            domain: m.category === 'contact' ? 'email' : m.category === 'project' ? 'coding' : 'general',
            importance: m.importance,
            source: 'scan_v2',
            metadata: { page_path: m.page_path, category: m.category, provider, scan_id: scanId },
          }).catch(err => console.error('Failed to store memory:', err))
        ));
        stored += batch.length;

        if (stored % 10 === 0 || stored === memories.length) {
          onProgress?.({
            phase: 'storing',
            provider,
            progress: Math.round((stored / memories.length) * 100),
            message: 'Stored ' + stored + '/' + memories.length + ' memories',
            log: '### 💾 Progress: ' + stored + '/' + memories.length + ' memories saved',
          });
        }
      }

      const result: IntegrationScanResult = {
        provider,
        accountLabel: rawData.accountLabel,
        memoriesCreated: memories.length,
        memories,
        durationMs: Date.now() - providerStart,
      };

      onProgress?.({
        phase: 'storing',
        provider,
        progress: 100,
        message: provider + ' scan complete: ' + memories.length + ' memories in ' + Math.round(result.durationMs / 1000) + 's',
        log: '### 🎉 ' + provider + ' scan complete\n**' + memories.length + ' memories** saved in ' + Math.round(result.durationMs / 1000) + 's',
      });

      return result;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      onProgress?.({
        phase: 'error',
        provider,
        progress: 0,
        message: provider + ' scan failed: ' + errMsg,
        log: '### ❌ ' + provider + ' scan failed\n```\n' + errMsg + '\n```',
      });
      return {
        provider,
        accountLabel: '',
        memoriesCreated: 0,
        memories: [],
        durationMs: Date.now() - providerStart,
        error: errMsg,
      } as IntegrationScanResult;
    }
  });

  const results = await Promise.all(scanPromises);
  for (const r of results) {
    if (r) integrationResults.push(r);
  }

  // ── Phase 2: Synthesis ──
  const successfulResults = integrationResults.filter(r => !r.error && r.memories.length > 0);
  let synthesis = undefined;

  if (successfulResults.length > 0) {
    try {
      synthesis = await synthesize(successfulResults, apiKey, onProgress);

      // Store synthesis memories
      if (synthesis.crossIntegrationInsights.length > 0) {
        for (const m of synthesis.crossIntegrationInsights) {
          await mem0Write(userId, m.content, {
            domain: 'general',
            importance: m.importance || 0.7,
            source: 'scan_v2_synthesis',
            metadata: { page_path: m.page_path || 'synthesis/' + m.category, category: m.category, scan_id: scanId },
          }).catch(() => {});
        }
      }

      // Store user profile
      if (synthesis.userProfile) {
        await mem0Write(userId, synthesis.userProfile, {
          domain: 'general',
          importance: 0.9,
          source: 'scan_v2_synthesis',
          metadata: { page_path: 'synthesis/user-profile', category: 'profile', scan_id: scanId },
        }).catch(() => {});
      }
    } catch (err) {
      onProgress?.({
        phase: 'synthesizing',
        progress: 0,
        message: 'Synthesis failed: ' + String(err),
        log: '### ⚠️ Synthesis failed\n' + String(err) + '\n\n_Individual integration results were still saved successfully._',
      });
    }
  }

  // ── Final summary ──
  const totalMemories = integrationResults.reduce((s, r) => s + r.memoriesCreated, 0) + (synthesis?.memoriesCreated || 0);
  const totalDuration = Date.now() - startTime;

  // Update scan record
  try {
    await supabase.from('scan_logs').update({
      status: 'complete',
      completed_at: new Date().toISOString(),
      total_memories: totalMemories,
      duration_ms: totalDuration,
      results_summary: JSON.stringify({
        integrations: integrationResults.map(r => ({ provider: r.provider, memories: r.memoriesCreated, error: r.error })),
        synthesis: synthesis ? { insights: synthesis.crossIntegrationInsights.length, workflows: synthesis.workflowSuggestions.length } : null,
      }),
    }).eq('id', scanId);
  } catch { /* scan_logs table may not exist */ }

  const summaryParts = [
    '### 🏁 Scan complete!',
    '**' + totalMemories + ' total memories** saved in ' + Math.round(totalDuration / 1000) + 's',
    '',
    '**Integration results:**',
    ...integrationResults.map(r =>
      '- **' + r.provider + '**: ' + (r.error ? '❌ ' + r.error : '✅ ' + r.memoriesCreated + ' memories')
    ),
  ];

  if (synthesis?.workflowSuggestions?.length) {
    summaryParts.push('', '**Suggested automations:**');
    for (const s of synthesis.workflowSuggestions) {
      summaryParts.push('- 🤖 **' + s.name + '** — ' + s.description);
    }
  }

  onProgress?.({
    phase: 'complete',
    progress: 100,
    message: 'Scan complete: ' + totalMemories + ' memories saved',
    log: summaryParts.join('\n'),
  });

  return {
    integrationResults,
    synthesis,
    totalMemories,
    totalDurationMs: totalDuration,
    scanId,
  };
}
