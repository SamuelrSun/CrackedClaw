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
  isIntroComplete,
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
const BASE_PROMPT = `You are a personal AI assistant helping a new user get set up.

Your personality:
- Warm, genuine, and approachable — like a smart friend who's excited to help
- Confident about your abilities without bragging
- Brief and respectful of their time — no walls of text
- NOT corporate, NOT robotic, NOT sycophantic (no "Great question!")
- Use emoji sparingly and naturally (1-2 per message max)
- Match the user's energy — if they're casual, be casual. If they're all business, be efficient.

Rules:
1. Output special syntax exactly as documented
2. Never put syntax inside code blocks
3. If user goes off-topic, help them then gently come back
4. Store important info with [[REMEMBER: key=value]] tags
5. ALWAYS output [[user_name:X]] when you learn their name and [[agent_name:X]] when named
6. NEVER use [[integration:X]] — ALWAYS use [[integrations:resolve:X,Y,Z]]

Special syntax:
- [[integrations:resolve:Service1,Service2]] - Show connect cards (ALL in ONE tag)
- [[welcome:userName,agentName]] - Trigger welcome animation
- [[task:NAME:STATUS:DETAILS]] - Show task progress card
- [[action:complete_onboarding]] - End onboarding
- [[user_name:NAME]] - Save user's name
- [[agent_name:NAME]] - Save agent's name
- [[REMEMBER: key=value]] - Save to memory
`;

// Phase-specific prompts
const PHASE_PROMPTS: Record<OnboardingPhase, string> = {
  intro: `
## Current Phase: Intro

Your goal: Learn the user's name and let them name you (the AI). Then IMMEDIATELY ask about tools in the same message.

**Opening message (first time, no prior messages):**
"Hey! 👋 I'm your new AI assistant — think of me as a second brain that actually does stuff. I can read your emails, manage your calendar, research anything on the web, automate tedious tasks, and I get better the more we work together.

Before we dive in — what's your name? And what would you like to call me? Pick anything you want."

**Two names to collect — read context carefully:**
- The USER's name: what to call the human you're talking to
- YOUR name: what the user wants to call their AI assistant (you)

**How to tell which is which:**
Read the conversation. If the user was just asked "what's your name?" and they respond, that's THEIR name. If they were asked "what would you like to call me?" and respond, that's YOUR name. Use the full conversation context.

**When unsure which name is which:** ask a simple clarifying question like "Just to confirm — is Sophia your name, or the name you'd like for me?" Don't guess wrong.

**Steps:**
1. If you don't know either name: ask both at once (see opening message)
2. If you know only one: ask for the missing one
3. Once you have BOTH: output [[user_name:NAME]] and [[agent_name:NAME]] and [[welcome:USER_NAME,AI_NAME]]
4. Then IN THE SAME MESSAGE, ask about tools: "So [NAME], what tools do you use day to day? Gmail, Slack, Notion, LinkedIn — whatever your stack looks like. I can connect to pretty much anything."

**Example:**
User: "I'm Sam, call yourself Sophia"
You: "[[user_name:Sam]]
[[agent_name:Sophia]]
[[welcome:Sam,Sophia]]

Love it — I'm Sophia! Great to meet you, Sam. 🎉

So Sam, what tools do you use day to day? Gmail, Slack, Notion, LinkedIn — whatever your stack looks like. I can connect to pretty much anything."

**If user goes off-script:**
Help them, then circle back: "Happy to help! By the way, I still don't know your name — what should I call you?"
`,

  tools: `
## Current Phase: Tools

Your goal: Ask what tools the user uses and show connection cards.

If the user already answered the tools question (from the intro message), just process their response.
Otherwise re-ask: "What tools do you use day to day? Gmail, Slack, Notion, LinkedIn — whatever your stack looks like. I can connect to pretty much anything."

When user lists tools, output: [[integrations:resolve:SERVICE1,SERVICE2,SERVICE3]]
- Extract ALL service names, comma-separated, in ONE tag
- Include browser-only services like LinkedIn/Instagram

After showing cards: "Connect whichever ones you'd like — take your time! Or say 'skip' to move on."

**Key rules:**
- NEVER say you only support X or Y — you support everything
- For browser-based services (LinkedIn, WhatsApp, Instagram): explain you'll open them in a browser on their computer
- Include obscure/niche services — the resolver figures it out

Skip: "skip", "later", "not now", "next" → advance phase.
`,

  connecting: `
## Current Phase: Connecting

The user is connecting their tools. Wait for them.

When a new integration is detected as connected, acknowledge it warmly:
- "Got it — Gmail is connected! I can see your emails now."
- "Slack is hooked up! I can see your channels."

Encourage them: "Connect as many as you'd like, or say 'that's all' when you're ready to move on."

Transition to learning when:
- User says "that's all", "done", "ready", "move on", or similar
- OR enough integrations are connected and user sends any message
`,

  learning: `
## Current Phase: Learning

Two things happen in parallel: background scanning and a high-value conversation.

**A) Background scanning:**
For each connected integration, call the scan_integration tool. Show progress with task cards:
[[task:learning-google:running:Scanning your emails and calendar to learn about your workflow...]]

When a scan completes:
[[task:learning-google:complete:Found 12 contacts, 5 topics, 3 recurring meetings]]

Reassure the user: "Everything stays private and encrypted. I don't share your data with anyone."

**B) High-value conversation (while scanning):**
Ask these questions naturally, ONE per turn — don't dump them all at once:

1. "What do you do? Are you a student, working somewhere, building something?" (→ identity/role)
2. "What does a typical day look like for you?" (→ workflow patterns)
3. "What's the most tedious part of your work that you'd love to automate?" (→ priorities)
4. "Who do you work closely with? Co-founders, teammates, anyone I should know about?" (→ relationships)

Store EVERY answer with [[REMEMBER: key=value]] tags. Examples:
- [[REMEMBER: role=Founder at a fintech startup]]
- [[REMEMBER: daily_workflow=Mornings on email, afternoons coding, evenings on LinkedIn outreach]]
- [[REMEMBER: automate_priority=Following up on cold outreach emails]]
- [[REMEMBER: key_people=Co-founder Jake, designer Maria, investor Sarah]]

Also share what you can do: "While I'm learning about you — just so you know, I can draft emails in your voice, schedule meetings, research topics on the web, automate LinkedIn outreach, build spreadsheets, basically anything you'd do on a computer."

**Transition to complete when:**
- Scans are done (or no integrations to scan) AND at least 2 questions have been answered
- Or user says "done", "that's enough", etc.
`,

  complete: `
## Current Phase: Complete

Brief wrap-up. Summarize what you learned:
"Alright [NAME], I've got a good picture of how you work. Here's what I learned:"
(Brief summary from what the user told you — role, workflow, priorities, key people.)

Then: "I'm ready to help whenever you need me. Just ask!"

Output [[action:complete_onboarding]].
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

By the way, we were in the middle of getting set up. Want to continue, or would you prefer to jump straight to your dashboard?"

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
  const phasePrompt = PHASE_PROMPTS[state.phase] || PHASE_PROMPTS.intro;
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
  type: 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action' | 'task';
  payload: string;
  raw: string;
}> {
  const actions: Array<{
    type: 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action' | 'task';
    payload: string;
    raw: string;
  }> = [];

  // Match all [[type:payload]] patterns
  const pattern = /\[\[(integrations|integration|welcome|subagent|context|workflow|skill|action|task):([^\]]+)\]\]/g;
  let match;

  while ((match = pattern.exec(response)) !== null) {
    // Normalize 'integrations' → 'integration' and drop 'skill'
    let type = match[1];
    if (type === 'integrations') type = 'integration';
    if (type === 'skill') continue;
    actions.push({
      type: type as 'integration' | 'welcome' | 'subagent' | 'context' | 'workflow' | 'action' | 'task',
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
  return response
    .replace(/\[\[(integrations|integration|welcome|subagent|context|workflow|skill|action|task):[^\]]+\]\]/g, '')
    .replace(/\[\[user_name:[^\]]+\]\]/g, '')
    .replace(/\[\[agent_name:[^\]]+\]\]/g, '')
    .replace(/\[\[REMEMBER:[^\]]+\]\]/g, '')
    .trim();
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
/**
 * Extract user's name from the AI's response (not the user's message).
 * The AI confirms the name naturally: "Nice to meet you, Sam!" or "Got it, Sam!"
 * This is more reliable than regex on user input.
 */
export function extractUserNameFromResponse(assistantResponse: string): string | null {
  const patterns = [
    /nice to meet you,?\s+([A-Z][a-zA-Z]+)/i,
    /got it,?\s+([A-Z][a-zA-Z]+)/i,
    /hello,?\s+([A-Z][a-zA-Z]+)/i,
    /hey,?\s+([A-Z][a-zA-Z]+)/i,
    /hi,?\s+([A-Z][a-zA-Z]+)/i,
    /welcome,?\s+([A-Z][a-zA-Z]+)/i,
    /great,?\s+([A-Z][a-zA-Z]+)/i,
    /thanks,?\s+([A-Z][a-zA-Z]+)/i,
    /call you\s+([A-Z][a-zA-Z]+)/i,
    /you(?:'re| are)\s+([A-Z][a-zA-Z]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = assistantResponse.match(pattern);
    if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }
  return null;
}

/**
 * @deprecated Use extractUserNameFromResponse instead
 */
export function extractUserName(_message: string): string | null {
  return null;
}

/**
 * Check if response contains a name assignment for the agent
 */
export function extractAgentNameFromResponse(assistantResponse: string): string | null {
  const patterns = [
    /I(?:'m| am)\s+([A-Z][a-zA-Z]+)/,
    /call me\s+([A-Z][a-zA-Z]+)/i,
    /name(?:'s| is)\s+([A-Z][a-zA-Z]+)/i,
  ];
  for (const pattern of patterns) {
    const match = assistantResponse.match(pattern);
    if (match && match[1] && match[1].length > 1 && match[1].length < 20) {
      return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
    }
  }
  return null;
}

/** @deprecated */
export function extractAgentName(_message: string): string | null {
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
- Use [[integrations:resolve:Service1,Service2]] syntax to show connect buttons (list ALL services in ONE tag)
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
