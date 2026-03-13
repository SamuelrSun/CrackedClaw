import type { ToolDefinition, AgentContext } from '../runtime';

const DO_SERVER_URL = process.env.DO_SERVER_URL || 'https://api.usedopl.com';
const DO_SERVER_SECRET = process.env.DO_SERVER_SECRET || '';

async function doServerFileOp(tool: string, input: unknown): Promise<unknown> {
  const res = await fetch(`${DO_SERVER_URL}/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DO_SERVER_SECRET}`,
    },
    body: JSON.stringify({ tool, input }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`DO server error: ${res.status}`);
  return res.json();
}

export const fileReadTool: ToolDefinition = {
  name: 'file_read',
  description: 'Read the contents of a file from the server.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative file path' },
      offset: { type: 'number', description: 'Line number to start reading from (1-indexed)' },
      limit: { type: 'number', description: 'Max lines to read' },
    },
    required: ['path'],
  },
  async execute(input: unknown, _context: AgentContext): Promise<unknown> {
    if (DO_SERVER_SECRET) return doServerFileOp('file_read', input);
    const { path, offset, limit } = input as { path: string; offset?: number; limit?: number };
    const fs = await import('fs/promises');
    const content = await fs.readFile(path, 'utf-8');
    const lines = content.split('\n');
    const start = offset ? offset - 1 : 0;
    const end = limit ? start + limit : undefined;
    return { content: lines.slice(start, end).join('\n'), totalLines: lines.length };
  },
};

export const fileWriteTool: ToolDefinition = {
  name: 'file_write',
  description: 'Write content to a file on the server.',
  input_schema: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'File path to write' },
      content: { type: 'string', description: 'Content to write' },
      append: { type: 'boolean', description: 'Append instead of overwrite' },
    },
    required: ['path', 'content'],
  },
  async execute(input: unknown, _context: AgentContext): Promise<unknown> {
    if (DO_SERVER_SECRET) return doServerFileOp('file_write', input);
    const { path, content, append = false } = input as { path: string; content: string; append?: boolean };
    const fs = await import('fs/promises');
    if (append) {
      await fs.appendFile(path, content, 'utf-8');
    } else {
      await fs.writeFile(path, content, 'utf-8');
    }
    return { success: true, path };
  },
};
