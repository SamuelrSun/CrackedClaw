/**
 * Notion native ingestion adapter
 * Scans pages and databases to extract workspace structure and topics.
 */

import { saveMemory } from '@/lib/memory/service';
import { IngestResult } from '../engine';
import { getIntegrationToken } from './utils';

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

interface NotionPage {
  id: string;
  object: 'page' | 'database';
  last_edited_time: string;
  properties?: Record<string, { title?: { plain_text: string }[]; type: string }>;
  title?: { plain_text: string }[];
  parent?: { type: string };
}

interface NotionSearchResult {
  results: NotionPage[];
  has_more: boolean;
  next_cursor?: string;
}

async function notionPost(token: string, path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${NOTION_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Notion API error: ${res.status}`);
  return res.json();
}

function extractTitle(page: NotionPage): string {
  // Try properties.Name or properties.title
  if (page.properties) {
    for (const prop of Object.values(page.properties)) {
      if (prop.title && prop.title.length > 0) {
        return prop.title.map(t => t.plain_text).join('');
      }
    }
  }
  // For databases, title array is top-level
  if (page.title && page.title.length > 0) {
    return page.title.map(t => t.plain_text).join('');
  }
  return 'Untitled';
}

export async function scanNotion(userId: string, scope: 'quick' | 'full'): Promise<IngestResult> {
  const startMs = Date.now();

  const token = await getIntegrationToken(userId, 'notion');
  if (!token) throw new Error('Notion integration not connected or missing access token');

  const pages: NotionPage[] = [];
  const databases: NotionPage[] = [];
  let cursor: string | undefined;
  const maxPages = scope === 'quick' ? 50 : 200;

  // Paginate through search results
  do {
    const body: Record<string, unknown> = { page_size: 100 };
    if (cursor) body.start_cursor = cursor;

    const data = await notionPost(token, '/search', body) as NotionSearchResult;

    for (const item of data.results) {
      if (item.object === 'database') databases.push(item);
      else pages.push(item);
    }

    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor && pages.length + databases.length < maxPages);

  // Extract titles and recent pages
  const recentPages = [...pages]
    .sort((a, b) => new Date(b.last_edited_time).getTime() - new Date(a.last_edited_time).getTime())
    .slice(0, 30);

  const pageTitles = recentPages.map(p => extractTitle(p)).filter(t => t && t !== 'Untitled');
  const dbTitles = databases.map(d => extractTitle(d)).filter(t => t && t !== 'Untitled');

  // Extract topics from titles
  const STOPWORDS = new Set(['the','a','an','is','it','in','of','to','and','or','for','with','on','at','by','this','that','my','your','our']);
  const topicFreq: Record<string, number> = {};
  for (const title of pageTitles) {
    for (const word of title.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/)) {
      if (word.length > 3 && !STOPWORDS.has(word)) {
        topicFreq[word] = (topicFreq[word] ?? 0) + 1;
      }
    }
  }
  const topics = Object.entries(topicFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([w]) => w);

  const rawContext = [
    `Notion: ${pages.length} pages, ${databases.length} databases`,
    `Recent pages: ${pageTitles.slice(0, 10).join(' | ')}`,
    dbTitles.length > 0 ? `Databases: ${dbTitles.join(', ')}` : '',
    topics.length > 0 ? `Topics: ${topics.slice(0, 10).join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const result: IngestResult = {
    provider: 'notion',
    scannedAt: new Date().toISOString(),
    scope,
    insights: {
      topics,
      rawContext,
    },
    metadata: {
      itemsScanned: pages.length + databases.length,
      timeMs: Date.now() - startMs,
    },
  };

  // Persist to memory
  const entries: Array<{ key: string; value: string; category: 'contact' | 'context' | 'schedule' | 'preference'; importance: number }> = [];

  if (topics.length > 0) {
    entries.push({ key: 'notion_topics', value: topics.join(', '), category: 'context', importance: 3 });
  }
  if (dbTitles.length > 0) {
    entries.push({ key: 'notion_databases', value: dbTitles.join(', '), category: 'context', importance: 3 });
  }
  if (pageTitles.length > 0) {
    entries.push({ key: 'notion_recent_pages', value: pageTitles.slice(0, 15).join(' | '), category: 'context', importance: 2 });
  }

  await Promise.all(
    entries.map(e => saveMemory(userId, e.key, e.value, { category: e.category, source: 'scan', importance: e.importance }))
  );

  return result;
}
