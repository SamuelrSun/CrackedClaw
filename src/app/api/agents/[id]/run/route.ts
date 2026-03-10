import { NextRequest } from "next/server";
import { requireApiAuth, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { AgentRuntime } from "@/lib/agent/runtime";
import { getTools } from "@/lib/agent/tools";
import { buildSystemPromptForUser } from "@/lib/gateway/system-prompt";

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const { message } = body as { message?: string };

    const supabase = await createClient();

    // Verify ownership + get agent
    const { data: agent, error: agentError } = await supabase
      .from('agent_instances')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (agentError || !agent) return errorResponse("Agent not found", 404);

    // Save new message if provided
    if (message && typeof message === 'string') {
      await supabase.from('agent_messages').insert({
        agent_id: id,
        role: 'user',
        content: message,
      });
    }

    // Load full message history
    const { data: history } = await supabase
      .from('agent_messages')
      .select('role, content')
      .eq('agent_id', id)
      .order('created_at', { ascending: true });

    // Set status to running
    await supabase.from('agent_instances').update({
      status: 'running',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    // Get user's connected integrations
    const { data: integrations } = await supabase
      .from('user_integrations')
      .select('provider')
      .eq('user_id', user.id)
      .eq('status', 'connected');

    const context = {
      userId: user.id,
      orgId: (agent.org_id as string) || '',
      conversationId: id,
      companionConnected: false,
      integrations: (integrations || []).map((i: { provider: string }) => i.provider),
    };

    const tools = getTools(context);
    const basePrompt = await buildSystemPromptForUser(user.id);
    const systemPrompt = `${basePrompt}\n\nYou are an agent named "${agent.name}". Your task: "${agent.task}". Use your tools to make progress on this task immediately.`;

    const messages = (history || [])
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        try {
          for await (const evt of runtime.chatStream(
            {
              model: (agent.model as string) || 'claude-sonnet-4-20250514',
              systemPrompt,
              tools,
              maxTokens: 4096,
            },
            messages,
            context,
          )) {
            if (evt.type === 'token') {
              fullResponse += evt.text;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));
          }

          // Save the full response
          if (fullResponse) {
            await supabase.from('agent_messages').insert({
              agent_id: id,
              role: 'assistant',
              content: fullResponse,
            });
          }
          await supabase.from('agent_instances').update({
            status: 'idle',
            updated_at: new Date().toISOString(),
          }).eq('id', id);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`));

          // Save partial response if any
          if (fullResponse) {
            try { await supabase.from('agent_messages').insert({
              agent_id: id,
              role: 'assistant',
              content: fullResponse,
            }); } catch {}
          }
          try { await supabase.from('agent_instances').update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          }).eq('id', id); } catch {}
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error("Agent run error:", err);
    return errorResponse("Failed to run agent", 500);
  }
}
