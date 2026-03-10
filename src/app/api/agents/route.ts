import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = 'force-dynamic';

const anthropic = new Anthropic();

async function generateAgentName(task: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-20250514",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `Generate a short name (max 3 words) with a relevant emoji for an AI agent that will: "${task}". Reply with ONLY the emoji and name, nothing else. Example: "🔍 AR Research"`
      }]
    });
    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : task.slice(0, 30);
    return text;
  } catch {
    return `🤖 ${task.slice(0, 25)}`;
  }
}

export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const { data: agents, error: dbError } = await supabase
      .from('agent_instances')
      .select('*, agent_messages(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (dbError) throw dbError;

    const formatted = (agents || []).map((a) => ({
      id: a.id,
      name: a.name,
      task: a.task,
      status: a.status,
      model: a.model,
      position: { x: a.position_x, y: a.position_y },
      integrations: a.integrations || [],
      createdAt: a.created_at,
      lastActiveAt: a.updated_at,
      messages: (a.agent_messages || [])
        .sort((x: {created_at: string}, y: {created_at: string}) => 
          new Date(x.created_at).getTime() - new Date(y.created_at).getTime())
        .map((m: {role: string; content: string; created_at: string}) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        })),
    }));

    return jsonResponse({ agents: formatted });
  } catch (err) {
    console.error("Failed to fetch agents:", err);
    return errorResponse("Failed to fetch agents", 500);
  }
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { task } = body;

    if (!task || typeof task !== 'string') {
      return errorResponse("Task is required", 400);
    }

    const name = await generateAgentName(task);
    const supabase = await createClient();

    // Auto-position: find a free grid slot
    const { data: existing } = await supabase
      .from('agent_instances')
      .select('position_x, position_y')
      .eq('user_id', user.id);

    const cols = 3;
    const colWidth = 360;
    const rowHeight = 450;
    const padding = 40;
    const count = (existing || []).length;
    const col = count % cols;
    const row = Math.floor(count / cols);
    const position_x = padding + col * colWidth;
    const position_y = padding + row * rowHeight;

    const { data: agent, error: dbError } = await supabase
      .from('agent_instances')
      .insert({
        user_id: user.id,
        name,
        task,
        status: 'running',
        position_x,
        position_y,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Send initial task as first message
    await supabase.from('agent_messages').insert({
      agent_id: agent.id,
      role: 'user',
      content: task,
    });

    // Get initial LLM response WITH tools
    try {
      const { data: integrations } = await supabase
        .from('user_integrations')
        .select('provider')
        .eq('user_id', user.id)
        .eq('status', 'connected');

      const agentContext = {
        userId: user.id,
        orgId: '',
        conversationId: agent.id,
        companionConnected: false,
        integrations: (integrations || []).map((i: { provider: string }) => i.provider),
      };

      const { buildSystemPromptForUser } = await import('@/lib/gateway/system-prompt');
      const { AgentRuntime } = await import('@/lib/agent/runtime');
      const { getTools } = await import('@/lib/agent/tools');

      const systemPrompt = await buildSystemPromptForUser(user.id, task);
      const tools = getTools(agentContext);
      const runtime = new AgentRuntime(process.env.ANTHROPIC_API_KEY!);

      const result = await runtime.chat(
        {
          model: agent.model || 'claude-sonnet-4-20250514',
          systemPrompt: systemPrompt + `\n\nYou are an agent named "${name}". Your task: "${task}". Use your tools to make progress on this task immediately.`,
          tools,
          maxTokens: 4096,
        },
        [{ role: 'user', content: task }],
        agentContext,
      );

      await supabase.from('agent_messages').insert({
        agent_id: agent.id,
        role: 'assistant',
        content: result.response,
      });

      await supabase.from('agent_instances').update({
        status: 'idle',
        updated_at: new Date().toISOString(),
      }).eq('id', agent.id);
    } catch (err) {
      console.error('Agent initial response error:', err);
      await supabase.from('agent_instances').update({ status: 'idle' }).eq('id', agent.id);
    }

    // Return fresh agent
    const { data: fresh } = await supabase
      .from('agent_instances')
      .select('*, agent_messages(*)')
      .eq('id', agent.id)
      .single();

    const formatted = {
      id: fresh.id,
      name: fresh.name,
      task: fresh.task,
      status: fresh.status,
      model: fresh.model,
      position: { x: fresh.position_x, y: fresh.position_y },
      integrations: fresh.integrations || [],
      createdAt: fresh.created_at,
      lastActiveAt: fresh.updated_at,
      messages: (fresh.agent_messages || [])
        .sort((x: {created_at: string}, y: {created_at: string}) => 
          new Date(x.created_at).getTime() - new Date(y.created_at).getTime())
        .map((m: {role: string; content: string; created_at: string}) => ({
          role: m.role,
          content: m.content,
          timestamp: m.created_at,
        })),
    };

    return jsonResponse({ agent: formatted }, 201);
  } catch (err) {
    console.error("Failed to create agent:", err);
    return errorResponse("Failed to create agent", 500);
  }
}
