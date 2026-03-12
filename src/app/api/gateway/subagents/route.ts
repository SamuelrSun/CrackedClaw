import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

// GET /api/gateway/subagents - List active/recent tasks for this user
export async function GET(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const { data: tasks, error: dbError } = await supabase
      .from("agent_tasks")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "running", "completed", "done", "killed", "failed"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (dbError) {
      console.error("Failed to list agent tasks:", dbError);
      return jsonResponse({ subagents: [], connected: true });
    }

    // Map agent_tasks columns to SubagentSession shape expected by the client
    const mapped = (tasks || []).map((t: Record<string, unknown>) => ({
      id: t.id,
      label: t.label || t.name || 'Background Task',
      task: t.prompt || t.name,
      model: t.model || undefined,
      status: t.status === 'completed' ? 'done' : t.status === 'pending' ? 'running' : t.status,
      startedAt: t.started_at ? new Date(t.started_at as string).getTime() : undefined,
      endedAt: t.completed_at ? new Date(t.completed_at as string).getTime() : undefined,
      output: t.result || t.error || undefined,
    }));

    return jsonResponse({ subagents: mapped, connected: true });
  } catch (err) {
    console.error("Failed to list subagents:", err);
    return jsonResponse({ subagents: [], connected: true, error: String(err) }, 500);
  }
}

// DELETE /api/gateway/subagents?id=<task_id> - Kill a subagent task
export async function DELETE(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const taskId = new URL(request.url).searchParams.get("id");
  if (!taskId) return errorResponse("id is required", 400);

  try {
    const supabase = await createClient();
    const { error: dbError } = await supabase
      .from("agent_tasks")
      .update({ status: "killed" })
      .eq("id", taskId)
      .eq("user_id", user.id);

    if (dbError) {
      console.error("Failed to kill task:", dbError);
      return errorResponse("Failed to kill task", 500);
    }

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("Failed to kill subagent:", err);
    return errorResponse("Failed to kill task", 500);
  }
}
