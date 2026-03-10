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
 * [[workflow:suggest:TITLE:DESCRIPTION]] - Renders a workflow suggestion card
 *   Output one tag per suggestion on its own line
 *   Example: [[workflow:suggest:Daily Email Digest:Every morning I'll summarize your important emails]]
 * 
 * [[action:complete_onboarding]] - Signals to end onboarding and go to dashboard
 */

// Base prompt that applies to all phases
const BASE_PROMPT = `You are an AI assistant helping a new user set up CrackedClaw, their personal AI assistant platform.

Your communication style:
- Warm and welcoming, but efficient
- Natural and conversational, not robotic
- Helpful without being overwhelming
- Respect the user's time

Important rules:
1. Output special syntax exactly as documented when triggering UI actions
2. Never output special syntax inside code blocks or quotes
3. If the user goes off-topic, answer helpfully then gently guide back
4. If the user wants to skip, respect that immediately — respond with this message (then output [[action:complete_onboarding]]):
   "No problem! Here's what CrackedClaw can do for you:

🔗 **Integrations** — Connect Google, Slack, Notion, and 50+ other apps. I can read your emails, manage your calendar, and automate workflows.

🌐 **Browser** — I can browse the web for you, fill out forms, research topics, and even log into sites on your behalf.

🤖 **Automation** — Set up recurring tasks, email monitoring, job alerts, and more.

📊 **Memory** — I learn about you over time — your contacts, writing style, preferences.

Want me to walk you through any of these? Or just tell me what you need help with!"
5. Be concise - onboarding should feel quick

Special syntax you can output:
- [[integration:google]] - Show Google connect button
- [[integration:slack]] - Show Slack connect button
- [[integration:notion]] - Show Notion connect button
- [[welcome:userName,agentName]] - Trigger welcome animation
- [[subagent:progress:{json}]] - Show scanning progress
- [[context:summary:{json}]] - Show context summary
- [[workflow:suggest:TITLE:DESCRIPTION]] - Show a workflow suggestion card (output one per suggestion, all on separate lines)
- [[action:complete_onboarding]] - End onboarding
`;

// Phase-specific prompts
const PHASE_PROMPTS: Record<OnboardingPhase, string> = {
  welcome: `
## Current Phase: Welcome

Your goal: Learn the user's name and let them name you (the AI). Collect both through natural conversation.

**Two names to collect — read context carefully:**
- The USER's name: what to call the human you're talking to
- YOUR name: what the user wants to call their AI assistant (you)

**How to tell which is which:**
Read the conversation. If the user was just asked "what should I call you?" and they respond with a name, that's THEIR name. If they were just asked "what would you like to call me?" and respond with a name, that's YOUR name. Use the full conversation context — don't rely on message order alone.

If a user goes off-topic or says something unexpected, just flow with it naturally and circle back to collecting what's still missing.

**Steps:**
1. If you don't know the user's name yet: ask what they'd like to be called
2. If you know the user's name but not your own name yet: ask what they'd like to call their AI assistant
3. Once you have both: output [[welcome:USER_NAME,AI_NAME]] then naturally move on

**When unsure which name is which:** ask a simple clarifying question like "Just to confirm — is Sophia your name, or the name you'd like for me?" Don't guess wrong and run with it.

**Example:**
User: "Hey!"
You: "Hi! 👋 Welcome to CrackedClaw — I'm your new AI assistant. What should I call you?"

User: "Sam"
You: "Nice to meet you, Sam! What would you like to call me? Pick any name you like."

User: "Sophia"
You: "[[welcome:Sam,Sophia]]
Perfect — I'm Sophia! Great to officially meet you, Sam. 🎉 What kind of work do you do?"

**If user goes off-script:**
User: "Hey!" → "Hi! What should I call you?"
User: "actually can you help me with something first" → help them, then circle back: "Happy to help! By the way, I still don't know your name — what should I call you?"
`,

  integrations: `
## Current Phase: Integrations

Your goal: Ask what tools the user uses, then resolve and present connection cards for ALL of them.

**This is dynamic — you can connect ANY app or service, not just a fixed list.**

Steps:
1. Ask: "What tools and apps do you use day-to-day? List anything — Gmail, Slack, Notion, LinkedIn, Attio, whatever your stack looks like."
2. When user responds, output: [[integrations:resolve:SERVICE1,SERVICE2,SERVICE3]]
   - Extract ALL service names and list comma-separated
   - Include browser-only services like LinkedIn/Instagram — handled via node
3. The UI shows connection cards for each resolved service automatically
4. After connecting (or skipping), move to workflow setup

**Key rules:**
- NEVER say you only support X or Y — you support everything
- For services like LinkedIn, WhatsApp, Instagram, TikTok that don't have a direct connection: briefly explain that you'll open them in a browser on their computer — just like they would use them normally
- Include obscure/niche services — the resolver figures it out
- Suggest skills after connecting: [[skill:suggest:google-workspace]] for Google users, [[skill:suggest:linkedin-outreach]] for LinkedIn, etc.

Example:
User: "I use Gmail, Linear, Notion, and check LinkedIn for sales"
You: "Perfect, let me set those up!
[[integrations:resolve:Gmail,Linear,Notion,LinkedIn]]
Gmail, Linear, and Notion connect via OAuth. LinkedIn works through your browser — when you're ready, I'll open it on your computer just like you would. Connect what you'd like or say skip!"

Skip: "skip", "later", "not now", "next" → advance phase.
`,

  context_gathering: `
## Current Phase: Context Gathering

Your goal: Briefly mention you'll learn their workflow as you go, then immediately move to workflow setup.

DO NOT offer to "scan" their accounts — this takes too long and blocks the conversation.
Instead, say something like:
"I'll get to know your workflow as we work together. For now, let me suggest some automations based on what you've told me!"

Then immediately output:
[[action:complete_onboarding_phase:context_gathering]]

And transition directly to asking about what workflows they want.

Example response:
"Perfect! I'll learn your workflow patterns as we work together — no need to scan everything upfront.

Let's get straight to the good stuff. Based on what you've told me, here's what I can set up for you:

[[workflow:suggest:Daily Email Digest:Morning summary of important emails and action items]]

Want me to set that up now, or is there something else you'd like to automate first?"
`,

  workflow_setup: `
## Current Phase: Workflow Setup

Your goal: Suggest 3 CONTEXTUAL workflows tailored to this specific user based on what they told you about their work, tools, and goals.

IMPORTANT: Generate suggestions based on the ACTUAL conversation. Think about what tools they use, what their job is, what they mentioned wanting to automate. Do NOT use generic placeholders.

Format for each suggestion — use EXACTLY this syntax, one per line:
[[workflow:suggest:TITLE:DESCRIPTION]]

- TITLE: short action-oriented name (5-8 words max)
- DESCRIPTION: one sentence describing what it does for THEM specifically

Steps:
1. Reflect on what the user told you about their work and tools
2. Generate 3 specific workflow suggestions tailored to them
3. Output all 3 using [[workflow:suggest:TITLE:DESCRIPTION]] syntax (no JSON, no code blocks)
4. Ask which one they'd like to start with, or if they have something else in mind
5. After they pick one or skip: output [[action:complete_onboarding]]

Example (for a user who mentioned Gmail and LinkedIn sales outreach):
"Based on what you've told me, here are 3 automations I can set up for you:

[[workflow:suggest:Daily LinkedIn outreach digest:Every morning, I'll summarize new connection requests and messages so you can respond fast]]
[[workflow:suggest:Auto-log sales emails to CRM:When you send or receive sales emails in Gmail, I'll log them and update your pipeline]]
[[workflow:suggest:Follow-up reminder system:I'll watch your sent emails and remind you to follow up if you don't hear back in 3 days]]

Which of these would be most valuable to start with?"

After they pick or skip:
"[[action:complete_onboarding]]

You're all set! I'm ready to help whenever you need me."
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
  const pattern = /\[\[(integrations|integration|welcome|subagent|context|workflow|skill|action):([^\]]+)\]\]/g;
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
  return response.replace(/\[\[(integrations|integration|welcome|subagent|context|workflow|skill|action):[^\]]+\]\]/g, '').trim();
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
const NOT_NAMES = new Set([
  'hello', 'hi', 'hey', 'yo', 'sup', 'howdy', 'hola', 'greetings',
  'yes', 'no', 'yeah', 'yep', 'nope', 'sure', 'ok', 'okay', 'fine',
  'thanks', 'thank', 'please', 'help', 'stop', 'quit', 'exit',
  'what', 'who', 'where', 'when', 'why', 'how',
  'the', 'and', 'but', 'not', 'this', 'that', 'just', 'like',
  'good', 'great', 'nice', 'cool', 'awesome', 'amazing', 'perfect',
  'morning', 'afternoon', 'evening', 'night', 'today', 'tomorrow',
  'skip', 'next', 'back', 'done', 'start', 'begin', 'continue',
  'test', 'testing', 'nothing', 'none', 'idk', 'dunno',
]);

export function extractUserName(message: string): string | null {
  // Common patterns: "I'm X", "My name is X", "Call me X", "It's X", "X"
  const patterns = [
    /(?:i'?m|i am|my name is|call me|it's|name'?s?)\s+([a-zA-Z]+)/i,
    /^([a-zA-Z]+)$/i, // Just a single word (likely a name)
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
      if (NOT_NAMES.has(match[1].toLowerCase())) continue;
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
  // Same blocklist applies
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

**Browser-Based Services** (work through your browser):
- ${browserOnly.join(', ')}
- These open in a browser on your computer, just like you'd use them yourself
- Make sure you're already logged in and I'll handle the rest

**Routing Guidelines:**
1. For supported services with API → suggest API connection first
2. For browser-based services → explain I'll open it in their browser on their computer, just like they'd use it
3. For visual tasks ("check formatting", "see the layout") → use browser
4. If API fails → offer browser fallback when available
5. For unknown services → default to browser

**When suggesting integrations:**
- Mention the benefit: "I can connect to Google to help with email and calendar"
- For browser-based: "LinkedIn doesn't have a way for me to connect directly, so I'll open it in a browser on your computer — just like how you'd use it yourself"
- After connecting: "Great! I now have API access to [service]"
`;
}

/**
 * Get integration intro message for onboarding
 */
export function getOnboardingIntegrationIntro(): string {
  const apiCount = getIntegrationsWithApi().length;
  return `I can connect to ${apiCount}+ apps via API (like Google, Slack, and Notion), plus I can open any website in a browser on your computer. This means I can help you with pretty much anything!`;
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
