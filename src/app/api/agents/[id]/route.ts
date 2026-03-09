import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { data: agent, error: dbError } = await supabase
      .from('agent_instances')
      .select('*, agent_messages(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (dbError || !agent) return errorResponse("Agent not found", 404);

    return jsonResponse({
      agent: {
        id: agent.id,
        name: agent.name,
        task: agent.task,
        status: agent.status,
        model: agent.model,
        position: { x: agent.position_x, y: agent.position_y },
        integrations: agent.integrations || [],
        createdAt: agent.created_at,
        lastActiveAt: agent.updated_at,
        messages: (agent.agent_messages || [])
          .sort((x: {created_at: string}, y: {created_at: string}) =>
            new Date(x.created_at).getTime() - new Date(y.created_at).getTime())
          .map((m: {role: string; content: string; created_at: string}) => ({
            role: m.role,
            content: m.content,
            timestamp: m.created_at,
          })),
      }
    });
  } catch (err) {
    console.error("Failed to get agent:", err);
    return errorResponse("Failed to get agent", 500);
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id } = await params;

  try {
    const body = await request.json();
    const supabase = await createClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status) updates.status = body.status;
    if (body.name) updates.name = body.name;
    if (body.position) {
      updates.position_x = body.position.x;
      updates.position_y = body.position.y;
    }

    const { data, error: dbError } = await supabase
      .from('agent_instances')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (dbError || !data) return errorResponse("Agent not found", 404);
    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Failed to update agent:", err);
    return errorResponse("Failed to update agent", 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { user, error } = await requireApiAuth();
  if (error) return error;
  const { id } = await params;

  try {
    const supabase = await createClient();
    const { error: dbError } = await supabase
      .from('agent_instances')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (dbError) throw dbError;
    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Failed to delete agent:", err);
    return errorResponse("Failed to delete agent", 500);
  }
}
