import { AgentRuntime, AgentConfig, AgentContext, ToolDefinition } from './runtime';
import { createClient } from '@/lib/supabase/server';

export interface SubagentTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  details?: string;
  result?: string;
}

/**
 * Spawns a subagent task asynchronously. Does not block the caller.
 * Persists state in Supabase agent_tasks table.
 * The agent can output [[task:NAME:STATUS:DETAILS]] markers in chat to show progress.
 */
export async function spawnSubagent(options: {
  name: string;
  prompt: string;
  config: AgentConfig;
  tools: ToolDefinition[];
  context: AgentContext;
  onProgress?: (task: SubagentTask) => void;
}): Promise<string> {
  const { name, prompt, config, tools, context, onProgress } = options;
  const supabase = await createClient();

  // Insert task record
  const { data: taskRow, error } = await supabase
    .from('agent_tasks')
    .insert({
      user_id: context.userId,
      org_id: context.orgId,
      conversation_id: context.conversationId,
      name,
      status: 'pending',
      prompt,
    })
    .select()
    .single();

  if (error || !taskRow) {
    console.error('Failed to create agent_tasks row:', error);
    // Still run without persistence
  }

  const taskId = taskRow?.id ?? crypto.randomUUID();

  const task: SubagentTask = { id: taskId, name, status: 'running' };

  // Run async without blocking
  (async () => {
    try {
      await supabase
        .from('agent_tasks')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', taskId);

      task.status = 'running';
      onProgress?.(task);

      const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);
      const configWithTools = { ...config, tools };
      const result = await runtime.chat(
        configWithTools,
        [{ role: 'user', content: prompt }],
        context,
      );

      task.status = 'done';
      task.result = result.response;
      onProgress?.(task);

      await supabase
        .from('agent_tasks')
        .update({
          status: 'done',
          result: result.response,
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      task.status = 'failed';
      task.details = msg;
      onProgress?.(task);

      try {
        await supabase
          .from('agent_tasks')
          .update({ status: 'failed', error: msg })
          .eq('id', taskId);
      } catch { }
    }
  })();

  return taskId;
}

/**
 * Format a task progress marker for embedding in chat responses.
 * Pattern: [[task:NAME:STATUS:DETAILS]]
 */
export function taskMarker(task: SubagentTask): string {
  return `[[task:${task.name}:${task.status}:${task.details ?? task.result ?? ''}]]`;
}
