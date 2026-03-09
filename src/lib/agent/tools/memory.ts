import type { ToolDefinition, AgentContext } from '../runtime';
import { mem0Search, mem0Add, isMem0Enabled } from '@/lib/memory/mem0-client';

interface SearchMemoryInput { query: string; limit?: number; domain?: string; }
interface AddMemoryInput { content: string; metadata?: Record<string, unknown>; }

export const memorySearchTool: ToolDefinition = {
  name: 'memory_search',
  description: 'Search stored memories for the current user. Returns relevant memories.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for in memories' },
      limit: { type: 'number', description: 'Max memories to return (default 5)' },
      domain: { type: 'string', description: 'Optional domain filter: email, calendar, coding, job_search, sales, fenna, general' },
    },
    required: ['query'],
  },
  async execute(input: unknown, context: AgentContext): Promise<unknown> {
    const { query, limit = 5, domain } = input as SearchMemoryInput;
    if (!isMem0Enabled()) return { memories: [], note: 'Memory not configured (OPENAI_API_KEY missing for embeddings)' };
    const results = await mem0Search(query, context.userId, { limit, domain: domain || undefined });
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
    if (!isMem0Enabled()) return { success: false, note: 'Memory not configured' };
    await mem0Add(
      [{ role: 'user', content }],
      context.userId,
      metadata as Record<string, string> | undefined
    );
    return { success: true };
  },
};

export async function autoAddMemory(
  userId: string,
  messages: Array<{ role: string; content: string }>,
): Promise<void> {
  if (!isMem0Enabled()) return;
  try {
    await mem0Add(messages, userId);
  } catch (err) {
    console.error('Failed to auto-add memory:', err);
  }
}
