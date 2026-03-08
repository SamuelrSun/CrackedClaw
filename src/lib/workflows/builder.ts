/**
 * Workflow Builder
 * Takes natural language → structured workflow using AI.
 */

import { sendGatewayMessage } from '@/lib/gateway-client';

export interface WorkflowStep {
  id: string;
  type: 'trigger' | 'action' | 'condition' | 'output';
  description: string;
  integrationSlug?: string;
  resourceUrl?: string;
  config: Record<string, unknown>;
}

export interface BuiltWorkflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  trigger: {
    type: 'schedule' | 'event' | 'manual' | 'webhook';
    cronExpression?: string;
    humanReadable?: string;
    config: Record<string, unknown>;
  };
  requiredIntegrations: string[];
  estimatedDuration: string;
}

const BUILDER_SYSTEM_PROMPT = `You are a workflow builder AI. Parse the user's description and output a structured JSON workflow.

Output ONLY valid JSON matching this schema:
{
  "name": "string - short descriptive name",
  "description": "string - one sentence",
  "trigger": {
    "type": "schedule|event|manual|webhook",
    "cronExpression": "cron expr if scheduled e.g. 0 9 * * 1-5",
    "humanReadable": "human readable schedule e.g. Weekdays at 9 AM",
    "config": {}
  },
  "steps": [
    {
      "id": "step-1",
      "type": "trigger|action|condition|output",
      "description": "what this step does",
      "integrationSlug": "google|slack|notion|github|etc or null",
      "resourceUrl": "specific URL if known or null",
      "config": {}
    }
  ],
  "requiredIntegrations": ["list", "of", "slugs"],
  "estimatedDuration": "~30 seconds"
}

Examples of triggers:
- "every morning at 9am" → type: schedule, cronExpression: "0 9 * * *"
- "whenever a new email arrives" → type: event
- "run it manually" → type: manual
- "when a webhook fires" → type: webhook

Map service names to slugs: Gmail/Google → google, Slack → slack, Notion → notion, LinkedIn → linkedin, GitHub → github, Linear → linear, etc.`;

/**
 * Build a structured workflow from a natural language prompt.
 * Falls back to a sensible default if AI parsing fails.
 */
export async function buildWorkflowFromPrompt(
  prompt: string,
  gatewayUrl: string,
  authToken: string
): Promise<BuiltWorkflow> {
  try {
    const response = await sendGatewayMessage(
      gatewayUrl,
      authToken,
      `Build a workflow for: "${prompt}"`,
      BUILDER_SYSTEM_PROMPT
    );

    // Extract JSON from response text
    const responseText = response.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      // Validate required fields
      if (parsed.name && parsed.steps && parsed.trigger) {
        return parsed as BuiltWorkflow;
      }
    }
  } catch (e) {
    console.error('Workflow builder AI failed:', e);
  }

  // Fallback: parse heuristically
  return buildFallbackWorkflow(prompt);
}

function buildFallbackWorkflow(prompt: string): BuiltWorkflow {
  const lower = prompt.toLowerCase();
  
  // Detect trigger
  const isScheduled = /every|morning|daily|weekly|nightly|hourly|at \d|monday|9am|8am/.test(lower);
  const cronExpr = /morning|9am/.test(lower) ? '0 9 * * *' : /evening|5pm/.test(lower) ? '0 17 * * *' : '0 9 * * 1-5';
  
  // Detect integrations
  const integrations: string[] = [];
  if (/gmail|email|inbox/.test(lower)) integrations.push('google');
  if (/slack/.test(lower)) integrations.push('slack');
  if (/notion/.test(lower)) integrations.push('notion');
  if (/github/.test(lower)) integrations.push('github');
  if (/linear/.test(lower)) integrations.push('linear');
  if (/linkedin/.test(lower)) integrations.push('linkedin');

  const steps: WorkflowStep[] = [
    {
      id: 'step-1',
      type: 'trigger',
      description: isScheduled ? 'Scheduled trigger' : 'Manual trigger',
      config: {},
    },
    {
      id: 'step-2',
      type: 'action',
      description: prompt.slice(0, 100),
      integrationSlug: integrations[0],
      config: {},
    },
  ];

  return {
    name: prompt.slice(0, 50).replace(/[^a-zA-Z0-9 ]/g, '').trim() || 'My Workflow',
    description: prompt.slice(0, 150),
    trigger: {
      type: isScheduled ? 'schedule' : 'manual',
      cronExpression: isScheduled ? cronExpr : undefined,
      humanReadable: isScheduled ? 'On schedule' : 'Manual run',
      config: {},
    },
    steps,
    requiredIntegrations: integrations,
    estimatedDuration: '~1 minute',
  };
}
