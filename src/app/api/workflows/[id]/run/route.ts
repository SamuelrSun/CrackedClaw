import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import {
  createWorkflowRun,
  updateWorkflowLastRun,
  logActivity,
} from "@/lib/supabase/data";

// POST /api/workflows/[id]/run - Trigger a workflow run
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const supabase = await createClient();

    // Fetch the workflow
    const { data: workflow, error: workflowError } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (workflowError || !workflow) {
      return errorResponse("Workflow not found", 404);
    }

    if (workflow.status === "inactive") {
      return errorResponse("Workflow is inactive", 400);
    }

    const now = new Date().toISOString();

    // Create a conversation pre-seeded with the workflow prompt
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        user_id: user.id,
        title: `${workflow.name as string} — Run`,
        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (convError || !conversation) {
      console.error("Failed to create conversation:", convError);
      return errorResponse("Failed to create conversation", 500);
    }

    // Increment run_count and set last_run
    const currentRunCount = (workflow.run_count as number | null) ?? 0;
    await supabase
      .from("workflows")
      .update({
        run_count: currentRunCount + 1,
        last_run: now,
        updated_at: now,
      })
      .eq("id", id);

    // Create workflow run record
    const workflowRun = await createWorkflowRun(id, "running");
    await updateWorkflowLastRun(id);

    await logActivity(
      "Workflow run started",
      `Started run for: ${workflow.name as string}`,
      { workflowId: id, runId: workflowRun.id, conversationId: conversation.id as string }
    );

    return jsonResponse({
      conversationId: conversation.id as string,
      workflowId: id,
      prompt: (workflow.description as string) || (workflow.name as string),
      runId: workflowRun.id,
    }, 201);
  } catch (err) {
    console.error("Workflow run error:", err);
    return errorResponse("Failed to trigger workflow run", 500);
  }
}
