import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

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

    // Build messages for LLM
    const messages: Anthropic.MessageParam[] = [
      ...((history || [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))),
      { role: 'user', content: message },
    ];

    const response = await anthropic.messages.create({
      model: agent.model || "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are a helpful AI agent named "${agent.name}". Your original task was: "${agent.task}". Complete tasks efficiently and report your progress clearly.`,
      messages,
    });

    const assistantText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Save response
    await supabase.from('agent_messages').insert({
      agent_id: id,
      role: 'assistant',
      content: assistantText,
    });

    await supabase.from('agent_instances').update({
      status: 'idle',
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    return jsonResponse({ message: assistantText });
  } catch (err) {
    console.error("Agent chat error:", err);
    // Mark as failed
    try {
      const supabase = await createClient();
      await supabase.from('agent_instances').update({ status: 'failed' }).eq('id', id);
    } catch {}
    return errorResponse("Failed to send message", 500);
  }
}
