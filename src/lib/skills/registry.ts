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
