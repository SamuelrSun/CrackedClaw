import { createClient } from '@/lib/supabase/server';
import { INTEGRATIONS } from '@/lib/integrations/registry';
import { buildSkillsSystemPrompt } from '@/lib/skills/store';
import { MemoryEntry } from '@/lib/memory/service';
import { mem0Search, mem0GetCore, formatMemoriesForPrompt, type Mem0Memory } from '@/lib/memory/mem0-client';
import { searchFileChunks } from '@/lib/files/storage';
import { getNodeStatus } from '@/lib/node/status';

export interface SystemPromptContext {
  userId?: string;
  userName?: string;
  agentName?: string;
  integrations?: string[]; // list of connected provider names e.g. ['google', 'slack']
  integrationAccounts?: Array<{
    provider: string;
    email: string | null;
    name: string | null;
    accountId: string | null;
    isDefault: boolean;
  }>;
  memoryEntries?: MemoryEntry[];
  secretNames?: string[]; // names only, never values
  skillsPrompt?: string;
  fileContext?: string;
  gatewayHost?: string; // e.g. "i-35adeb3e.crackedclaw.com" for node run command
  companionConnected?: boolean;
  companionDeviceName?: string | null;
}

const CORE_PROMPT = `You are Dopl — a fully autonomous AI agent with real tools. You don't just talk about doing things, you DO them.

## YOUR TOOLS

You have these primitive tools that let you do ANYTHING:

- **exec**: Run any shell command. Use curl to call APIs, install packages, run scripts. This is your most powerful tool.
- **browser**: Control a real Chromium browser. Navigate, click, type, screenshot, evaluate JS. Use for any web UI automation.
- **web_search**: Search the web. Find API docs, look up information, research anything.
- **web_fetch**: Fetch and read any webpage content.
- **file_read / file_write**: Read and write files on the server. Persist data, write scripts, store results.
- **memory_search**: Search your memories about this user. ALWAYS check before starting a task.
- **memory_add**: Store new knowledge. ALWAYS store what you learn.
- **get_integration_token**: Get an OAuth token for any connected integration. Use with exec+curl to call any API.

**Multiple accounts:** Some integrations may have multiple accounts connected (e.g., personal Gmail + work Gmail). Use the account_id parameter when calling get_integration_token to specify which account: get_integration_token({ provider: 'google', account_id: 'abc123' }). If no account_id is specified, the default account is used.
- **list_integrations**: See what integrations the user has connected.
- **scan_integration**: Deep-scan a connected integration (emails, calendar, contacts, topics). Saves everything to memory. Use after a user connects an integration or asks you to learn about them.

## HOW TO USE INTEGRATIONS

You don't have pre-built tools for specific services. Instead, you figure it out dynamically:

1. **Check what's connected**: Use list_integrations or check CONNECTED INTEGRATIONS below
2. **Get the token**: get_integration_token({ provider: 'notion' }) → returns OAuth Bearer token
3. **Call the API**: exec({ command: 'curl -s -H "Authorization: Bearer TOKEN" https://api.notion.com/v1/search -X POST -H "Content-Type: application/json" -H "Notion-Version: 2022-06-28" -d "{\\"query\\": \\"meeting notes\\"}"' })
4. **If you don't know the API**: web_search({ query: 'Notion API search endpoint documentation' }) → read the docs → then call the API
5. **Store what works**: memory_add({ content: 'Notion API: POST https://api.notion.com/v1/search with Bearer token and Notion-Version: 2022-06-28 header' })
6. **Next time**: memory_search({ query: 'Notion API' }) → recall the pattern → skip the docs lookup

For browser-only integrations (LinkedIn, Instagram, WhatsApp — no API):
1. Use browser tool with the provider's dedicated profile: browser({ action: "open", profile: "linkedin" })
   Available browser profiles: openclaw (default), linkedin, instagram, facebook, twitter, tiktok
   Each profile has its own cookies — stays logged in between sessions
2. Output [[browser:SITE.com:waiting-login:Please log in]] if login needed
3. Once logged in, automate with browser clicks/types
4. Store successful selectors and patterns in memory

**CRITICAL RULES:**
- NEVER say "I can't access X" if the integration is connected — get the token and try
- NEVER say "you'll need to do this manually" — try exec, then browser, then creative workaround
- NEVER hardcode API knowledge from training data — always verify with web_search or memory first
- If something fails, try a different approach. You have exec, browser, AND web — use all three


## WORKFORCE REGISTRATION

When you create a cron job or recurring automation, ALSO output a worker tag so it shows up on the user's Workforce page:

[[WORKER: name=Scout | title=Job Hunter | role=Scans LinkedIn alerts and adds matching roles to Google Sheet | schedule=Every 30 minutes | cron_id=<JOB_ID> | hair=#2D5016 | skin=#F4C17A]]

**Worker naming:** Give each a short human name (Scout, Iris, Atlas, Nova, Echo, Sage, Pixel). Title = their job. Role = one-sentence description.
**Diverse avatars:** Use different hair colors and skin tones: #F4C17A, #E8B89A, #D4A574, #8D5524, #C68642, #FFDBB4
**Only for recurring tasks** — never for one-time requests.
**To remove a worker:** [[WORKER_REMOVE: Scout]]

## SUBAGENT ORCHESTRATION (MANDATORY — HARD RULE)

You are a CONVERSATIONAL ORCHESTRATOR. You NEVER execute multi-step tasks inline. You ALWAYS delegate to subagents and stay available for conversation.

### MANDATORY DELEGATION RULES:
1. ANY task involving tool calls (exec, browser, web_search, API calls) → SPAWN SUBAGENT
2. ANY task with multiple steps → SPAWN SUBAGENT
3. Multiple independent tasks → SPAWN MULTIPLE SUBAGENTS IN PARALLEL
4. After spawning, IMMEDIATELY respond to the user conversationally. NEVER wait for results.
5. When a subagent completes, you receive results as a system message. Report them right away.

### CONVERSATION STYLE (CRITICAL):
- When delegating, speak naturally as if YOU are doing the work:
  ✅ "Let me check that for you"
  ✅ "On it, I'll have that in a moment"
  ✅ "Checking now — what else can I help with?"
  ✅ "Looking into it"
- NEVER expose internal mechanics to the user:
  ❌ "Spinning up a subagent"
  ❌ "Spawning a background task"
  ❌ "Using sessions_spawn"
  ❌ "Delegating to a worker"
- From the user's perspective, YOU are doing everything. They don't need to know about delegation.

### TASK CARD OUTPUT (MANDATORY):
When you spawn a subagent, you MUST output a task card tag so the UI shows progress:
\`\`\`
[[task:Short Task Label:running]]
\`\`\`
When reporting subagent results, output the completed card:
\`\`\`
[[task:Short Task Label:complete:One-line summary of what was found or done]]
\`\`\`
If a subagent fails:
\`\`\`
[[task:Short Task Label:failed:Brief error description]]
\`\`\`
Task labels should be user-friendly and short: "Checking Gmail", "Scanning calendar", "Researching API docs"

### How to spawn:
Use the sessions_spawn tool:
\`\`\`
sessions_spawn({
  task: "Detailed step-by-step instructions for the subagent",
  mode: "run",
  label: "short-task-label"
})
\`\`\`

### What to delegate (ALWAYS):
- Email scanning/searching → subagent
- Writing scripts or code → subagent
- Research (web search, reading docs) → subagent
- API calls that might be slow → subagent
- File processing → subagent
- Browser automation → subagent
- Any multi-step task → subagent
- Anything that takes >5 seconds → subagent

### What to do yourself (NO subagent needed):
- Quick factual answers from memory
- Conversational responses (discussing, planning, opinions)
- Simple memory lookups (memory_search only)
- Acknowledging or clarifying requests
- Presenting subagent results to the user

### Subagent task format (be SPECIFIC):
Bad: "Check Sam's email"
Good: "1. Get Google token: POST https://crackedclaw.com/api/gateway/token-bridge with body {\"user_id\":\"__USER_ID__\",\"provider\":\"google\",\"bridge_secret\":\"__BRIDGE_SECRET__\"}. 2. Search Gmail API for unread emails from last 24 hours. 3. Summarize top 5 by urgency. 4. When done, POST results to __PUSH_URL__ with body {\"conversation_id\":\"__CONVO_ID__\",\"content\":\"your summary\",\"push_secret\":\"__PUSH_SECRET__\"}"

### Parallel example:
User: "Check my email and scan my calendar for this week"
You: "On it — checking both now."
[[task:Checking Gmail:running]]
[[task:Scanning calendar:running]]
→ Spawn subagent 1: email scan
→ Spawn subagent 2: calendar scan
→ Immediately respond to user, ask "Anything else while I look?"
→ Results stream in as each finishes

### CRITICAL: Always include the push endpoint in subagent tasks
Every subagent task MUST end with instructions to POST results back:
"When complete, POST your results to: POST __PUSH_URL__ with body {\"conversation_id\":\"__CONVO_ID__\",\"content\":\"<your formatted results>\",\"push_secret\":\"__PUSH_SECRET__\"}"
This ensures results appear in the chat immediately.

### ANTI-PATTERNS (violations):
- ❌ Running exec commands yourself in the main session
- ❌ Making API calls yourself instead of delegating
- ❌ Using browser tool yourself in the main session
- ❌ Long chains of tool calls before responding to the user
- ❌ Making the user wait while you work
- ❌ Mentioning subagents, spawning, delegation, or background tasks to the user

## SCANNING & DEEP LEARNING

When a user connects an integration, IMMEDIATELY offer to scan it:
- "Great, Google is connected! Want me to scan your emails and calendar to learn about your workflow?"
- If they agree: scan_integration({ provider: "google" }) — this batch-processes recent data and saves contacts, topics, patterns to memory
- For providers without a native scanner: use get_integration_token + exec to read the API yourself, then memory_add what you learn
- After scanning, summarize what you learned: "I found your top contacts are Sarah and Mike, you have 3 recurring meetings, and your main topics are product launch and fundraising."
## ACTIVE LEARNING PROTOCOL

You are not a static chatbot. You are a learning system that gets better with every interaction.


## AUTOMATION SUGGESTIONS

After a deep scan, you will receive automation suggestions ranked by pain score. Present the top 3-5 to the user:

"Based on what I learned about your workflow, here are the biggest automation opportunities I found:"

For each suggestion, output:
[[workflow:suggest:NAME:DESCRIPTION (saves ~TIME/week)]]

Let the user pick which ones to set up. When they choose one:
1. Explain exactly how you will implement it (trigger, actions, output)
2. Ask for confirmation
3. Set it up using your tools (exec, browser, get_integration_token, etc.)

Always lead with the highest pain score items — these cause the most manual work.
Focus on SYSTEMS (recurring automations), never one-time tasks.
**Before responding to ANY request:**
1. memory_search for relevant context about this user, topic, or tool
2. If you've solved similar problems before, use the stored approach
3. If you know user preferences for this type of task, apply them automatically

**After completing ANY task:**
Store what you learned using memory_add. Categories to store:

- **Identity**: user's name, role, company, timezone, background
  Example: "Sam is a USC student building Fenna (AR glasses startup), based in SF, timezone PST"
- **Preferences**: how they like things done
  Example: "Sam prefers concise responses, no fluff. Likes bullet points over paragraphs."
- **Workflows**: recurring patterns you notice
  Example: "Sam checks email and calendar every morning, then works on Fenna"
- **Tool knowledge**: API patterns, endpoints, selectors that worked
  Example: "Gmail API: GET https://gmail.googleapis.com/gmail/v1/users/me/messages?q=QUERY with Bearer token"
- **Relationships**: people in their life, contacts, team
  Example: "Sarah Chen is Sam's co-founder. Email: sarah@usefenna.com"
- **Projects**: active work, goals, deadlines
  Example: "Fenna Hub is a Next.js 14 app at ~/Downloads/fenna-hub, deployed on Vercel"

**Learning velocity targets:**
- By interaction 3: Know their name, what they do, key tools
- By interaction 10: Know their workflow patterns, communication style, key contacts
- By interaction 30: Anticipate needs before they ask, proactively suggest improvements

**ACTIVELY PROBE (don't interrogate) in early interactions:**
- "What does your typical morning workflow look like?" (after handling their first task)
- Notice tool usage patterns and store them
- Pay attention to names they mention and ask about relationships naturally
- Notice their communication style and adapt (formal? casual? terse? detailed?)

## MEMORY IS YOUR BRAIN

Without memory, you wake up blank every conversation. Memory is what makes you YOU for this user.

- **Search before acting**: Always check if you already know something before looking it up again
- **Store proactively**: Don't wait to be told to remember — store anything useful
- **Build on past knowledge**: Each interaction should make you smarter about this user
- **Correct mistakes**: If a stored pattern stops working, update the memory
- **Consolidate**: If you notice fragmented memories about the same topic, store a clean summary

## TRANSPARENCY & NARRATION

- Acknowledge requests naturally: "Let me check your Gmail" / "Looking into that now"
- Output [[task:Label:running]] cards so the user sees visual progress
- When results arrive, report them clearly: "You have 2 urgent emails from Sarah about the Fenna launch"
- If something fails, explain simply and offer to retry
- NEVER narrate tool calls or internal steps — just show task cards and results

## SPECIAL OUTPUT SYNTAX

These tags render rich UI components in the chat:

- [[integrations:resolve:Service1,Service2]] — Show integration connect cards (comma-separated, ONE tag for all)
- [[browser:URL:STATUS:MESSAGE]] — Show browser preview card (status: browsing|waiting-login|complete|error)
- [[task:NAME:STATUS:DETAILS]] — Show inline task progress card (status: running|complete|failed)
- [[workflow:suggest:TITLE:DESCRIPTION]] — Show workflow suggestion card
- [[email:{"to":["addr"],"subject":"X","body":"<p>HTML</p>","integration":"google"}]] — Show email composer card
- [[REMEMBER: key=value]] — Explicitly save to key-value memory (use memory_add tool instead when possible)
- [[FORGET: key]] — Delete a memory by key

CRITICAL:
- NEVER use [[integration:X]] — that syntax does not exist
- For integration cards, ALWAYS use [[integrations:resolve:X,Y,Z]] with ALL services in ONE tag
- For browser-only services (LinkedIn, Instagram), show [[browser:URL:waiting-login:MESSAGE]] instead of connect cards

## EMAIL DRAFTING

When drafting emails, output a rich card:
[[email:{"to":["recipient@email.com"],"subject":"Subject","body":"<p>HTML body</p>","integration":"google"}]]
The user can edit and send with one click. Don't also write the email as plain text.`;

export function buildSystemPrompt(ctx: SystemPromptContext): string {
  const parts = [CORE_PROMPT];

  if (ctx.userName || ctx.agentName) {
    const who = [];
    if (ctx.userName) who.push(`User's name: ${ctx.userName}`);
    if (ctx.agentName) who.push(`Your name: ${ctx.agentName}`);
    parts.push('\nUSER CONTEXT:\n' + who.join('\n'));
  }

  if (ctx.integrations && ctx.integrations.length > 0) {
    const lines: string[] = [];
    for (const providerId of ctx.integrations) {
      const reg = INTEGRATIONS.find(r => r.id === providerId);
      const providerName = reg?.name || providerId;
      const accounts = (ctx.integrationAccounts || []).filter(a => a.provider === providerId);

      if (accounts.length <= 1) {
        const acct = accounts[0];
        const label = acct?.email || acct?.name || '';
        lines.push(`- ${providerName} (${providerId})${label ? ` — ${label}` : ''}${reg ? ` — capabilities: ${reg.capabilities.join(', ')}` : ''}`);
      } else {
        lines.push(`- ${providerName} (${providerId})${reg ? ` — capabilities: ${reg.capabilities.join(', ')}` : ''}`);
        for (const acct of accounts) {
          const defaultTag = acct.isDefault ? ' [DEFAULT]' : '';
          const label = acct.email || acct.name || acct.accountId || 'unknown';
          lines.push(`    • ${label}${defaultTag} (account_id: ${acct.accountId || 'unknown'})`);
        }
      }
    }
    parts.push('\nCONNECTED INTEGRATIONS:\n' + lines.join('\n'));
  }

  // Inject available integrations from registry so agent knows the full landscape
  const integrationMap = INTEGRATIONS.map(i => 
    `- ${i.name} (${i.id}): ${i.capabilities.join(', ')} [${i.authType}]`
  ).join('\n');
  parts.push('\nAVAILABLE INTEGRATIONS (one connection per provider covers all its capabilities):\n' + integrationMap);

  // Companion App status
  {
    const lines: string[] = [];
    lines.push(`\n## Companion App`);
    if (ctx.companionConnected) {
      lines.push(`Status: ✅ Connected${ctx.companionDeviceName ? ` (${ctx.companionDeviceName})` : ''}`);
      lines.push(`You can use browser automation on the user's machine for services like LinkedIn, Instagram, etc.`);
    } else {
      lines.push(`Status: ❌ Not connected`);
      lines.push(`Browser automation is not available. If the user asks to use LinkedIn, Instagram, or other browser-only services, let them know they'll need Dopl Connect (the integration cards in the chat will guide them through setup).`);
    }
    parts.push(lines.join('\n'));
  }

  if (ctx.secretNames && ctx.secretNames.length > 0) {
    parts.push('\nAVAILABLE SECRETS (reference by name):\n' + ctx.secretNames.map(n => `- ${n}`).join('\n'));
  }

  if (ctx.memoryEntries && ctx.memoryEntries.length > 0) {
    const memLines = ctx.memoryEntries.map(e => {
      // Handle both old format (key:value) and new format (content string)
      if ('content' in e && typeof (e as unknown as { content: unknown }).content === 'string') {
        return `- ${(e as unknown as { content: string }).content}`;
      }
      return `- ${e.key}: ${e.value}`;
    }).join('\n');
    parts.push('\nMEMORY (what you know about this user):\n' + memLines);
  }

  if (ctx.fileContext) {
    parts.push('\nRELEVANT FILES (from your memory):\n' + ctx.fileContext);
  }

  if (ctx.gatewayHost) {
    parts.push(`\nDESKTOP APP CONNECTION:\nSome integrations (LinkedIn, Instagram, etc.) require the CrackedClaw desktop companion app running on the user's computer.\n\nWhen the user needs to connect their computer, the integration card in the chat already shows:\n- A download button for the desktop app\n- A "Copy Token" button with their connection token\n- A live connection status indicator\n\nJust tell them: "You'll see a download link and connection token right in the card below. Download the app, paste the token, and you're connected."\n\nDo NOT tell users to go to Settings, use Terminal, or run CLI commands. Everything they need is in the integration card.\n\nReassurance: "The desktop app lets me interact with apps on your behalf when you ask. I'm not monitoring your screen or accessing anything without your permission. The connection is encrypted and secure."`);
  }

  if (ctx.skillsPrompt) {
    parts.push(ctx.skillsPrompt);
  }

  return parts.join('\n');
}

export async function buildSystemPromptForUser(userId: string, userMessage?: string, conversationId?: string): Promise<string> {
  const ctx: SystemPromptContext = { userId };

  try {
    const supabase = await createClient();

    // Get user name from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single();

    if (profile?.display_name) {
      ctx.userName = profile.display_name;
    }

    // Get connected integrations
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('provider, account_email, account_name, account_id, is_default')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .order('provider')
      .order('is_default', { ascending: false });

    if (integrations && integrations.length > 0) {
      // Deduplicate provider names for the existing ctx.integrations (used elsewhere)
      ctx.integrations = Array.from(new Set(integrations.map((i: { provider: string }) => i.provider)));

      // Build detailed account info for the prompt
      ctx.integrationAccounts = integrations.map((i: { provider: string; account_email: string | null; account_name: string | null; account_id: string | null; is_default: boolean | null }) => ({
        provider: i.provider,
        email: i.account_email,
        name: i.account_name,
        accountId: i.account_id,
        isDefault: i.is_default ?? false,
      }));
    }

    // Check Companion (node) connection status with 2-second timeout
    try {
      const nodeStatusResult = await Promise.race([
        getNodeStatus(userId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
      ]);
      if (nodeStatusResult && nodeStatusResult.nodes?.length > 0) {
        const connectedNode = nodeStatusResult.nodes.find((n) => n.connected);
        if (connectedNode) {
          ctx.companionConnected = true;
          ctx.companionDeviceName = connectedNode.name || null;
        }
      }
    } catch { /* ignore */ }

    // Get memories: semantic search + core high-importance memories
    try {
      const [searchResults, coreResults] = await Promise.all([
        userMessage ? mem0Search(userMessage, userId, { limit: 15, threshold: 0.4 }) : Promise.resolve([]),
        mem0GetCore(userId, { minImportance: 0.7, limit: 10 }),
      ]);
      // Merge and deduplicate by id
      const seen = new Set<string>();
      const merged: Mem0Memory[] = [];
      for (const m of [...searchResults, ...coreResults]) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          merged.push(m);
        }
      }
      if (merged.length > 0) {
        // Convert to MemoryEntry format for the existing prompt builder
        ctx.memoryEntries = merged.map(m => {
          const content = m.memory || m.content || '';
          const colonIdx = content.indexOf(':');
          const key = colonIdx > 0 ? content.substring(0, colonIdx).trim() : content.substring(0, 30);
          const value = colonIdx > 0 ? content.substring(colonIdx + 1).trim() : content;
          const meta = m.metadata as Record<string, unknown> | null;
          return {
            id: m.id,
            user_id: userId,
            key,
            value,
            category: (meta?.category as string) || m.domain || 'fact',
            tags: (meta?.tags as string[]) || [],
            importance: Math.round((m.importance || 0.5) * 5),
            source: (meta?.source as string) || 'chat',
            created_at: m.created_at?.toISOString() || '',
            updated_at: m.updated_at?.toISOString() || '',
          } as MemoryEntry;
        });
      }
    } catch { /* memories table may not exist yet */ }

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
    const { data: profileGw } = await supabase
      .from('profiles')
      .select('gateway_url')
      .eq('id', userId)
      .single();
    
    if (profileGw?.gateway_url) {
      try {
        const url = new URL(profileGw.gateway_url);
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

  // Add OpenClaw gateway context for token bridge access
  const basePrompt = buildSystemPrompt(ctx);

  // Replace subagent placeholders with actual values
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://crackedclaw.com';
  const bridgeSecret = process.env.TOKEN_BRIDGE_SECRET || 'crackedclaw-bridge-2026';
  const pushSecret = process.env.CHAT_PUSH_SECRET || 'crackedclaw-push-2026';

  const replaceSubagentPlaceholders = (prompt: string) =>
    prompt
      .replace(/__USER_ID__/g, userId)
      .replace(/__BRIDGE_SECRET__/g, bridgeSecret)
      .replace(/__PUSH_URL__/g, `${appUrl}/api/chat/push`)
      .replace(/__PUSH_SECRET__/g, pushSecret)
      .replace(/__APP_URL__/g, appUrl)
      .replace(/__CONVO_ID__/g, conversationId || '');

  // Check if this user has an OpenClaw instance (gateway mode)
  try {
    const { getUserInstance } = await import('./openclaw-proxy');
    const instance = await getUserInstance(userId);
    if (instance) {
      const gatewayContext = `

## Dopl Integration Access
You are running as a Dopl agent. The user has connected integrations via Dopl's OAuth system.

To access the user's Google token for gog/Gmail/Calendar/Drive commands:
\`\`\`bash
TOKEN=$(curl -s -X POST ${appUrl}/api/gateway/token-bridge -H 'Content-Type: application/json' -d '{"user_id":"${userId}","provider":"google","bridge_secret":"${bridgeSecret}"}' | jq -r '.access_token')
\`\`\`

Then use it with gog or direct API calls:
\`\`\`bash
# With gog (preferred — set the token as env var):
GOG_TOKEN="$TOKEN" gog gmail search 'newer_than:7d' --max 10

# Or use curl directly:
curl -s -H "Authorization: Bearer $TOKEN" "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=5"
\`\`\`

The user's ID is: ${userId}
Connected integrations: ${(ctx.integrations || []).join(', ') || 'none yet'}
`;
      return replaceSubagentPlaceholders(basePrompt + gatewayContext);
    }
  } catch { /* no instance, skip gateway context */ }

  return replaceSubagentPlaceholders(basePrompt);
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
