import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes; companion auto-reconnects

// NOTE: For Supabase Realtime to work on the `messages` table, you must enable
// Realtime for that table in the Supabase dashboard:
//   Database → Replication → Tables → check `messages` (and `agent_tasks`)
// Or via SQL: ALTER PUBLICATION supabase_realtime ADD TABLE messages;
//             ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;

// Use service role client for Realtime subscriptions (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // Auth via X-Companion-Token header (same pattern as /api/gateway/chat/stream)
  const companionToken = request.headers.get('X-Companion-Token');
  if (!companionToken) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_token', companionToken)
    .single();

  if (!profile?.id) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = profile.id;

  // Get the user's recent conversation IDs for server-side filtering
  const { data: convos } = await supabase
    .from('conversations')
    .select('id')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  const convoIds = new Set((convos || []).map((c: { id: string }) => c.id));

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const write = async (event: string, data: Record<string, unknown>): Promise<void> => {
    try {
      await writer.write(
        encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      );
    } catch {
      // writer closed — client disconnected
    }
  };

  // Send initial connection event
  write('connected', { userId, conversationCount: convoIds.size });

  // Keep-alive ping every 30 seconds to prevent proxy timeouts
  const pingInterval = setInterval(() => {
    write('ping', { ts: Date.now() }).catch(() => {});
  }, 30000);

  // Subscribe to new messages across all tables (filter server-side by user's convos)
  // We use server-side callback filtering because Supabase Realtime's `filter` param
  // doesn't support `in` operator for postgres_changes.
  const messageChannel = supabase
    .channel(`companion-messages-${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        const msg = payload.new as Record<string, unknown>;

        // Only forward messages that belong to this user's conversations
        if (!convoIds.has(msg.conversation_id as string)) return;

        // Only push assistant messages; user messages originate from the companion
        if (msg.role !== 'assistant') return;

        await write('new_message', {
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.role,
          content: msg.content,
          created_at: msg.created_at,
        });
      }
    )
    .subscribe();

  // Subscribe to agent_tasks changes for this user (uses filter param — supported for eq)
  const taskChannel = supabase
    .channel(`companion-tasks-${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*', // INSERT, UPDATE, DELETE
        schema: 'public',
        table: 'agent_tasks',
        filter: `user_id=eq.${userId}`,
      },
      async (payload) => {
        const task = (payload.new || payload.old) as Record<string, unknown>;
        await write('task_update', {
          id: task.id,
          name: task.name,
          label: task.label,
          status: task.status,
          result: task.result,
          error: task.error,
          conversation_id: task.conversation_id,
          started_at: task.started_at,
          completed_at: task.completed_at,
        });
      }
    )
    .subscribe();

  // Clean up when client disconnects (AbortSignal fires on close)
  request.signal.addEventListener('abort', () => {
    clearInterval(pingInterval);
    supabase.removeChannel(messageChannel);
    supabase.removeChannel(taskChannel);
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx/proxy buffering
    },
  });
}
