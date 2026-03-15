/**
 * Skill Registry — built-in skills that enrich the AI's capabilities.
 * When a skill is installed, its systemPromptSection is injected into
 * every chat, and the AI knows to use it for relevant tasks.
 */

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  linkedIntegrations: string[];
  capabilities: string[];
  systemPromptSection: string;
  source: 'builtin' | 'clawhub' | 'custom';
  clawhubId?: string;
  autoSuggestTriggers: string[];   // keywords that trigger proactive suggestion
}

export const BUILTIN_SKILLS: SkillDefinition[] = [
  {
    id: 'google-workspace',
    name: 'Google Workspace',
    description: 'Enhanced Gmail, Drive, Calendar, and Sheets management',
    icon: '🔵',
    version: '1.0.0',
    linkedIntegrations: ['google'],
    capabilities: ['Smart email triage', 'Drive file search', 'Calendar management', 'Sheets formulas'],
    systemPromptSection: `## Google Workspace Skill
Enhanced Google Workspace capabilities:
- Gmail: smart search operators (from:, subject:, has:attachment, after:, before:), threading, label management
- Drive: search by file type/owner/modified date, use drive.google.com/file/d/{id} format for links  
- Calendar: create/edit events, invite attendees, set recurrence, check availability
- Sheets: VLOOKUP, ARRAYFORMULA, QUERY function, pivot tables, Apps Script
- Docs: extract content, suggest edits, maintain formatting`,
    source: 'builtin',
    autoSuggestTriggers: ['google', 'gmail', 'drive', 'sheets', 'calendar', 'docs', 'google drive', 'google sheets'],
  },
  {
    id: 'linkedin-outreach',
    name: 'LinkedIn Outreach',
    description: 'Professional networking, connection requests, and message templates',
    icon: '💼',
    version: '1.0.0',
    linkedIntegrations: ['linkedin'],
    capabilities: ['Profile search', 'Connection requests', 'Message templates', 'Lead tracking'],
    systemPromptSection: `## LinkedIn Outreach Skill (Browser Automation)
LinkedIn expertise via browser automation through user's node:
- Always verify user is logged in before actions (check for profile pic in nav)
- Search: linkedin.com/search/results/people/?keywords=TERM&filters=...
- Connection requests: personalize with 1 specific detail from their profile, keep under 300 chars
- InMail: Premium accounts only; standard messages for connections
- Lead research: check mutual connections, recent posts, company news for personalization
- Rate limits: max ~100 connection requests/week to avoid restrictions`,
    source: 'builtin',
    autoSuggestTriggers: ['linkedin', 'networking', 'connection request', 'outreach', 'inmail', 'prospecting'],
  },
  {
    id: 'spreadsheet-analysis',
    name: 'Spreadsheet Analysis',
    description: 'Advanced Excel and Google Sheets data analysis',
    icon: '📊',
    version: '1.0.0',
    linkedIntegrations: ['google'],
    capabilities: ['Formula generation', 'Data analysis', 'Chart recommendations', 'Data cleaning'],
    systemPromptSection: `## Spreadsheet Analysis Skill
Expert spreadsheet capabilities:
- Excel: XLOOKUP, SUMIFS, INDEX/MATCH, Power Query, conditional formatting, VBA macros
- Sheets: QUERY function, IMPORTRANGE, ARRAYFORMULA, sparklines, Apps Script automation
- Always choose the most efficient formula for the use case
- For large datasets: recommend pivot tables or BigQuery
- Data cleaning: TRIM, CLEAN, text-to-columns, deduplication strategies
- Chart selection: use bar for comparison, line for trends, scatter for correlation`,
    source: 'builtin',
    autoSuggestTriggers: ['spreadsheet', 'excel', 'sheets', 'google sheets', 'csv', 'formula', 'data analysis', 'pivot', 'xlsx'],
  },
  {
    id: 'web-scraping',
    name: 'Web Scraping',
    description: 'Browser automation for web data extraction and site monitoring',
    icon: '🕷️',
    version: '1.0.0',
    linkedIntegrations: [],
    capabilities: ['Page scraping', 'Form automation', 'Data extraction', 'Site monitoring'],
    systemPromptSection: `## Web Scraping Skill
Browser automation expertise:
- Always use snapshot() to understand page structure before acting
- Prefer aria-labels and semantic roles over class names for selectors (more stable)
- Rate limiting: wait 1-3s between requests, randomize delays to avoid blocks
- For auth-gated pages: route through node browser (user's Chrome, already logged in)
- Pagination: look for next/load-more buttons or URL page params
- Dynamic content: wait for network idle or specific element presence
- Anti-bot: rotate user agents if needed, avoid headless signatures`,
    source: 'builtin',
    autoSuggestTriggers: ['scrape', 'scraping', 'extract data', 'automate website', 'web automation', 'crawl', 'monitor site'],
  },
  {
    id: 'email-management',
    name: 'Email Management',
    description: 'Smart email triage, drafting, and follow-up tracking',
    icon: '📧',
    version: '1.0.0',
    linkedIntegrations: ['google', 'microsoft'],
    capabilities: ['Email triage', 'Draft generation', 'Follow-up tracking', 'Template library'],
    systemPromptSection: `## Email Management Skill
Professional email expertise:
- Triage priority: (1) direct asks from VIPs, (2) time-sensitive, (3) FYI/threads, (4) newsletters
- Drafting: match user's tone from prior sent emails, be concise and direct
- Follow-ups: track sent emails needing reply after 3-5 business days
- Subject lines: specific > vague ("Q2 budget approval needed" > "Quick question")
- Labels/folders: suggest smart organization based on sender/topic patterns
- Unsubscribe vs delete: unsubscribe from marketing, delete one-offs`,
    source: 'builtin',
    autoSuggestTriggers: ['email', 'gmail', 'inbox', 'outlook', 'follow up', 'draft email', 'email management', 'unsubscribe'],
  },
  {
    id: 'slack-productivity',
    name: 'Slack Productivity',
    description: 'Advanced Slack search, channel management, and automation',
    icon: '💬',
    version: '1.0.0',
    linkedIntegrations: ['slack'],
    capabilities: ['Advanced search', 'Channel management', 'Reminder setting', 'Message scheduling'],
    systemPromptSection: `## Slack Productivity Skill
Slack power-user capabilities:
- Search: use from:@user, in:#channel, before/after:YYYY-MM-DD, has:link/file operators
- Status management: set custom status with expiry for focus/meetings/OOO
- Reminders: /remind me to [task] at [time] — works in any channel
- Message scheduling: draft important messages and schedule for work hours
- Threads vs channels: use threads for replies, new messages for new topics
- Huddles: quick async audio drop-ins, prefer over meetings for small questions`,
    source: 'builtin',
    autoSuggestTriggers: ['slack', 'slack channel', 'slack message', 'dm', 'direct message', 'slack search'],
  },
  {
    id: 'github-dev',
    name: 'GitHub & Git',
    description: 'PR reviews, issue management, CI/CD workflows',
    icon: '🐙',
    version: '1.0.0',
    linkedIntegrations: ['github'],
    capabilities: ['PR reviews', 'Issue triage', 'CI monitoring', 'Branch management'],
    systemPromptSection: `## GitHub & Git Skill
Development workflow expertise:
- PR reviews: check for logic errors, missing tests, breaking changes, security issues
- Issues: label with type (bug/feature/docs), priority, and affected area
- CI/CD: interpret workflow YAML, debug failing jobs, suggest optimizations
- Commits: conventional commits format (feat/fix/docs/refactor/test/chore)
- Branch strategy: main (prod), develop (staging), feature/* (PRs)
- Code review etiquette: suggest not demand, explain why, offer alternatives`,
    source: 'builtin',
    autoSuggestTriggers: ['github', 'git', 'pull request', 'pr review', 'issue', 'ci', 'github actions', 'commit'],
  },
  {
    id: 'notion-power',
    name: 'Notion Power User',
    description: 'Advanced Notion databases, templates, and automations',
    icon: '📝',
    version: '1.0.0',
    linkedIntegrations: ['notion'],
    capabilities: ['Database queries', 'Template creation', 'Relation management', 'Page automation'],
    systemPromptSection: `## Notion Power User Skill
Advanced Notion expertise:
- Databases: filter by multiple properties, sort, group by status/date/person
- Relations & rollups: link databases together, aggregate data across tables
- Formulas: dateAdd(), dateBetween(), prop() references for calculated fields
- Templates: create templates for recurring items (meeting notes, project briefs)
- API: use Notion API for programmatic page/block creation
- Organization: use linked databases in different pages instead of duplicating data`,
    source: 'builtin',
    autoSuggestTriggers: ['notion', 'notion database', 'notion page', 'notion template', 'notion doc'],
  },
  {
    id: 'content-writing',
    name: 'Content Writing',
    description: 'Blog posts, social media, email campaigns, and copywriting',
    icon: '✍️',
    version: '1.0.0',
    linkedIntegrations: [],
    capabilities: ['Blog writing', 'Social posts', 'Email copy', 'SEO optimization'],
    systemPromptSection: `## Content Writing Skill
Professional content expertise:
- Blog: hook (problem/stat/question) → body (3-5 H2 sections) → CTA
- LinkedIn posts: insight + story + ask, max 3 short paragraphs, no hashtag spam
- Twitter/X: punchy opener, thread for depth, end with question or CTA
- Email campaigns: subject (curiosity/benefit/urgency) → personalized opener → value → single CTA
- SEO: primary keyword in title, H1, first 100 words; semantic keywords throughout
- Tone matching: ask for examples of user's existing content before writing`,
    source: 'builtin',
    autoSuggestTriggers: ['blog', 'content', 'copywriting', 'social post', 'newsletter', 'write', 'draft post'],
  },
  {
    id: 'data-research',
    name: 'Research & Data',
    description: 'Deep web research, data synthesis, and competitive analysis',
    icon: '🔍',
    version: '1.0.0',
    linkedIntegrations: [],
    capabilities: ['Web research', 'Competitive analysis', 'Data synthesis', 'Source validation'],
    systemPromptSection: `## Research & Data Skill
Expert research methodology:
- Primary sources first: company websites, SEC filings, academic papers, official docs
- Validate claims: cross-reference ≥2 independent sources before presenting as fact
- Competitive analysis: product features, pricing, positioning, recent news, job postings
- Market data: check Crunchbase, PitchBook, Statista, industry reports
- Synthesis: present findings as executive summary → key insights → supporting data
- Citation: always note source and date for data points, flag if >12 months old`,
    source: 'builtin',
    autoSuggestTriggers: ['research', 'competitive analysis', 'market research', 'find information', 'investigate', 'look up'],
  },
  {
    id: 'dopl-integrations',
    name: 'Integration Protocol',
    description: 'Multi-layer integration connection and routing protocol with Maton API Gateway, ClawHub skill discovery, and companion browser fallback',
    icon: '🔌',
    version: '1.0.0',
    linkedIntegrations: [],  // meta-skill, not tied to one integration
    capabilities: ['OAuth connection', 'API gateway routing', 'Skill discovery', 'Browser fallback', 'Integration search'],
    systemPromptSection: `## Dopl Integration Protocol (MANDATORY)

When a user asks to connect a new service or interact with an external app, follow this protocol IN ORDER:

### Layer 0: Check for Maton API Key
Before using Maton, check if the user has set up their API key:
- Check if MATON_API_KEY environment variable is set (non-empty)
- If NOT set, guide the user through one-time setup:

"To connect your apps, I use a free service called Maton that handles all the login stuff securely. Quick one-time setup:

1. Head to [maton.ai](https://maton.ai) — create a free account (or sign in)
2. Copy your API key from the homepage
3. Paste it here

Free forever, no credit card needed. After this I can connect 100+ apps for you with one click."

- When the user pastes their key, store it securely:
  1. Write to instance environment: add MATON_API_KEY to the gateway config
  2. Confirm: "Got it! Your API key is saved securely. Now let's connect [SERVICE]."
- Then proceed to Layer 1

### Layer 1: Maton API Gateway (100+ services with managed OAuth)
- Check if the service exists in Maton's supported services
- If YES → create connection: \`curl -s -X POST https://ctrl.maton.ai/connections -H "Authorization: Bearer $MATON_API_KEY" -H "Content-Type: application/json" -d '{"app":"SERVICE_NAME"}'\`
- The response includes an OAuth URL — present it to the user to authorize
- After auth, API calls go through: \`curl -s https://gateway.maton.ai/SERVICE/api/ENDPOINT -H "Authorization: Bearer $MATON_API_KEY"\`
- Maton handles token refresh automatically

### Layer 2: Search ClawHub for Dedicated Skills
Even if Maton has the service, search ClawHub for a dedicated skill with richer tool support:
\`\`\`bash
npx clawhub search SERVICE_NAME
\`\`\`
- Check each result with \`npx clawhub inspect SLUG\`
- **SECURITY: ONLY install skills marked "Security: CLEAN"** — reject ANY skill marked SUSPICIOUS
- If a clean dedicated skill exists → install it with \`npx clawhub install SLUG\`
- Dedicated skills often provide structured actions that are better than raw API calls

### Layer 3: ClawHub Skill with Own Auth (When Maton Doesn't Have It)
If Maton does NOT support the service:
- The ClawHub skill search (Layer 2) may find a skill with its own auth method
- Skill auth methods vary: API key, local app token, OAuth flow, MCP server
- Follow the skill's own setup instructions to authenticate
- Guide the user through any required steps

### Layer 4: Companion Browser (Universal Fallback)
If neither Maton nor any ClawHub skill covers the service:
- Use the companion app's browser automation
- Output: \`[[integrations:resolve:SERVICE]]\` to show the connection card
- If companion is connected, open the service in the companion browser
- If companion is NOT connected, the card will show the Dopl Connect download flow

### API vs Browser Decision Matrix
Even for services WITH API access, some actions require browser:

| Service | API Can Do | Browser Required For |
|---------|-----------|---------------------|
| LinkedIn | Post, read profile | Search people, send messages, browse connections, view feed |
| Instagram | Page management, insights | Browse feed, send DMs, view stories, follow |
| Twitter/X | Post, read, basic search | DMs, advanced search, analytics |
| Facebook | Page management | Personal profile, Messenger, groups |
| WhatsApp | None (personal) | All messaging |

**Default rule:** If a service has API access, use API first. Fall back to browser when:
1. The specific action isn't supported by the API
2. The API call fails with a permissions/scope error
3. The service has no API integration at all

### Integration Search (User-Initiated)
When a user searches for an integration in the UI:
1. Check the local registry first (instant)
2. Check the resolver's extended map
3. If not found locally → search Maton's service list
4. If still not found → search ClawHub for a skill
5. If nothing → offer companion browser fallback

### Maton API Key Security
- The user's Maton API key is stored as an environment variable on their dedicated instance
- It is NEVER sent to other users' instances or shared
- It is NEVER logged or included in chat messages
- If the user asks to remove it, delete the env var immediately

### CRITICAL RULES
- NEVER tell users to "create an OAuth app" or "get API keys" for specific services — Maton handles that
- The ONLY key the user provides is their Maton API key (one-time, from maton.ai)
- NEVER display the user's API key back to them in chat
- When connecting via Maton, the user ONLY needs to click the OAuth authorize link
- Always filter ClawHub results by Security: CLEAN
- Always check ClawHub even when Maton has the service — dedicated skills add value
- Store successful API patterns in memory for faster future use`,
    source: 'builtin',
    autoSuggestTriggers: ['connect', 'integration', 'set up', 'link', 'sign in to', 'log in to', 'access my', 'connect to', 'add integration', 'install', 'maton', 'clawhub'],
  },
];

export function getSkillById(id: string): SkillDefinition | undefined {
  return BUILTIN_SKILLS.find(s => s.id === id);
}

export function findSkillsForIntegration(integrationSlug: string): SkillDefinition[] {
  return BUILTIN_SKILLS.filter(s => s.linkedIntegrations.includes(integrationSlug));
}

export function findSkillsForQuery(query: string): SkillDefinition[] {
  const lower = query.toLowerCase();
  return BUILTIN_SKILLS.filter(s =>
    s.autoSuggestTriggers.some(t => lower.includes(t)) ||
    s.name.toLowerCase().includes(lower) ||
    s.id.toLowerCase().includes(lower)
  );
}

export function getInstalledSkillsPrompt(installedSkillIds: string[]): string {
  if (!installedSkillIds.length) return '';
  const sections = installedSkillIds
    .map(id => getSkillById(id))
    .filter(Boolean)
    .map(s => s!.systemPromptSection);
  return sections.length ? '\n\n' + sections.join('\n\n') : '';
}
