/**
 * src/tools/remember.ts
 *
 * MCP tool: brain_remember
 *
 * Stores a new fact in the user's Dopl Brain. Facts are persisted permanently
 * and become searchable via brain_recall.
 *
 * Parameters:
 *   - fact (required): The fact or information to store
 *   - domain (optional): Knowledge domain to categorize this fact under
 *   - source (optional): Where this fact came from (e.g. "user", "document", "conversation")
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export const REMEMBER_TOOL_DEFINITION = {
  name: 'brain_remember',
  description:
    'Store a new fact or piece of information in your Dopl Brain. ' +
    'The fact is persisted permanently and can be retrieved later with brain_recall. ' +
    'Use this to save important preferences, decisions, personal context, or anything worth remembering.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      fact: {
        type: 'string',
        description:
          'The fact or information to store (e.g. "I prefer dark mode in all apps")',
      },
      domain: {
        type: 'string',
        description:
          'Optional: knowledge domain to categorize this under (e.g. "preferences", "work", "health")',
      },
      source: {
        type: 'string',
        description:
          'Optional: where this fact came from (e.g. "user", "conversation", "document")',
      },
    },
    required: ['fact'],
  },
} as const;

export interface RememberInput {
  fact: string;
  domain?: string;
  source?: string;
}

export async function handleRemember(
  client: BrainApiClient,
  input: RememberInput,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const response = await client.remember({
      fact: input.fact,
      domain: input.domain,
      source: input.source,
    });

    const parts: string[] = [`✅ Remembered! (ID: ${response.id})`];
    parts.push(`   Fact: "${input.fact}"`);
    if (input.domain) parts.push(`   Domain: ${input.domain}`);
    if (input.source) parts.push(`   Source: ${input.source}`);

    return {
      content: [{ type: 'text', text: parts.join('\n') }],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;
    return {
      content: [{ type: 'text', text: `❌ brain_remember failed: ${message}` }],
    };
  }
}
