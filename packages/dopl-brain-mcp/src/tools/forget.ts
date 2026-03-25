/**
 * src/tools/forget.ts
 *
 * MCP tool: brain_forget
 *
 * Permanently deletes a memory from the user's Dopl Brain by ID.
 * This action is irreversible — use with care.
 *
 * Parameters:
 *   - id (required): The ID of the memory to delete
 */

import { BrainApiClient, BrainApiError } from '../brain-api.js';

export const FORGET_TOOL_DEFINITION = {
  name: 'brain_forget',
  description:
    'Permanently delete a memory from your Dopl Brain. ' +
    'This action cannot be undone. ' +
    'You need the memory ID — use brain_recall to find it first. ' +
    'Use this to remove outdated, incorrect, or unwanted memories.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      id: {
        type: 'string',
        description: 'The ID of the memory to permanently delete (from brain_recall results)',
      },
    },
    required: ['id'],
  },
} as const;

export interface ForgetInput {
  id: string;
}

export async function handleForget(
  client: BrainApiClient,
  input: ForgetInput,
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  try {
    await client.forget({ id: input.id });

    return {
      content: [
        {
          type: 'text',
          text: `✅ Memory deleted. (ID: ${input.id})\n   This memory has been permanently removed from your Dopl Brain.`,
        },
      ],
    };
  } catch (err) {
    const message =
      err instanceof BrainApiError ? err.message : `Unexpected error: ${String(err)}`;

    const hint =
      err instanceof BrainApiError && err.statusCode === 404
        ? '\n   Hint: The memory may have already been deleted, or use brain_recall to verify the ID.'
        : '';

    return {
      content: [{ type: 'text', text: `❌ brain_forget failed: ${message}${hint}` }],
    };
  }
}
