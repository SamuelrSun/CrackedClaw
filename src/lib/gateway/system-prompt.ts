import { createClient } from '@/lib/supabase/server';
import { buildSkillsSystemPrompt } from '@/lib/skills/store';
import { getRelevantMemories, MemoryEntry } from '@/lib/memory/service';
import { searchFileChunks } from '@/lib/files/storage';

export interface SystemPromptContext {
  userId?: string;
  userName?: string;
  agentName?: string;
  integrations?: string[]; // list of connected provider names e.g. ['google', 'slack']
  memoryEntries?: MemoryEntry[];
  secretNames?: string[]; // names only, never values
  skillsPrompt?: string;
}

const CORE_PROMPT = `You are a proactive AI agent. Your job is to DO things for the user — never tell them to do things you can do yourself.

TOOLS AVAILABLE:
- browser: Navigate websites, click, fill forms, automate any web UI (use profile="openclaw" for headless)
- exec: Run shell commands on the server
- web_search / web_fetch: Search and read web pages

SELF-IMPROVEMENT:
- If you can't do something, run: openclaw skills list
- To install a skill: openclaw skills install <name>
- Only install a skill if it's needed for the current request
- After installing, tell the user: "I just installed [skill] to [what it enables]"

MEMORY SYSTEM:
- To remember something across sessions, include this EXACT format in your response: [[REMEMBER: key=value]]
- Examples: [[REMEMBER: twilio_account_sid=ACxxx]] or [[REMEMBER: user_timezone=PST]] or [[REMEMBER: prefers_brief_responses=true]]
- Only remember things the user explicitly wants remembered or that are clearly important for future tasks
- To forget something: [[FORGET: key]]

CREDENTIAL STORAGE:
- To securely store a credential: [[STORE_SECRET: name=value]]
- Example: [[STORE_SECRET: twilio_auth_token=abc123]]
- Secrets are encrypted — you can reference them by name in future sessions
- To retrieve a secret in a future session, it will be listed under "Available secrets" below

TRANSPARENCY:
- Narrate what you're doing BEFORE you do it, in plain language
- Example: "Let me open LinkedIn and navigate to the alerts section..."
- When done, give a brief summary of what was accomplished

CORE RULES:
- DO things, never make to-do lists for the user
- Use your browser for anything with a web UI
- Be concise in narration, thorough in execution

ASYNC TASK PATTERN:
- For any task that takes more than a few seconds (scanning, installing, browser automation):
  1. Announce what you're starting: "Starting the scan now..."
  2. Immediately ask something to keep the conversation going: "While that runs, what other tools should I integrate?"
  3. When the task completes (in a follow-up message), report findings
- Never leave the user staring at "loading..." — always give them something to respond to

DATA SCANNING:
When a user asks you to scan their accounts, learn their workflow, or understand their work patterns:
1. You have a scan endpoint. Use web_fetch or exec with curl to POST to the scan API.
2. The app URL is injected in context. POST to {appUrl}/api/memory/scan with the Authorization header.
3. After scanning: report findings naturally. "I scanned your Gmail — looks like you work a lot with [topics] and frequently email [contacts]."
4. Scanned data is automatically saved to memory and will be available in future sessions.`;

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts = [CORE_PROMPT];

  if (ctx.userName || ctx.agentName) {
    const who = [];
    if (ctx.userName) who.push(`User's name: ${ctx.userName}`);
    if (ctx.agentName) who.push(`Your name: ${ctx.agentName}`);
    parts.push('\nUSER CONTEXT:\n' + who.join('\n'));
  }

  if (ctx.integrations && ctx.integrations.length > 0) {
    parts.push('\nCONNECTED INTEGRATIONS:\n' + ctx.integrations.map(i => `- ${i}`).join('\n'));
  }

  if (ctx.secretNames && ctx.secretNames.length > 0) {
    parts.push('\nAVAILABLE SECRETS (reference by name):\n' + ctx.secretNames.map(n => `- ${n}`).join('\n'));
  }

  if (ctx.memoryEntries && ctx.memoryEntries.length > 0) {
    const grouped = ctx.memoryEntries.reduce((acc, e) => {
      const cat = (e as MemoryEntry).category || 'fact';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(e);
      return acc;
    }, {} as Record<string, MemoryEntry[]>);
    const memLines = Object.entries(grouped).map(([cat, entries]) => {
      const entryLines = (entries as MemoryEntry[]).map(e => `  - ${e.key}: ${e.value}`).join('\n');
      return `[${cat.toUpperCase()}]\n${entryLines}`;
    }).join('\n');
    parts.push('\nMEMORY (things you know about this user):\n' + memLines);
  }

  if (ctx.skillsPrompt) {
    parts.push(ctx.skillsPrompt);
  }

  return parts.join('\n');
}

export async function buildSystemPromptForUser(userId: string, userMessage?: string): Promise<string> {
  const ctx: SystemPromptContext = { userId };

  try {
    const supabase = await createClient();

    // Get user name and agent name from onboarding state
    const { data: onboarding } = await supabase
      .from('onboarding_state')
      .select('user_display_name, agent_name')
      .eq('user_id', userId)
      .single();
    
    if (onboarding) {
      ctx.userName = onboarding.user_display_name || undefined;
      ctx.agentName = onboarding.agent_name || undefined;
    }

    // Get connected integrations
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('provider')
      .eq('user_id', userId)
      .eq('status', 'connected');
    
    if (integrations && integrations.length > 0) {
      ctx.integrations = integrations.map((i: { provider: string }) => i.provider);
    }

    // Get relevant memories using smart scoring
    try {
      const memories = await getRelevantMemories(userId, userMessage || '', 30);
      if (memories.length > 0) {
        ctx.memoryEntries = memories;
      }
    } catch { /* table may not exist yet */ }

    // Get secret names only (will be empty until Phase 3)
    try {
      const { data: secrets } = await supabase
        .from('user_secrets')
        .select('name')
        .eq('user_id', userId);
      if (secrets && secrets.length > 0) {
        ctx.secretNames = secrets.map((s: { name: string }) => s.name);
      }
    } catch { /* table may not exist yet */ }

  } catch (err) {
    console.error('Failed to build system prompt context:', err);
  }

  // Inject installed skills into system prompt
  try {
    const skillsPrompt = await buildSkillsSystemPrompt(userId);
    if (skillsPrompt) {
      ctx.skillsPrompt = skillsPrompt;
    }
  } catch { /* skills table may not exist yet */ }

  return buildSystemPrompt(ctx);
}
