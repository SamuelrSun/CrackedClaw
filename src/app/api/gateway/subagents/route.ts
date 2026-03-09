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
      .in("status", ["pending", "running", "completed", "killed"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (dbError) {
      console.error("Failed to list agent tasks:", dbError);
      return jsonResponse({ subagents: [], connected: true });
    }

    return jsonResponse({ subagents: tasks || [], connected: true });
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
