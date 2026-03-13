import { exec as nodeExec } from 'child_process';
import { promisify } from 'util';
import type { ToolDefinition, AgentContext } from '../runtime';

const execAsync = promisify(nodeExec);

const DO_SERVER_URL = process.env.DO_SERVER_URL || 'https://api.usedopl.com';
const DO_SERVER_SECRET = process.env.DO_SERVER_SECRET || '';

interface ExecInput {
  command: string;
  timeout?: number;
  workdir?: string;
}

interface ExecOutput {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

async function runOnDoServer(input: ExecInput): Promise<ExecOutput> {
  const res = await fetch(`${DO_SERVER_URL}/tools/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DO_SERVER_SECRET}`,
    },
    body: JSON.stringify({ tool: 'exec', input }),
    signal: AbortSignal.timeout((input.timeout ?? 30) * 1000 + 5000),
  });
  if (!res.ok) throw new Error(`DO server error: ${res.status} ${await res.text()}`);
  return res.json();
}

export const execTool: ToolDefinition = {
  name: 'exec',
  description: 'Run a shell command on the server. Returns stdout, stderr, and exit code. For long-running or resource-intensive commands, routes to the DO server.',
  input_schema: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'Shell command to execute' },
      timeout: { type: 'number', description: 'Timeout in seconds (default 30)' },
      workdir: { type: 'string', description: 'Working directory' },
    },
    required: ['command'],
  },
  async execute(input: unknown, _context: AgentContext): Promise<ExecOutput> {
    const { command, timeout = 30, workdir } = input as ExecInput;

    // Route to DO server if available and configured
    if (DO_SERVER_SECRET && DO_SERVER_URL) {
      try {
        return await runOnDoServer({ command, timeout, workdir });
      } catch (err) {
        console.error('DO server exec failed, falling back to local:', err);
      }
    }

    // Local fallback (Vercel will timeout but useful for dev)
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: timeout * 1000,
        cwd: workdir,
      });
      return { stdout, stderr, exitCode: 0 };
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number };
      return {
        stdout: e.stdout ?? '',
        stderr: e.stderr ?? String(err),
        exitCode: e.code ?? 1,
      };
    }
  },
};
