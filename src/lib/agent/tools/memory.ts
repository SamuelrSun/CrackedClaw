import type { ToolDefinition, AgentContext } from '../runtime';

interface SearchMemoryInput { query: string; limit?: number; }
interface AddMemoryInput { content: string; metadata?: Record<string, unknown>; }

function getMem0Client() {
  // Lazy import mem0ai - actual integration wired when MEM0_API_KEY is set
  const apiKey = process.env.MEM0_API_KEY;
  if (!apiKey) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MemoryClient } = require('mem0ai');
    return new MemoryClient({ apiKey });
  } catch {
    return null;
  }
}

export const memorySearchTool: ToolDefinition = {
  name: 'memory_search',
  description: 'Search stored memories for the current user. Returns relevant memories.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for in memories' },
      limit: { type: 'number', description: 'Max memories to return (default 10)' },
    },
    required: ['query'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { query, limit = 10 } = input as SearchMemoryInput;
    const client = getMem0Client();
    if (!client) return { memories: [], note: 'Memory service not configured (MEM0_API_KEY missing)' };
    const results = await client.search(query, { user_id: context.userId, limit });
    return { memories: results };
  },
};

export const memoryAddTool: ToolDefinition = {
  name: 'memory_add',
  description: 'Add a new memory entry for the current user.',
  input_schema: {
    type: 'object',
    properties: {
      content: { type: 'string', description: 'Memory content to store' },
      metadata: { type: 'object', description: 'Optional metadata' },
    },
    required: ['content'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { content, metadata } = input as AddMemoryInput;
    const client = getMem0Client();
    if (!client) return { success: false, note: 'Memory service not configured' };
    await client.add([{ role: 'user', content }], { user_id: context.userId, metadata });
    return { success: true };
  },
};

/**
 * Auto-add conversation turn to memory after each chat.
 */
export async function autoAddMemory(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  const client = getMem0Client();
  if (!client) return;
  try {
    await client.add(messages, { user_id: userId });
  } catch (err) {
    console.error('Failed to auto-add memory:', err);
  }
}
