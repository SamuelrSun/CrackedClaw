/**
 * POST /api/gateway/subagent-events
 * 
 * Receives subagent lifecycle events from OpenClaw gateway instances.
 * Upserts rows in the agent_tasks table so the web UI can show live task cards.
 * 
 * Events:
 *   - spawned: A new subagent was created (status: pending → running)
 *   - running: Subagent started executing
 *   - completed: Subagent finished successfully
 *   - failed: Subagent encountered an error
 *   - killed: Subagent was manually stopped
 * 
 * Auth: Uses push_secret (same as chat push endpoint) or gateway auth token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SubagentEvent {
  event: 'spawned' | 'running' | 'completed' | 'failed' | 'killed';
  user_id: string;
  session_key?: string;       // OpenClaw session key (used as external ID)
  task_id?: string;           // If updating an existing agent_tasks row
  label?: string;             // Human-readable task label
  task?: string;              // Full task description
  model?: string;             // Model used (e.g., "claude-sonnet-4")
  conversation_id?: string;   // Associated conversation
  output?: string;            // Result text (for completed events)
  error?: string;             // Error message (for failed events)
  push_secret?: string;       // Auth
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body: SubagentEvent = await request.json();

    // Auth check
    const expectedSecret = process.env.CHAT_PUSH_SECRET || 'crackedclaw-push-2026';
    const authHeader = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
    
    if (body.push_secret !== expectedSecret && authHeader !== expectedSecret) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const { event, user_id, session_key, task_id, label, task, model, conversation_id, output, error: errorMsg } = body;

    if (!event || !user_id) {
      return jsonResponse({ error: 'event and user_id are required' }, 400);
    }

    const now = new Date().toISOString();

    switch (event) {
      case 'spawned':
      case 'running': {
        // Check if we're updating an existing task (by session_key or task_id)
        if (task_id) {
          const { error: updateErr } = await supabase
            .from('agent_tasks')
            .update({ 
              status: 'running', 
              started_at: now,
              updated_at: now,
            })
            .eq('id', task_id);
          
          if (updateErr) {
            console.error('[subagent-events] Update failed:', updateErr);
            return jsonResponse({ error: 'Failed to update task' }, 500);
          }
          return jsonResponse({ success: true, task_id });
        }

        // Create new task
        const { data: newTask, error: insertErr } = await supabase
          .from('agent_tasks')
          .insert({
            user_id,
            conversation_id: conversation_id || null,
            name: label || task?.substring(0, 100) || 'Background Task',
            label: label || null,
            status: event === 'spawned' ? 'pending' : 'running',
            prompt: task || null,
            model: model || null,
            started_at: event === 'running' ? now : null,
          })
          .select('id')
          .single();

        if (insertErr || !newTask) {
          console.error('[subagent-events] Insert failed:', insertErr);
          return jsonResponse({ error: 'Failed to create task' }, 500);
        }

        return jsonResponse({ success: true, task_id: newTask.id });
      }

      case 'completed': {
        const id = task_id || session_key;
        if (!id) {
          return jsonResponse({ error: 'task_id or session_key required for completed events' }, 400);
        }

        // Try by task_id first, then by matching session_key in prompt field
        const updateData = {
          status: 'completed',
          result: output || null,
          completed_at: now,
          updated_at: now,
        };

        const { error: updateErr, count } = await supabase
          .from('agent_tasks')
          .update(updateData)
          .eq('id', id)
          .eq('user_id', user_id);

        if (updateErr || count === 0) {
          // Fallback: update by user_id + most recent running task with matching label
          if (label) {
            await supabase
              .from('agent_tasks')
              .update(updateData)
              .eq('user_id', user_id)
              .eq('name', label)
              .eq('status', 'running')
              .order('created_at', { ascending: false })
              .limit(1);
          }
        }

        return jsonResponse({ success: true });
      }

      case 'failed': {
        const failId = task_id || session_key;
        const failData = {
          status: 'failed',
          error: errorMsg || 'Unknown error',
          completed_at: now,
          updated_at: now,
        };

        if (failId) {
          const { count } = await supabase
            .from('agent_tasks')
            .update(failData)
            .eq('id', failId)
            .eq('user_id', user_id);

          if (count === 0 && label) {
            await supabase
              .from('agent_tasks')
              .update(failData)
              .eq('user_id', user_id)
              .eq('name', label)
              .eq('status', 'running')
              .order('created_at', { ascending: false })
              .limit(1);
          }
        }

        return jsonResponse({ success: true });
      }

      case 'killed': {
        const killId = task_id;
        if (killId) {
          await supabase
            .from('agent_tasks')
            .update({ status: 'killed', completed_at: now, updated_at: now })
            .eq('id', killId)
            .eq('user_id', user_id);
        }
        return jsonResponse({ success: true });
      }

      default:
        return jsonResponse({ error: `Unknown event: ${event}` }, 400);
    }
  } catch (err) {
    console.error('[subagent-events] Error:', err);
    return jsonResponse({ error: 'Invalid request' }, 400);
  }
}

/**
 * GET /api/gateway/subagent-events
 * Health check for the webhook endpoint.
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    endpoint: '/api/gateway/subagent-events',
    accepts: ['spawned', 'running', 'completed', 'failed', 'killed'],
  });
}
