/**
 * src/resources/recent.ts
 *
 * MCP resource: brain://recent
 *
 * Returns the 20 most recently recalled/relevant memories by querying
 * the brain with "recent activity".
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export async function handleRecentResource(
  client: BrainApiClient,
  uri: URL,
): Promise<{ contents: Array<{ uri: string; text: string; mimeType: string }> }> {
  try {
    const response = await client.recall({
      query: 'recent activity',
      limit: 20,
    });

    const results = response.results ?? [];

    if (results.length === 0) {
      return {
        contents: [
          {
            uri: uri.href,
            text: 'No recent memories found in your Dopl Brain.',
            mimeType: 'text/plain',
          },
        ],
      };
    }

    const lines: string[] = [
      `# Recent Dopl Brain Memories`,
      ``,
      `Showing ${results.length} recent memor${results.length === 1 ? 'y' : 'ies'}:`,
      ``,
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const meta: string[] = [];
      if (r.domain) meta.push(`domain: ${r.domain}`);
      if (r.source) meta.push(`source: ${r.source}`);
      if (r.created_at) meta.push(`created: ${r.created_at}`);

      lines.push(`${i + 1}. [ID: ${r.id}] ${r.content}`);
      if (meta.length > 0) {
        lines.push(`   (${meta.join(' | ')})`);
      }
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: lines.join('\n'),
          mimeType: 'text/plain',
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;
    return {
      contents: [
        {
          uri: uri.href,
          text: `Error loading recent memories: ${message}`,
          mimeType: 'text/plain',
        },
      ],
    };
  }
}
