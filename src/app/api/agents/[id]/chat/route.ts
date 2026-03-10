import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { AgentRuntime } from "@/lib/agent/runtime";
import { getTools } from "@/lib/agent/tools";
import { buildSystemPromptForUser } from "@/lib/gateway/system-prompt";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return errorResponse("Message is required", 400);
    }

    const supabase = await createClient();

    // Verify ownership
    const { data: agent, error: agentError } = await supabase
      .from('agent_instances')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (agentError || !agent) return errorResponse("Agent not found", 404);

    // Get message history
    const { data: history } = await supabase
      .from('agent_messages')
      .select('role, content')
      .eq('agent_id', id)
      .order('created_at', { ascending: true });

    // Save user message
    await supabase.from('agent_messages').insert({
      agent_id: id,
      role: 'user',
      content: message,
    });

    // Mark agent as running
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

    // Build full system prompt with agent-specific context
    const basePrompt = await buildSystemPromptForUser(user.id);
    const systemPrompt = `${basePrompt}\n\nYou are an agent named "${agent.name}". Your task: "${agent.task}". Use your tools to complete tasks.`;

    // Build messages for LLM
    const messages: Anthropic.MessageParam[] = [
      ...((history || [])
        .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
        .map((m: { role: string; content: string }) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }))),
      { role: 'user', content: message },
    ];

    const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);
    const result = await runtime.chat(
      {
        model: (agent.model as string) || 'claude-sonnet-4-20250514',
        systemPrompt,
        tools,
        maxTokens: 4096,
      },
      messages,
      context,
    );

    // Save response
    await supabase.from('agent_messages').insert({
      agent_id: id,
      role: 'assistant',
      content: result.response,
    });

    await supabase.from('agent_instances').update({
      status: 'idle',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return jsonResponse({ message: result.response, toolResults: result.toolResults });
  } catch (err) {
    console.error("Agent chat error:", err);
    try {
      const supabase = await createClient();
      await supabase.from('agent_instances').update({ status: 'failed' }).eq('id', id);
    } catch {}
    return errorResponse("Failed to send message", 500);
  }
}
