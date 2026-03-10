/**
 * Workflow Intelligence Engine
 * 
 * Runs AFTER the deep context scan. Analyzes behavioral data to:
 * 1. Detect manual workflows the user already does repeatedly
 * 2. Infer high-value automation systems they'd benefit from
 * 
 * Each suggestion scored by pain level (frequency x time x effort).
 * Only SYSTEMS (recurring) qualify — one-time tasks are filtered out.
 */

import type { IntegrationData, AnalysisPassResult, UnifiedEntity, EngineProgressEvent } from './types';

export interface AutomationSuggestion {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: string[];
  output: string;
  painScore: number;
  frequency: string;
  timePerInstance: string;
  estimatedTimeSaved: string;
  category: 'detected_manual' | 'inferred_valuable';
  evidence: string[];
  complexity: 'easy' | 'medium' | 'hard';
  requiredIntegrations: string[];
  icon: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface WorkflowIntelligenceResult {
  suggestions: AutomationSuggestion[];
  totalDetected: number;
  topPainPoints: string[];
  summary: string;
}

async function claudeCall(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error('Claude API error: ' + res.status);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseJsonFromResponse(text: string): AutomationSuggestion[] {
  try {
    const match = text.match(/```json\n([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]);
  } catch (e) {
    console.error('Failed to parse workflow suggestions:', e);
  }
  return [];
}

async function detectManualWorkflows(
  data: IntegrationData,
  passResults: AnalysisPassResult[],
  apiKey: string,
): Promise<AutomationSuggestion[]> {
  const passContext = passResults.map(p =>
    '## ' + p.passName + '\n' + p.memories.map(m => '- ' + m.content).join('\n')
  ).join('\n\n');

  const sentPatterns = data.emails.sent.slice(0, 50).map(e =>
    'To: ' + e.to + ' | Subject: ' + e.subject + ' | Date: ' + e.date + ' | Labels: ' + e.labels.join(', ')
  ).join('\n');

  const receivedPatterns = data.emails.received.slice(0, 100).map(e =>
    'From: ' + e.from + ' | Subject: ' + e.subject + ' | Date: ' + e.date + ' | Labels: ' + e.labels.join(', ')
  ).join('\n');

  const calendarContext = [...data.calendar.pastEvents, ...data.calendar.futureEvents]
    .map(e => e.title + ' | ' + e.start + ' | attendees: ' + e.attendees.length)
    .join('\n');

  const prompt = [
    'You are a workflow automation analyst. Analyze this user\'s email and calendar data to find MANUAL WORKFLOWS they currently do repeatedly that could be automated.',
    '',
    'WHAT TO LOOK FOR:',
    '- Repeated email sequences (same type of email followed by same follow-up action)',
    '- Scheduling patterns (outreach email → calendar event creation → meeting link)',
    '- Forwarding patterns (receives email type X → forwards to Y)',
    '- Data compilation (manually gathering info from emails into documents)',
    '- Cold outreach sequences (template → send → follow-up if no reply)',
    '- Meeting prep (looking up attendees before meetings)',
    '- Post-meeting follow-ups (thank you emails after calendar events)',
    '- Job application tracking (apply → track status → follow up)',
    '- Newsletter/alert processing (receive alerts → take action based on content)',
    '',
    'FILTERING RULES - CRITICAL:',
    '- ONLY include RECURRING SYSTEMS, NOT one-time tasks',
    '- Must happen at least 1x per week to qualify',
    '- Must involve significant manual effort',
    '- "Delete spam" is NOT a workflow. "Process job alerts into a tracking spreadsheet" IS.',
    '- Focus on SEQUENCES of actions, not single actions',
    '- The more often, the more time-consuming, and the more manual = higher pain score',
    '',
    'PAIN SCORE CALCULATION:',
    '- Frequency: daily or multiple/day = 40pts, 3-5x/week = 30pts, 1-2x/week = 20pts',
    '- Time per instance: >15min = 30pts, 5-15min = 20pts, 2-5min = 15pts',
    '- Manual effort (copy-paste, data entry, multiple tools): high = 30pts, medium = 20pts, low = 10pts',
    '- Pain score = frequency_pts + time_pts + effort_pts (max 100)',
    '',
    'DEEP SCAN INSIGHTS:',
    passContext.substring(0, 30000),
    '',
    'SENT EMAIL PATTERNS:',
    sentPatterns.substring(0, 20000),
    '',
    'RECEIVED EMAIL PATTERNS:',
    receivedPatterns.substring(0, 20000),
    '',
    'CALENDAR PATTERNS:',
    calendarContext.substring(0, 10000),
    '',
    'LABELS:',
    data.labels.map(l => l.name + ' (' + l.type + ')').join(', '),
    '',
    'Output a JSON array of detected manual workflows:',
    '```json',
    '[',
    '  {',
    '    "id": "kebab-case-id",',
    '    "name": "Short descriptive name",',
    '    "description": "What they currently do manually and why it is painful",',
    '    "trigger": "What kicks off this workflow",',
    '    "actions": ["Step 1", "Step 2", "Step 3"],',
    '    "output": "What the automation would produce",',
    '    "painScore": 75,',
    '    "frequency": "3x/week",',
    '    "timePerInstance": "10 min",',
    '    "estimatedTimeSaved": "30 min/week",',
    '    "category": "detected_manual",',
    '    "evidence": ["specific data points that show this pattern"],',
    '    "complexity": "easy",',
    '    "requiredIntegrations": ["google"],',
    '    "icon": "📊",',
    '    "priority": "high"',
    '  }',
    ']',
    '```',
  ].join('\n');

  const text = await claudeCall(apiKey, prompt);
  return parseJsonFromResponse(text);
}

async function inferValueAutomations(
  data: IntegrationData,
  passResults: AnalysisPassResult[],
  unifiedEntities: UnifiedEntity[],
  apiKey: string,
): Promise<AutomationSuggestion[]> {
  const identityPass = passResults.find(p => p.passName === 'identity');
  const projectsPass = passResults.find(p => p.passName === 'projects');
  const prioritiesPass = passResults.find(p => p.passName === 'priorities');
  const socialPass = passResults.find(p => p.passName === 'social_graph');

  const userProfile = [
    identityPass ? '## Identity\n' + identityPass.memories.map(m => '- ' + m.content).join('\n') : '',
    projectsPass ? '## Projects & Work\n' + projectsPass.memories.map(m => '- ' + m.content).join('\n') : '',
    prioritiesPass ? '## Priorities\n' + prioritiesPass.memories.map(m => '- ' + m.content).join('\n') : '',
    socialPass ? '## Relationships\n' + socialPass.memories.map(m => '- ' + m.content).join('\n') : '',
  ].filter(Boolean).join('\n\n');

  const entityContext = unifiedEntities.slice(0, 20).map(e =>
    e.name + ' (' + e.type + '): ' + e.description
  ).join('\n');

  const prompt = [
    'You are a productivity systems architect. Given what you know about this user, suggest HIGH-VALUE AUTOMATION SYSTEMS they don\'t currently have but would massively benefit from.',
    '',
    'USER PROFILE:',
    userProfile.substring(0, 20000),
    '',
    'KEY ENTITIES:',
    entityContext.substring(0, 5000),
    '',
    'CONNECTED INTEGRATIONS: ' + data.provider,
    'ACCOUNT: ' + data.accountEmail,
    'TOTAL SENT: ' + data.emails.totalSent + ' | RECEIVED: ' + data.emails.totalReceived,
    'CALENDAR EVENTS (90 days): ' + (data.calendar.pastEvents.length + data.calendar.futureEvents.length),
    '',
    'Think about what SYSTEMS would be transformative for this specific person.',
    '',
    'For a STUDENT APPLYING TO JOBS:',
    '- Job alert processing → auto-parse → spreadsheet tracker with company, role, link, deadline columns',
    '- Application follow-up system (apply → wait X days → draft follow-up if no response)',
    '- Interview prep system (before each interview, research company, prepare questions)',
    '',
    'For a FOUNDER DOING OUTREACH:',
    '- CRM pipeline (cold email → track responses → auto follow-up → meeting booked → notes)',
    '- Lead enrichment (new contact → auto-research → add context)',
    '',
    'For someone with LOTS OF MEETINGS:',
    '- Meeting prep brief (5 min before, auto-pull context about attendees)',
    '- Post-meeting action item extraction + follow-up draft generation',
    '',
    'SCORING:',
    '- Relevance to THIS user (how well does it match their situation?): 0-40',
    '- Impact (how much time/effort saved weekly?): 0-35',
    '- Feasibility (can the AI agent build this with available tools?): 0-25',
    '- painScore = relevance + impact + feasibility (max 100)',
    '',
    'CRITICAL FILTER:',
    '- ONLY RECURRING SYSTEMS, not one-time tasks',
    '- Must save at least 30 min/week to qualify',
    '- Must be feasible with connected integrations',
    '',
    'Output a JSON array:',
    '```json',
    '[',
    '  {',
    '    "id": "kebab-case-id",',
    '    "name": "Short descriptive name",',
    '    "description": "What this system does and why it is valuable for this specific user",',
    '    "trigger": "What kicks it off",',
    '    "actions": ["Step 1", "Step 2", "Step 3"],',
    '    "output": "What the user gets",',
    '    "painScore": 70,',
    '    "frequency": "daily",',
    '    "timePerInstance": "15 min saved",',
    '    "estimatedTimeSaved": "1.5 hours/week",',
    '    "category": "inferred_valuable",',
    '    "evidence": ["why this is relevant for this user"],',
    '    "complexity": "medium",',
    '    "requiredIntegrations": ["google", "sheets"],',
    '    "icon": "🚀",',
    '    "priority": "high"',
    '  }',
    ']',
    '```',
  ].join('\n');

  const text = await claudeCall(apiKey, prompt);
  return parseJsonFromResponse(text);
}

export async function analyzeWorkflowOpportunities(
  userId: string,
  data: IntegrationData,
  passResults: AnalysisPassResult[],
  unifiedEntities: UnifiedEntity[],
  apiKey: string,
  onProgress?: (event: EngineProgressEvent) => void,
): Promise<WorkflowIntelligenceResult> {
  onProgress?.({ phase: 'analyzing', pass: 'workflows', progress: 0, message: 'Analyzing workflow automation opportunities...' });

  const [manualWorkflows, inferredAutomations] = await Promise.all([
    detectManualWorkflows(data, passResults, apiKey).catch(err => {
      console.error('Manual workflow detection failed:', err);
      return [] as AutomationSuggestion[];
    }),
    inferValueAutomations(data, passResults, unifiedEntities, apiKey).catch(err => {
      console.error('Inferred automation detection failed:', err);
      return [] as AutomationSuggestion[];
    }),
  ]);

  onProgress?.({ phase: 'analyzing', pass: 'workflows', progress: 60, message: 'Ranking ' + (manualWorkflows.length + inferredAutomations.length) + ' suggestions...' });

  const allSuggestions = [...manualWorkflows, ...inferredAutomations];
  allSuggestions.sort((a, b) => b.painScore - a.painScore);

  for (const s of allSuggestions) {
    if (s.painScore >= 80) s.priority = 'critical';
    else if (s.painScore >= 60) s.priority = 'high';
    else if (s.painScore >= 40) s.priority = 'medium';
    else s.priority = 'low';
  }

  const filtered = allSuggestions.filter(s => s.painScore >= 25);

  onProgress?.({ phase: 'storing', pass: 'workflows', progress: 80, message: 'Saving automation suggestions to memory...' });

  const { mem0Write } = await import('@/lib/memory/mem0-client');
  for (const s of filtered.slice(0, 10)) {
    await mem0Write(userId,
      'Automation opportunity: ' + s.name + ' — ' + s.description +
      '. Trigger: ' + s.trigger +
      '. Actions: ' + s.actions.join(' → ') +
      '. Output: ' + s.output +
      '. Estimated time saved: ' + s.estimatedTimeSaved +
      '. Pain score: ' + s.painScore + '/100.' +
      '. Evidence: ' + s.evidence.join('; '), {
      domain: 'general',
      importance: Math.min(s.painScore / 100, 0.95),
      source: 'deep_scan',
      metadata: {
        page_path: 'automations/' + s.id,
        temporal: 'monthly',
        suggestion_data: s,
      },
    }).catch(() => {});
  }

  onProgress?.({ phase: 'analyzing', pass: 'workflows', progress: 100, message: 'Found ' + filtered.length + ' automation opportunities' });

  return {
    suggestions: filtered,
    totalDetected: filtered.length,
    topPainPoints: filtered.slice(0, 3).map(s => s.name),
    summary: 'Identified ' + filtered.length + ' automation opportunities. Top pain points: ' +
      filtered.slice(0, 3).map(s => s.name + ' (' + s.painScore + '/100)').join(', '),
  };
}
