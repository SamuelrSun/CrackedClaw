/**
 * Cross-integration synthesizer
 * Reads memories from all integration scans, finds patterns, suggests workflows
 */

import Anthropic from '@anthropic-ai/sdk';
import type { IntegrationScanResult, SynthesisResult, ScanMemory, WorkflowSuggestion, ScanProgressCallback } from './types';

const SYNTHESIS_PROMPT = `You are a workflow automation advisor. You've been given memories extracted from a user's connected integrations. Your job is to:

1. Find CROSS-INTEGRATION patterns (e.g., same person in email + calendar, same project in email + drive)
2. Identify workflow automation opportunities based on repetitive patterns
3. Create a brief user profile summary

OUTPUT FORMAT: Return ONLY a JSON object:
{
  "crossIntegrationInsights": [
    {"content": "...", "page_path": "synthesis/cross-integration/...", "importance": 0.8, "category": "insight"}
  ],
  "workflowSuggestions": [
    {
      "name": "Auto-schedule follow-ups",
      "description": "User frequently emails then schedules meetings with same contacts",
      "trigger": "After sending email to frequent contact",
      "integrations": ["gmail", "calendar"],
      "estimatedTimeSaved": "30 min/week",
      "priority": "high"
    }
  ],
  "userProfile": "Markdown summary of who this user is, what they do, key relationships, communication style..."
}`;

export async function synthesize(
  results: IntegrationScanResult[],
  apiKey: string,
  onProgress?: ScanProgressCallback,
): Promise<SynthesisResult> {
  // Only synthesize if we have results from multiple integrations or substantial memories
  const totalMemories = results.reduce((s, r) => s + r.memories.length, 0);
  if (totalMemories === 0) {
    return { crossIntegrationInsights: [], workflowSuggestions: [], userProfile: 'No data to synthesize.', memoriesCreated: 0 };
  }

  onProgress?.({
    phase: 'synthesizing',
    progress: 10,
    message: 'Synthesizing insights across ' + results.length + ' integration(s)...',
    log: '### 🔗 Cross-integration synthesis\nAnalyzing ' + totalMemories + ' memories from ' + results.map(r => r.provider).join(', ') + '...',
  });

  // Build prompt with all memories
  let prompt = 'USER MEMORIES FROM CONNECTED INTEGRATIONS:\n\n';
  for (const result of results) {
    prompt += '## ' + result.provider + ' (' + result.accountLabel + ') — ' + result.memories.length + ' memories\n\n';
    for (const mem of result.memories) {
      prompt += '- [' + mem.page_path + '] ' + mem.content + '\n';
    }
    prompt += '\n';
  }

  const client = new Anthropic({ apiKey });

  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        system: SYNTHESIS_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      break;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < 2) {
        const wait = (attempt + 1) * 20000;
        onProgress?.({
          phase: 'synthesizing',
          progress: 30,
          message: 'Rate limited, waiting ' + (wait / 1000) + 's...',
          log: '### ⏳ Rate limited — waiting ' + (wait / 1000) + 's...',
        });
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  if (!response) throw new Error('Synthesis failed after 3 retries');

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse result
  let parsed: {
    crossIntegrationInsights?: ScanMemory[];
    workflowSuggestions?: WorkflowSuggestion[];
    userProfile?: string;
  } = {};

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    try {
      const codeMatch = text.match(/```(?:json)?\n([\s\S]*?)```/);
      if (codeMatch) parsed = JSON.parse(codeMatch[1].trim());
    } catch {
      onProgress?.({
        phase: 'synthesizing',
        progress: 90,
        message: 'Warning: Could not parse synthesis output',
        log: '### ⚠️ Synthesis parse warning\n```\n' + text.substring(0, 500) + '\n```',
      });
    }
  }

  const insights = (parsed.crossIntegrationInsights || []).filter(m =>
    m && typeof m.content === 'string' && m.content.length > 0
  );
  const suggestions = parsed.workflowSuggestions || [];
  const profile = parsed.userProfile || '';

  // Log results
  const insightLog = insights.slice(0, 5).map(m => '- ' + m.content.substring(0, 100)).join('\n');
  const workflowLog = suggestions.slice(0, 5).map(s => '- **' + s.name + '** (' + s.priority + ') — ' + s.description.substring(0, 80)).join('\n');

  onProgress?.({
    phase: 'synthesizing',
    progress: 100,
    message: 'Synthesis complete: ' + insights.length + ' insights, ' + suggestions.length + ' workflow suggestions',
    log: '### ✅ Synthesis complete\n\n' +
      (insights.length > 0 ? '**Cross-integration insights:**\n' + insightLog + '\n\n' : '') +
      (suggestions.length > 0 ? '**Workflow suggestions:**\n' + workflowLog + '\n\n' : '') +
      (profile ? '**User profile:**\n' + profile.substring(0, 300) : ''),
  });

  return {
    crossIntegrationInsights: insights,
    workflowSuggestions: suggestions,
    userProfile: profile,
    memoriesCreated: insights.length,
  };
}
