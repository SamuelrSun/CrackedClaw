/**
 * src/tools/update.ts
 *
 * MCP tool: brain_update
 *
 * Updates the content of an existing memory in the user's Dopl Brain.
 * Requires the memory ID (returned by brain_recall or brain_remember).
 *
 * Parameters:
 *   - id (required): The ID of the memory to update
 *   - content (required): The new content to replace the existing memory with
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export const UPDATE_TOOL_DEFINITION = {
  name: 'brain_update',
  description:
    'Update the content of an existing memory in your Dopl Brain. ' +
    'You need the memory ID — use brain_recall to find it first. ' +
    'Use this to correct outdated information or refine stored facts.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'The ID of the memory to update (from brain_recall results)',
      },
      content: {
        type: 'string',
        description: 'The new content to replace the existing memory with',
      },
    },
    required: ['id', 'content'],
  },
} as const;

export interface UpdateInput {
  id: string;
  content: string;
}

export async function handleUpdate(
  client: BrainApiClient,
  input: UpdateInput,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    const response = await client.update({
      id: input.id,
      content: input.content,
    });

    return {
      content: [
        {
          type: 'text',
          text: [
            `✅ Memory updated! (ID: ${response.id})`,
            `   New content: "${input.content}"`,
          ].join('\n'),
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;

    // Provide a more helpful message for 404 errors
    const hint =
      err instanceof BrainApiError && err.statusCode === 404
        ? '\n   Hint: Use brain_recall to find the correct memory ID first.'
        : '';

    return {
      content: [{ type: 'text', text: `❌ brain_update failed: ${message}${hint}` }],
    };
  }
}
