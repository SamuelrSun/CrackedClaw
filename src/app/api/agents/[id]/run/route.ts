import { NextRequest } from "next/server";
import { requireApiAuth, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { AgentRuntime } from "@/lib/agent/runtime";
import { getTools } from "@/lib/agent/tools";
import { buildSystemPromptForUser } from "@/lib/gateway/system-prompt";
import { getModeById } from "@/lib/agent/modes";

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Approximate pricing (per million tokens)
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'claude-haiku-4-20250514': { input: 0.25, output: 1.25 },
};

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

    // Resolve mode
    const agentMode = getModeById((agent.mode as string) || 'agent');

    // Build tools list, filtered by mode if applicable
    let tools = getTools(context);
    if (agentMode.allowedToolPrefixes && agentMode.allowedToolPrefixes.length > 0) {
      tools = tools.filter((t: { name: string }) =>
        agentMode.allowedToolPrefixes!.some(prefix => t.name.startsWith(prefix))
      );
    }

    const basePrompt = await buildSystemPromptForUser(user.id);
    const systemPrompt = `${basePrompt}\n\nYou are an agent named "${agent.name}". Your task: "${agent.task}". Use your tools to make progress on this task immediately.\n\n${agentMode.systemPromptSuffix}`;

    const messages = (history || [])
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const agentModel = (agent.model as string) || 'claude-sonnet-4-20250514';
    const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        let totalInputTokens = 0;
        let totalOutputTokens = 0;

        try {
          for await (const evt of runtime.chatStream(
            {
              model: agentModel,
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

            // Track token usage from any event that includes it
            if (evt.usage) {
              totalInputTokens += (evt.usage as { inputTokens?: number }).inputTokens || 0;
              totalOutputTokens += (evt.usage as { outputTokens?: number }).outputTokens || 0;
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

          // Calculate cost
          const pricing = PRICING[agentModel] || PRICING['claude-sonnet-4-20250514'];
          const costUsd =
            (totalInputTokens / 1_000_000) * pricing.input +
            (totalOutputTokens / 1_000_000) * pricing.output;

          // Update agent record with usage + status
          try {
            await supabase.from('agent_instances').update({
              status: 'idle',
              total_input_tokens: (agent.total_input_tokens || 0) + totalInputTokens,
              total_output_tokens: (agent.total_output_tokens || 0) + totalOutputTokens,
              updated_at: new Date().toISOString(),
            }).eq('id', id);
          } catch {
            // Columns may not exist yet — fall back to status-only update
            await supabase.from('agent_instances').update({
              status: 'idle',
              updated_at: new Date().toISOString(),
            }).eq('id', id);
          }

          // Emit done with usage + cost
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'done',
            usage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
            cost: costUsd,
          })}\n\n`));
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: errorMsg })}\n\n`));

          // Save partial response if any
          if (fullResponse) {
            try {
              await supabase.from('agent_messages').insert({
                agent_id: id,
                role: 'assistant',
                content: fullResponse,
              });
            } catch {}
          }
          try {
            await supabase.from('agent_instances').update({
              status: 'failed',
              updated_at: new Date().toISOString(),
            }).eq('id', id);
          } catch {}
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
