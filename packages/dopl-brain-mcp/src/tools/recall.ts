/**
 * src/tools/recall.ts
 *
 * MCP tool: brain_recall
 *
 * Performs a semantic search across the user's Dopl Brain memories.
 * Returns ranked results with content, domain, and relevance score.
 *
 * Parameters:
 *   - query (required): Natural language search query
 *   - domain (optional): Filter results to a specific knowledge domain
 *   - limit (optional): Maximum number of results to return (default: 10)
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export const RECALL_TOOL_DEFINITION = {
  name: 'brain_recall',
  description:
    'Search your Dopl Brain memories using semantic search. ' +
    'Returns the most relevant facts matching your query. ' +
    'Use this before answering questions about personal preferences, past decisions, or stored context.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query (e.g. "my dietary preferences")',
      },
      domain: {
        type: 'string',
        description:
          'Optional: filter results to a specific domain (e.g. "health", "work", "personal")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 50)',
        minimum: 1,
        maximum: 50,
      },
    },
    required: ['query'],
  },
} as const;

export interface RecallInput {
  query: string;
  domain?: string;
  limit?: number;
}

export async function handleRecall(
  client: BrainApiClient,
  input: RecallInput,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const response = await client.recall({
      query: input.query,
      domain: input.domain,
      limit: input.limit ?? 10,
    });

    const results = response.results ?? [];

    if (results.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No memories found matching: "${input.query}"${input.domain ? ` in domain "${input.domain}"` : ''}.`,
          },
        ],
      };
    }

    const lines: string[] = [
      `Found ${results.length} memory${results.length === 1 ? '' : 'ies'} matching "${input.query}":`,
      '',
    ];

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const meta: string[] = [];
      if (r.domain) meta.push(`domain: ${r.domain}`);
      if (r.similarity !== undefined) meta.push(`relevance: ${(r.similarity * 100).toFixed(0)}%`);
      if (r.source) meta.push(`source: ${r.source}`);

      lines.push(`${i + 1}. [ID: ${r.id}] ${r.content}`);
      if (meta.length > 0) {
        lines.push(`   (${meta.join(' | ')})`);
      }
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;
    return {
      content: [{ type: 'text', text: `❌ brain_recall failed: ${message}` }],
    };
  }
}
