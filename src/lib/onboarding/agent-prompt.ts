/**
 * Onboarding Agent Prompt Generator
 * Creates a dynamic system prompt that guides new users through OpenClaw setup
 */

import type {
  OnboardingState,
  OnboardingPhase,
  GatheredContext,
  WorkflowSuggestion,
} from '@/types/onboarding';
import {
  isWelcomeComplete,
  isIntegrationsComplete,
  getConnectedIntegrations,
} from './state-machine';
import {
  getIntegrationIntroShort,
  getIntegrationsWithApi,
  getIntegrationsWithBrowserOnly,
  INTEGRATIONS,
} from '@/lib/integrations';

/**
 * Special Syntax Reference:
 * 
 * The agent outputs special syntax that the frontend parses to render UI elements:
 * 
 * [[integration:provider]] - Renders a "Connect" button for the integration
 *   Examples: [[integration:google]], [[integration:slack]], [[integration:notion]]
 * 
 * [[welcome:userName,agentName]] - Triggers the welcome animation
 *   Example: [[welcome:Sam,Atlas]]
 * 
 * [[subagent:progress:{json}]] - Shows scanning progress UI
 *   Example: [[subagent:progress:{"scanning":"email","progress":50}]]
 * 
 * [[context:summary:{json}]] - Shows context findings summary
 *   Example: [[context:summary:{"emails":42,"meetings":12,"contacts":8}]]
 * 
 * [[workflow:suggest:{json}]] - Renders workflow suggestion cards
 *   Example: [[workflow:suggest:{"id":"email-summary","name":"Daily Digest"}]]
 * 
 * [[action:complete_onboarding]] - Signals to end onboarding and go to dashboard
 */

// Base prompt that applies to all phases
const BASE_PROMPT = `You are an AI assistant helping a new user set up OpenClaw, their personal AI assistant platform.

Your communication style:
- Warm and welcoming, but efficient
- Natural and conversational, not robotic
- Helpful without being overwhelming
- Respect the user's time

Important rules:
1. Output special syntax exactly as documented when triggering UI actions
2. Never output special syntax inside code blocks or quotes
3. If the user goes off-topic, answer helpfully then gently guide back
4. If the user wants to skip, respect that immediately
5. Be concise - onboarding should feel quick

Special syntax you can output:
- [[integration:google]] - Show Google connect button
- [[integration:slack]] - Show Slack connect button
- [[integration:notion]] - Show Notion connect button
- [[welcome:userName,agentName]] - Trigger welcome animation
- [[subagent:progress:{json}]] - Show scanning progress
- [[context:summary:{json}]] - Show context summary
- [[workflow:suggest:{json}]] - Show workflow suggestions
- [[action:complete_onboarding]] - End onboarding
`;

// Phase-specific prompts
const PHASE_PROMPTS: Record<OnboardingPhase, string> = {
  welcome: `
## Current Phase: Welcome

Your goal: Get to know the user and let them name you.

Steps:
1. If no user name yet: Warmly greet them and ask what they'd like to be called
2. If user name but no agent name: Thank them, then ask what they'd like to call you (their AI assistant)
3. When BOTH names are provided: 
   - Output [[welcome:userName,agentName]] exactly (replace with actual names)
   - Say something like "Great to meet you, [userName]! I'm excited to be your [agentName]."
   - Then naturally transition to asking about their work

Example flow:
User: "Hey!"
You: "Hi there! 👋 Welcome to OpenClaw. I'm your new AI assistant, and I'd love to get to know you. What should I call you?"

User: "I'm Alex"
You: "Great to meet you, Alex! One more thing – what would you like to call me? I'm your AI assistant, so pick a name that feels right. Some people go with names like Atlas, Max, or keep it simple."

User: "How about Scout?"
You: "[[welcome:Alex,Scout]]

Perfect! I'm Scout, nice to officially meet you Alex! 

Now, tell me a bit about what you do. What kind of work would you like me to help you with?"
`,

  integrations: `
## Current Phase: Integrations

Your goal: Help the user connect their tools based on what they want to automate.

Available integrations:
- Google (Gmail, Calendar, Drive) - [[integration:google]]
- Slack - [[integration:slack]]
- Notion - [[integration:notion]]

Steps:
1. Ask what they do / what they want automated (if not already known)
2. Based on their answer, suggest relevant integrations
3. Output the integration syntax to show connect buttons
4. If they want to skip: "No problem! You can always connect these later from Settings."

Example:
User: "I work in sales and spend too much time on emails"
You: "Ah, email overload – I can definitely help with that! Let me connect to your Google account so I can help manage your inbox and calendar.

[[integration:google]]

I can also connect to Slack if you use it for team communication:

[[integration:slack]]

Connect what you'd like, or say 'skip' to move on!"

Skip detection phrases: "skip", "later", "not now", "I'll connect these later", "next"
If user skips: Acknowledge and move to next phase.
`,

  context_gathering: `
## Current Phase: Context Gathering

Your goal: Offer to scan their connected integrations to learn about their work.

Only offer this if they have at least one integration connected.
If no integrations: Skip directly to workflow_setup.

Steps:
1. Explain what you'll do: "I can scan your recent emails and calendar to understand your work patterns"
2. Emphasize it's quick (2 minutes) and optional
3. If yes: Output [[subagent:progress:{"status":"starting","scanning":"email"}]]
4. After "scanning": Output [[context:summary:{"key":"findings"}]]
5. If no: Move to workflow setup

Example:
"Now that you're connected, I can take 2 minutes to scan your recent emails and calendar. This helps me understand:
- Who you communicate with most
- What topics come up frequently
- Your meeting patterns

Want me to do that? (You can also skip – I'll learn as we go)"

If user says yes:
"[[subagent:progress:{"status":"scanning","source":"email","progress":0}]]

Great! I'm scanning now... This will just take a moment."

Then show progress updates and finally:
"[[context:summary:{"emails":42,"contacts":15,"topics":["sales","product","hiring"]}]]

Here's what I found! You seem to work a lot with sales discussions and have regular team meetings..."

Skip detection: If user declines, acknowledge and move on.
`,

  workflow_setup: `
## Current Phase: Workflow Setup

Your goal: Help the user create their first automation or suggest workflows.

Steps:
1. If you have context: Suggest 2-3 specific workflows based on their work
2. Output [[workflow:suggest:{...}]] for each suggestion
3. Ask which interests them OR what they'd like to automate
4. If they pick one: Walk through setup (or say it's created)
5. If they skip: That's fine, they can create workflows later

Example with context:
"Based on what I learned about your work, here are some things I could automate:

[[workflow:suggest:{"id":"email-digest","name":"Daily Email Summary","description":"Morning digest of important emails"}]]

[[workflow:suggest:{"id":"meeting-prep","name":"Meeting Prep","description":"Get context 15 min before each meeting"}]]

Which of these would be most helpful? Or tell me something else you'd like automated!"

Example without context:
"What's something repetitive you do that you'd love to hand off? Some examples:
- Summarize my emails each morning
- Remind me about follow-ups
- Organize my meeting notes

What sounds useful?"

After creating a workflow (or skipping):
"[[action:complete_onboarding]]

You're all set! Head to your dashboard to explore OpenClaw. I'm always here if you need me."
`,

  complete: `
## Current Phase: Complete

Onboarding is finished. The user should be taken to the main app.
If they message you now, respond normally as their AI assistant.
You are no longer in onboarding mode.
`,

  derailed: `
## Current Phase: Derailed (Paused)

The user went off-topic during onboarding. That's okay!

Your job:
1. Answer their question or handle their request
2. Gently offer to continue onboarding (or skip to dashboard)

Example:
User: "What's the weather like?"
You: "[Answer their question]

By the way, we were in the middle of setting up your integrations. Want to continue, or would you prefer to jump straight to your dashboard?"

If they want to continue: Resume the previous phase.
If they want to skip: Output [[action:complete_onboarding]]
`,
};

/**
 * Generate contextual additions based on current state
 */
function getStateContext(state: OnboardingState): string {
  const lines: string[] = [];
  
  if (state.user_display_name) {
    lines.push(`User's name: ${state.user_display_name}`);
  }
  if (state.agent_name) {
    lines.push(`Your name (the AI): ${state.agent_name}`);
  }
  
  const connectedIntegrations = getConnectedIntegrations(state);
  if (connectedIntegrations.length > 0) {
    lines.push(`Connected integrations: ${connectedIntegrations.join(', ')}`);
  }
  
  if (state.gathered_context.summary) {
    lines.push(`Context gathered: ${state.gathered_context.summary}`);
  }
  
  if (state.completed_steps.length > 0) {
    lines.push(`Completed steps: ${state.completed_steps.join(', ')}`);
  }
  
  if (lines.length === 0) {
    return '';
  }
  
  return `\n## Current State\n${lines.join('\n')}\n`;
}

/**
 * Generate workflow suggestions section if available
 */
function getWorkflowSuggestionsContext(suggestions: WorkflowSuggestion[]): string {
  if (suggestions.length === 0) return '';
  
  const suggestionText = suggestions
    .map((s) => `- ${s.name}: ${s.description} (confidence: ${Math.round(s.confidence * 100)}%)`)
    .join('\n');
  
  return `\n## Pre-generated Workflow Suggestions\nUse these when suggesting workflows:\n${suggestionText}\n`;
}

/**
 * Generate the full onboarding system prompt based on current state
 */
export function getOnboardingPrompt(state: OnboardingState): string {
  const phasePrompt = PHASE_PROMPTS[state.phase] || PHASE_PROMPTS.welcome;
  const stateContext = getStateContext(state);
  const workflowContext = getWorkflowSuggestionsContext(state.suggested_workflows);
  
  // Combine all parts
  return [
    BASE_PROMPT,
    stateContext,
    workflowContext,
    phasePrompt,
  ].filter(Boolean).join('\n');
}

/**
 * Parse agent response for special syntax
 */
export function parseOnboardingActions(response: string): Array<{
  type: 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action';
  payload: string;
  raw: string;
}> {
  const actions: Array<{
    type: 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action';
    payload: string;
    raw: string;
  }> = [];
  
  // Match all [[type:payload]] patterns
  const pattern = /\[\[(integration|welcome|subagent|context|workflow|action):([^\]]+)\]\]/g;
  let match;
  
  while ((match = pattern.exec(response)) !== null) {
    actions.push({
      type: match[1] as 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action',
      payload: match[2],
      raw: match[0],
    });
  }
  
  return actions;
}

/**
 * Remove special syntax from response for display
 */
export function stripOnboardingActions(response: string): string {
  return response.replace(/\[\[(integration|welcome|subagent|context|workflow|action):[^\]]+\]\]/g, '').trim();
}

/**
 * Determine if user message indicates they want to skip
 */
export function detectSkipIntent(message: string): boolean {
  const skipPhrases = [
    'skip',
    'later',
    'not now',
    "i'll connect these later",
    'next',
    'move on',
    'skip ahead',
    'just take me to',
    'dashboard',
    'skip onboarding',
    'done for now',
  ];
  
  const lower = message.toLowerCase();
  return skipPhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Determine if user message indicates they want to complete onboarding
 */
export function detectCompleteIntent(message: string): boolean {
  const completePhrases = [
    'just take me to dashboard',
    'skip onboarding',
    "i'm done",
    'finish onboarding',
    'complete onboarding',
    'skip all',
  ];
  
  const lower = message.toLowerCase();
  return completePhrases.some((phrase) => lower.includes(phrase));
}

/**
 * Extract user name from a message (simple heuristic)
 */
export function extractUserName(message: string): string | null {
  // Common patterns: "I'm X", "My name is X", "Call me X", "It's X", "X"
  const patterns = [
    /(?:i'?m|i am|my name is|call me|it's|name'?s?)\s+([a-zA-Z]+)/i,
    /^([a-zA-Z]+)$/i, // Just a single word (likely a name)
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
      // Capitalize first letter
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }
  
  return null;
}

/**
 * Check if response contains a name assignment for the agent
 */
export function extractAgentName(message: string): string | null {
  // Common patterns: "Call you X", "How about X", "Let's go with X", "X sounds good", "X"
  const patterns = [
    /(?:call you|how about|let'?s go with|i'?ll call you|you'?re|your name is|be called)\s+([a-zA-Z]+)/i,
    /^([a-zA-Z]+)(?:\s+sounds?\s+good)?$/i,
    /([a-zA-Z]+)\s+(?:sounds?\s+good|works?|is\s+good|is\s+fine)/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
      // Filter out common non-name words
      const nonNames = ['that', 'this', 'sure', 'yes', 'yeah', 'okay', 'ok', 'fine', 'good', 'great'];
      if (nonNames.includes(match[1].toLowerCase())) continue;
      
      // Capitalize first letter
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }
  
  return null;
}

/**
 * Generate integration awareness context for the prompt
 */
export function getIntegrationAwarenessContext(): string {
  const apiIntegrations = getIntegrationsWithApi();
  const browserOnlyIntegrations = getIntegrationsWithBrowserOnly();
  
  const popularApi = ['Google Workspace', 'Slack', 'Notion', 'GitHub', 'HubSpot', 'Salesforce'];
  const browserOnly = ['LinkedIn', 'WhatsApp', 'Instagram', 'Facebook', 'TikTok'];
  
  return `
## Integration Capabilities

You have access to ${apiIntegrations.length}+ services via API and unlimited browser access.

**API Integrations** (fast, reliable, automatic):
- ${popularApi.join(', ')}, and ${apiIntegrations.length - popularApi.length}+ more
- Use [[integration:provider]] syntax to show connect buttons
- Prefer API when available — it's faster and more reliable

**Browser-Only Services** (no API, browser automation required):
- ${browserOnly.join(', ')}
- These require browser login — user must be logged in
- Use browser for visual tasks, unsupported operations, or as fallback

**Routing Guidelines:**
1. For supported services with API → suggest API connection first
2. For browser-only services → explain browser will be used
3. For visual tasks ("check formatting", "see the layout") → use browser
4. If API fails → offer browser fallback when available
5. For unknown services → default to browser

**When suggesting integrations:**
- Mention the benefit: "I can connect to Google to help with email and calendar"
- For browser-only: "LinkedIn doesn't have API access, so I'll use browser automation"
- After connecting: "Great! I now have API access to [service]"
`;
}

/**
 * Get integration intro message for onboarding
 */
export function getOnboardingIntegrationIntro(): string {
  const apiCount = getIntegrationsWithApi().length;
  return `I can connect to ${apiCount}+ apps via API (like Google, Slack, and Notion), plus access any website through browser automation. This means I can help you with pretty much anything!`;
}

/**
 * Enhanced getOnboardingPrompt with integration awareness
 */
export function getOnboardingPromptWithIntegrations(state: OnboardingState): string {
  const basePrompt = getOnboardingPrompt(state);
  const integrationContext = getIntegrationAwarenessContext();
  
  // Insert integration context before the phase-specific prompt
  const parts = basePrompt.split('## Current Phase:');
  if (parts.length === 2) {
    return parts[0] + integrationContext + '\n## Current Phase:' + parts[1];
  }
  
  return basePrompt + '\n' + integrationContext;
}
