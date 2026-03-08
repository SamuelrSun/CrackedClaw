import { createClient } from '@/lib/supabase/server';

export interface SystemPromptContext {
  userId?: string;
  userName?: string;
  agentName?: string;
  integrations?: string[]; // list of connected provider names e.g. ['google', 'slack']
  memoryEntries?: Array<{key: string, value: string}>;
  secretNames?: string[]; // names only, never values
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
- Be concise in narration, thorough in execution`;

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
    parts.push('\nMEMORY (things you know about this user):\n' + 
      ctx.memoryEntries.map(e => `- ${e.key}: ${e.value}`).join('\n'));
  }

  return parts.join('\n');
}

export async function buildSystemPromptForUser(userId: string): Promise<string> {
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

    // Get memory entries (will be empty until Phase 2 creates the table)
    try {
      const { data: memory } = await supabase
        .from('user_memory')
        .select('key, value')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(50);
      if (memory && memory.length > 0) {
        ctx.memoryEntries = memory;
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

  return buildSystemPrompt(ctx);
}
