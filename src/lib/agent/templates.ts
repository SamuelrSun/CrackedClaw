export interface AgentTemplate {
  id: string;
  name: string;
  emoji: string;
  description: string;
  task: string;
  mode: string;
  model: string;
  builtin?: boolean;
}

export const BUILTIN_TEMPLATES: AgentTemplate[] = [
  {
    id: "market-research",
    name: "Market Research",
    emoji: "📊",
    description: "Research market trends, competitors, and opportunities",
    task: "Research the current market landscape for [topic]. Find key players, trends, market size, and opportunities. Present findings with sources.",
    mode: "research",
    model: "sonnet",
    builtin: true,
  },
  {
    id: "email-digest",
    name: "Email Digest",
    emoji: "📧",
    description: "Summarize and organize unread emails",
    task: "Check my recent emails and create a prioritized digest. Flag urgent items, summarize important messages, and suggest responses for any that need action.",
    mode: "email",
    model: "sonnet",
    builtin: true,
  },
  {
    id: "code-review",
    name: "Code Review",
    emoji: "🔍",
    description: "Review code for bugs, style, and improvements",
    task: "Review the codebase at [path] for bugs, code style issues, and potential improvements. Provide specific suggestions with code examples.",
    mode: "code",
    model: "sonnet",
    builtin: true,
  },
  {
    id: "web-scraper",
    name: "Web Scraper",
    emoji: "🕷️",
    description: "Extract structured data from websites",
    task: "Navigate to [url] and extract [data description]. Structure the results in a clean format.",
    mode: "browse",
    model: "sonnet",
    builtin: true,
  },
  {
    id: "competitor-intel",
    name: "Competitor Intel",
    emoji: "🕵️",
    description: "Gather intelligence on a competitor",
    task: "Research [competitor name] — find their pricing, recent news, product updates, team changes, and social media activity. Compile a brief.",
    mode: "research",
    model: "sonnet",
    builtin: true,
  },
  {
    id: "content-writer",
    name: "Content Writer",
    emoji: "✍️",
    description: "Draft blog posts, social media, or marketing copy",
    task: "Write a [type: blog post/tweet thread/newsletter] about [topic]. Match the tone: [professional/casual/technical]. Include a compelling hook and CTA.",
    mode: "agent",
    model: "sonnet",
    builtin: true,
  },
];
