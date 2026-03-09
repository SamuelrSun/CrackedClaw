import type { ToolDefinition, AgentContext } from '../runtime';

interface SearchInput {
  query: string;
  count?: number;
}

interface FetchInput {
  url: string;
  maxChars?: number;
}

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  description: 'Search the web using Brave Search API. Returns titles, URLs, and snippets.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      count: { type: 'number', description: 'Number of results (1-10, default 5)' },
    },
    required: ['query'],
  },
  async execute(input: unknown, _context: AgentContext): Promise<unknown> {
    const { query, count = 5 } = input as SearchInput;
    const apiKey = process.env.BRAVE_API_KEY;

    if (!apiKey) {
      // Fallback: DuckDuckGo instant answers
      const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
      const res = await fetch(url);
      const data = await res.json();
      return {
        results: (data.RelatedTopics || []).slice(0, count).map((t: { Text: string; FirstURL: string }) => ({
          title: t.Text?.split(' - ')[0] ?? '',
          url: t.FirstURL ?? '',
          snippet: t.Text ?? '',
        })),
        source: 'duckduckgo',
      };
    }

    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey } },
    );
    if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);
    const data = await res.json();

    return {
      results: (data.web?.results ?? []).map((r: { title: string; url: string; description: string }) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      })),
      source: 'brave',
    };
  },
};

export const webFetchTool: ToolDefinition = {
  name: 'web_fetch',
  description: 'Fetch and extract readable content from a URL.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      maxChars: { type: 'number', description: 'Max characters to return (default 20000)' },
    },
    required: ['url'],
  },
  async execute(input: unknown, _context: AgentContext): Promise<unknown> {
    const { url, maxChars = 20_000 } = input as FetchInput;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 CrackedClaw/1.0' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

    const html = await res.text();

    try {
      const { JSDOM } = await import('jsdom');
      const { Readability } = await import('@mozilla/readability');
      const dom = new JSDOM(html, { url });
      const article = new Readability(dom.window.document).parse();
      if (article) {
        return {
          title: article.title,
          content: article.textContent?.substring(0, maxChars) ?? '',
          url,
        };
      }
    } catch {
      // readability not available or failed, fall through
    }

    // Strip tags fallback
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { content: text.substring(0, maxChars), url };
  },
};
