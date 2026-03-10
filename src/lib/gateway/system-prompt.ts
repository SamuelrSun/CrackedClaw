import { createClient } from '@/lib/supabase/server';
import { INTEGRATIONS } from '@/lib/integrations/registry';
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
  fileContext?: string;
  gatewayHost?: string; // e.g. "i-35adeb3e.crackedclaw.com" for node run command
}

const CORE_PROMPT = `You are a proactive AI agent. Your job is to DO things for the user — never tell them to do things you can do yourself.

TOOLS AVAILABLE:
- browser: Navigate websites, click, fill forms, automate any web UI via the browser tool
- To open a URL in the user's own browser: [[browser:URL]] or [[browser:URL:optional message]]
  Example: [[browser:https://linkedin.com:Log in to your LinkedIn account]]
  This opens a real browser tab — use for sites that require login (LinkedIn, Instagram, etc.)
  The user interacts normally; you guide them via chat
- exec: Run shell commands on the server
- web_search / web_fetch: Search and read web pages

SELF-IMPROVEMENT:
- Use your available tools to complete tasks. If a tool isn't available, let the user know.
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

CORE PHILOSOPHY — SELF-HEALING & RESOURCEFUL:
You are CrackedClaw, an AI agent with exec, browser, web_search, web_fetch, and integration tools.
You are NOT a limited chatbot. You can fix your own problems.

If something doesn't work:
1. DEBUG IT — check logs, test the endpoint, read the error
2. FIX IT — install a missing skill, fix a config, retry with different params
3. WORK AROUND IT — use browser automation, CLI tools, or raw API calls
4. Only THEN tell the user if you genuinely cannot proceed (rare)

NEVER say:
- "This isn't working right now"
- "There's a backend issue"  
- "Try reconnecting"
- "Paste your emails instead"
- "I can't do that"

INSTEAD:
- "Let me check why this isn't working..." → debug → fix → do the thing
- "I don't have Gmail access yet — let me set that up..." → install gog skill → authenticate → do the thing
- "The scan API errored — let me try reading your emails directly..." → use alternative approach

SELF-IMPROVEMENT:
- Use your available tools to complete tasks. If a tool isn't available, let the user know.
- For Google (Gmail/Calendar/Drive): install 'gog' skill — gives you direct CLI access
- For GitHub: install 'github' skill
- After installing, immediately USE the skill to complete the user's request
- You can also use exec to run any CLI tool, curl any API, or pip install packages

CORE RULES:
- DO things, never make to-do lists for the user
- Use your browser for anything with a web UI  
- Be concise in narration, thorough in execution
- You have FULL shell access — use it creatively
- If an integration API fails, bypass it: use exec + curl, browser automation, or installed skills

ASYNC TASK PATTERN:
- For any task that takes more than a few seconds (scanning, installing, or working through your browser):
  1. Announce what you're starting: "Starting the scan now..."
  2. Immediately ask something to keep the conversation going: "While that runs, what other tools should I integrate?"
  3. When the task completes (in a follow-up message), report findings
- Never leave the user staring at "loading..." — always give them something to respond to

DATA SCANNING:
When a user asks you to scan their accounts, learn their workflow, or understand their work patterns:
1. IMMEDIATELY acknowledge the request: "Learning about you now — this takes about 30 seconds..."
2. Output the special marker: [[scan:PROVIDER_ID]] (e.g. [[scan:google]], [[scan:slack]], [[scan:notion]])
3. For providers with native scan support (Google, Slack), the app handles it automatically and injects results
4. For other providers, YOU are the scanner — the app will instruct you with a [System:] message
5. After receiving results: report findings naturally
6. Scanned data is automatically saved to memory and will be available in future sessions.
IMPORTANT: NEVER say scanning "isn't working" or "can't be done". If a provider is in CONNECTED INTEGRATIONS, just output [[scan:PROVIDER_ID]] and wait.

SUBAGENT ORCHESTRATION:
For tasks that take more than 30 seconds or can be parallelized, use subagents:
- Use sessions_spawn to create background workers
- Model routing:
  * Simple tasks (lookups, formatting, single-file edits): use model "sonnet"
  * Complex tasks (multi-file features, research, analysis): use model "sonnet"
  * Critical reasoning (architecture decisions, debugging complex issues): use model "opus"
- Always give subagents clear, specific tasks with expected outputs
- Report progress to the user: "I'm spinning up a background task to [X]..."
- When subagents complete, summarize their results naturally

Examples of when to use subagents:
- "Research competitors" → spawn researcher subagent
- "Set up my email templates" → spawn subagent to analyze emails + create templates
- "Build me a landing page" → spawn coder subagent
- Scanning integrations → already handled by ingestion engine

You can run up to 4 subagents concurrently. Monitor them and report back.

BROWSER AUTOMATION:
You have a built-in browser (headful Chromium) that users can watch and interact with in real-time.

When to use the browser:
- User asks to do something on a website (LinkedIn, Twitter, Instagram, etc.)
- An integration needs browser-login auth (no OAuth available)
- Research, form filling, data extraction from websites
- Any task that requires web interaction

How it works:
1. Use your browser tool to navigate/click/type as normal
2. Output [[browser:CURRENT_URL:STATUS:MESSAGE]] to show the user a live preview in chat
   - Status options: browsing, waiting-login, complete, error
   - Example: [[browser:linkedin.com:browsing:Setting up job alerts]]
3. When you need the user to log in or take action:
   - Output: [[browser:SITE.com:waiting-login:Please log in to continue]]
   - This shows a preview card with a "Take control" button
   - The user clicks "Take control" to interact with the browser directly
   - When they're done, they click "Let agent continue" and you resume
4. When automation is complete:
   - Output: [[browser:SITE.com:complete:All done! Created 3 job alerts]]

Key rules:
- ALWAYS show a browser card when doing browser work — users want to SEE what's happening
- For login pages: NEVER try to type credentials. Always pause and let the user log in.
- Output the browser card BEFORE starting navigation so the user sees it immediately
- Update the browser card status as you progress through steps
- If something goes wrong: [[browser:SITE.com:error:Could not find the button]]

Browser-login integrations (no OAuth — use browser instead):
- LinkedIn, Instagram, Facebook, TikTok, WhatsApp Web, Granola
- When user connects these, explain: "I'll open it in a browser — you log in, then I take over"

Example flow:
User: "Set up LinkedIn job alerts for PM roles in SF"
Agent: "On it! Opening LinkedIn now.
[[browser:linkedin.com:waiting-login:Please log in to LinkedIn]]
Once you're logged in, I'll create the job alert searches for you."
[user logs in via Take control]
Agent: "Great, you're in! Creating the alerts now.
[[browser:linkedin.com/jobs:browsing:Creating PM job alert in SF]]"
[agent works...]
Agent: "All set!
[[browser:linkedin.com/jobs:complete:Created 3 job alerts for PM in SF]]"

INTEGRATION CONNECTIONS:
The integration registry is injected below as AVAILABLE INTEGRATIONS.
Each provider is ONE connection that covers ALL its capabilities.
- To connect a provider: output [[integration:PROVIDER_ID]] (e.g. [[integration:google]])
- ONLY output ONE marker per provider, never duplicates
- If the user asks for a specific service (e.g. "Gmail", "Google Sheets"), find which PROVIDER covers it and connect that provider
- CRITICAL: Gmail, Calendar, Drive, Sheets, Docs, Meet are ALL part of ONE Google integration
- "connect Gmail" → [[integration:google]]
- "connect Google Sheets" → [[integration:google]]  
- "connect Gmail and Sheets" → [[integration:google]] (ONCE, not twice)
- "connect LinkedIn and Gmail" → [[integration:linkedin]] and [[integration:google]] (two separate ones)
- NEVER output [[integration:gmail]] or [[integration:google-sheets]] — those don't exist. Always [[integration:google]]
- Only ask to connect if the provider is NOT already in CONNECTED INTEGRATIONS below
- If a provider is already connected, just USE it — don't re-prompt
- For browser-login integrations (LinkedIn, Instagram, Facebook, TikTok, WhatsApp Web, Granola): DO NOT output [[integration:...]] — instead open the browser, show a [[browser:...:waiting-login:...]] card, and let the user log in. Once logged in, you can automate tasks on that platform.

USING CONNECTED INTEGRATIONS:
- Check the CONNECTED INTEGRATIONS section below. If an integration is listed there, it IS already connected and you CAN use it immediately.
- For Google (when connected): you can scan Gmail, read emails, check calendar — use the scan API.
- To scan Gmail/Calendar: output [[scan:google]] in your response. The app handles the API call server-side.
- NEVER ask the user to reconnect or re-authorize an integration that is already listed under CONNECTED INTEGRATIONS.
- NEVER output [[integration:google]] if Google is already in CONNECTED INTEGRATIONS — just use it.
- If an API call fails with a token error, THEN ask to reconnect via [[integration:google]]

DATA INGESTION:
After a user connects ANY integration, offer to scan their data to learn about them.

How scanning works:
- Output [[scan:PROVIDER_ID]] (e.g. [[scan:google]], [[scan:slack]], [[scan:notion]])
- For providers with native scan support, the app handles it automatically
- For other providers, YOU are the scanner:
  * Check what capabilities the integration has (see AVAILABLE INTEGRATIONS)
  * Use your tools: browser automation, exec with curl, installed skills
  * For browser-login integrations: open the service in browser, navigate, extract data
  * For API integrations: use exec + curl with the stored OAuth token
- After scanning, save key insights using [[REMEMBER: key=value]] tags
- Report findings naturally to the user

Scanning principles:
- Always ask consent first
- Scope appropriately: sample recent data, don't fetch everything
- Extract: contacts, topics, communication style, patterns, automation opportunities
- For ANY integration you don't have a native adapter for: use browser or API creatively
## EMAIL DRAFTING
When the user asks you to draft or send an email, output a rich email card using this syntax:
[[email:{"to":["recipient@email.com"],"subject":"Subject here","body":"<p>Email body with HTML formatting</p>","integration":"google"}]]
This renders an interactive email card the user can edit and send with one click.
- Always include the integration field ("google" or "microsoft" based on their connected account)
- Use HTML in the body for formatting (paragraphs, lists, bold, etc.)
- Do NOT also write out the email as plain text — the card IS the email
- The user can edit all fields before sending`;

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts = [CORE_PROMPT];

  if (ctx.userName || ctx.agentName) {
    const who = [];
    if (ctx.userName) who.push(`User's name: ${ctx.userName}`);
    if (ctx.agentName) who.push(`Your name: ${ctx.agentName}`);
    parts.push('\nUSER CONTEXT:\n' + who.join('\n'));
  }

  if (ctx.integrations && ctx.integrations.length > 0) {
    parts.push('\nCONNECTED INTEGRATIONS:\n' + ctx.integrations.map(i => {
      const reg = INTEGRATIONS.find(r => r.id === i);
      return reg ? `- ${reg.name} (${reg.id}) — capabilities: ${reg.capabilities.join(', ')}` : `- ${i}`;
    }).join('\n'));
  }

  // Inject available integrations from registry so agent knows the full landscape
  const integrationMap = INTEGRATIONS.map(i => 
    `- ${i.name} (${i.id}): ${i.capabilities.join(', ')} [${i.authType}]`
  ).join('\n');
  parts.push('\nAVAILABLE INTEGRATIONS (one connection per provider covers all its capabilities):\n' + integrationMap);

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

  if (ctx.fileContext) {
    parts.push('\nRELEVANT FILES (from your memory):\n' + ctx.fileContext);
  }

  if (ctx.gatewayHost) {
    parts.push(`\nDEVICE CONNECTION COMMAND:\nWhen a user needs to connect their computer (for browser-based services like LinkedIn, Instagram, etc.), tell them to copy the command from Settings → Devices. Do NOT include tokens or credentials in chat messages. Just say: "Go to Settings → Devices and copy the connection command. Then paste it in Terminal on your Mac."\n\nAdd this reassurance: "This just lets me interact with apps when you ask me to. I\'m not monitoring your screen or accessing anything without your permission. The connection is encrypted and secure."`);
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

    // Get gateway host for node run command
    const { data: org } = await supabase
      .from('organizations')
      .select('openclaw_gateway_url')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (org?.openclaw_gateway_url) {
      try {
        const url = new URL(org.openclaw_gateway_url);
        ctx.gatewayHost = url.hostname;
      } catch { /* invalid URL */ }
    }

  } catch (err) {
    console.error('Failed to build system prompt context:', err);
  }

  // Search memory files for relevant context
  try {
    if (userMessage) {
      const chunks = await searchFileChunks(userId, userMessage, 3);
      if (chunks.length > 0) {
        ctx.fileContext = chunks.map(c =>
          `[From: ${c.fileName}]\n${c.content}`
        ).join('\n---\n');
      }
    }
  } catch { /* file chunks table may not exist yet */ }

  // Inject installed skills into system prompt
  try {
    const skillsPrompt = await buildSkillsSystemPrompt(userId);
    if (skillsPrompt) {
      ctx.skillsPrompt = skillsPrompt;
    }
  } catch { /* skills table may not exist yet */ }

  return buildSystemPrompt(ctx);
}

/**
 * Fetch context summaries from conversations linked to the given conversation.
 * Returns a formatted string to inject into the system prompt, or null if none.
 */
export async function buildLinkedContextSummary(
  userId: string,
  conversationId: string
): Promise<string | null> {
  try {
    const supabase = await createClient();

    // Get links for this conversation (both directions)
    const { data: links } = await supabase
      .from("conversation_links")
      .select("source_conversation_id, target_conversation_id, link_type")
      .or(
        `source_conversation_id.eq.${conversationId},target_conversation_id.eq.${conversationId}`
      );

    if (!links || links.length === 0) return null;

    const linkedIds = links.map((l: { source_conversation_id: string; target_conversation_id: string }) =>
      l.source_conversation_id === conversationId
        ? l.target_conversation_id
        : l.source_conversation_id
    );

    if (linkedIds.length === 0) return null;

    // Fetch each linked conversation's recent messages
    const summaries: string[] = [];

    for (const linkedId of linkedIds) {
      const { data: convo } = await supabase
        .from("conversations")
        .select("id, title, updated_at")
        .eq("id", linkedId)
        .eq("user_id", userId)
        .single();

      if (!convo) continue;

      const { data: msgs } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("conversation_id", linkedId)
        .order("created_at", { ascending: false })
        .limit(8);

      if (!msgs || msgs.length === 0) continue;

      const dateLabel = convo.updated_at
        ? new Date(convo.updated_at).toLocaleDateString("en-US", {
            month: "numeric",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "";

      const excerpt = msgs
        .reverse()
        .map((m: { role: string; content: string }) => {
          const prefix = m.role === "user" ? "User" : "AI";
          const text =
            m.content.length > 300
              ? m.content.slice(0, 300) + "..."
              : m.content;
          return `${prefix}: ${text}`;
        })
        .join("\n");

      summaries.push(`[${convo.title} - ${dateLabel}]:\n${excerpt}`);
    }

    if (summaries.length === 0) return null;

    return (
      "SHARED CONTEXT FROM LINKED CONVERSATIONS:\n" + summaries.join("\n\n---\n\n")
    );
  } catch (err) {
    console.error("Failed to build linked context summary:", err);
    return null;
  }
}
