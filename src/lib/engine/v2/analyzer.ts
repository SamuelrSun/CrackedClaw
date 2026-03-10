/**
 * Single-prompt analyzer
 * Takes raw integration data, sends to Claude in ONE call, gets structured memories back.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { IntegrationRawData, ScanMemory, ScanProgressCallback, ScanMode } from './types';

const SYSTEM_PROMPT = `You are an AI memory extraction engine. You receive raw data from a user's connected integration and must extract everything worth remembering into structured memories.

RULES:
1. Extract contacts, relationships, projects, patterns, preferences, communication style, priorities, and recurring themes.
2. For each memory, choose a logical page_path that organizes it hierarchically. The path should start with the integration name, then subcategories. Examples:
   - google-workspace/gmail/contacts/john-smith
   - google-workspace/calendar/recurring/weekly-standup
   - google-workspace/drive/projects/fenna-hub
   - google-workspace/gmail/patterns/response-time
   - slack/channels/engineering/key-topics
3. Assign importance (0-1): 0.9+ for key relationships/active projects, 0.5-0.8 for patterns/preferences, 0.3-0.5 for minor observations
4. Assign category: "contact", "project", "pattern", "preference", "insight", "workflow", "style"
5. Be thorough but not redundant. Quality > quantity. Each memory should be a distinct, useful insight.
6. Extract the user's communication style, writing patterns, and tone from sent emails.
7. Identify who the user communicates with most and the nature of those relationships.
8. Note any upcoming deadlines, events, or commitments.
9. Identify projects and their current status based on email subjects and calendar events.

OUTPUT FORMAT: Return ONLY a JSON array of memory objects. No other text.
[
  {
    "content": "Clear, specific description of the memory",
    "page_path": "integration/category/subcategory/item",
    "importance": 0.8,
    "category": "contact"
  }
]`;

function formatDataForPrompt(data: IntegrationRawData, mode: ScanMode): string {
  let prompt = '# Integration: ' + data.provider + ' (' + data.accountLabel + ')\n\n';

  for (const section of data.sections) {
    prompt += '## ' + section.description + ' (' + section.items.length + ' items)\n\n';

    for (const item of section.items) {
      prompt += '### ' + item.title + '\n';
      if (item.subtitle) prompt += item.subtitle + '\n';
      if (item.date) prompt += 'Date: ' + item.date + '\n';
      if (item.body && mode === 'deep') {
        prompt += item.body + '\n';
      } else if (item.body) {
        // Quick mode: trim bodies further
        prompt += item.body.substring(0, 400) + '\n';
      }
      prompt += '\n';
    }
  }

  return prompt;
}

export async function analyzeIntegration(
  data: IntegrationRawData,
  apiKey: string,
  mode: ScanMode,
  onProgress?: ScanProgressCallback,
): Promise<ScanMemory[]> {
  const client = new Anthropic({ apiKey });
  const prompt = formatDataForPrompt(data, mode);

  onProgress?.({
    phase: 'analyzing',
    provider: data.provider,
    progress: 10,
    message: 'Sending ' + data.sections.reduce((s, sec) => s + sec.items.length, 0) + ' items to Claude...',
    log: '### 🧠 Analyzing ' + data.provider + ' data\nSending ' + Math.round(prompt.length / 4) + ' tokens to Claude Sonnet...\n\n_Extracting contacts, projects, patterns, preferences, and communication style..._',
  });

  // Retry with backoff
  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      });
      break;
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 429 && attempt < 2) {
        const wait = (attempt + 1) * 20000;
        onProgress?.({
          phase: 'analyzing',
          provider: data.provider,
          progress: 20,
          message: 'Rate limited, waiting ' + (wait / 1000) + 's...',
          log: '### ⏳ Rate limited — waiting ' + (wait / 1000) + 's before retry (' + (attempt + 1) + '/3)',
        });
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw err;
    }
  }
  if (!response) throw new Error('Analysis failed after 3 retries');

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Parse JSON array from response
  let memories: ScanMemory[] = [];
  try {
    // Try raw JSON first
    const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      memories = JSON.parse(jsonMatch[0]);
    }
  } catch {
    // Try code block
    try {
      const codeMatch = text.match(/```(?:json)?\n([\s\S]*?)```/);
      if (codeMatch) {
        memories = JSON.parse(codeMatch[1].trim());
      }
    } catch {
      onProgress?.({
        phase: 'analyzing',
        provider: data.provider,
        progress: 90,
        message: 'Warning: Could not parse analysis output',
        log: '### ⚠️ Parse warning\nClaude returned non-standard format. Attempting recovery...\n\n_Raw output (first 500 chars):_\n```\n' + text.substring(0, 500) + '\n```',
      });
    }
  }

  // Validate and clean
  memories = memories.filter(m =>
    m && typeof m.content === 'string' && m.content.length > 0 &&
    typeof m.page_path === 'string' && m.page_path.length > 0
  ).map(m => ({
    content: m.content,
    page_path: m.page_path,
    importance: typeof m.importance === 'number' ? Math.min(1, Math.max(0, m.importance)) : 0.5,
    category: m.category || 'insight',
  }));

  // Log what was found
  const byCategory = memories.reduce((acc, m) => {
    acc[m.category] = (acc[m.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const categoryLog = Object.entries(byCategory).map(([k, v]) => '- **' + k + ':** ' + v).join('\n');
  const sampleLog = memories.slice(0, 10).map(m => '- `' + m.page_path + '` — ' + m.content.substring(0, 80) + (m.content.length > 80 ? '...' : '')).join('\n');

  onProgress?.({
    phase: 'analyzing',
    provider: data.provider,
    progress: 100,
    message: memories.length + ' memories extracted',
    log: '### ✅ Analysis complete — ' + memories.length + ' memories\n\n**By category:**\n' + categoryLog + '\n\n**Sample memories:**\n' + sampleLog,
  });

  return memories;
}
