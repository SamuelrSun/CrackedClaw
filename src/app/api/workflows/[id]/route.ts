import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getWorkflow, updateWorkflow, deleteWorkflow, logActivity } from "@/lib/supabase/data";
import type { WorkflowInput } from "@/lib/supabase/data";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/workflows/[id]
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const workflow = await getWorkflow(id);
    if (!workflow) {
      return errorResponse("Workflow not found", 404);
    }
    return jsonResponse({ workflow });
  } catch (err) {
    console.error("Get workflow error:", err);
    return errorResponse("Failed to fetch workflow", 500);
  }
}

// PATCH /api/workflows/[id]
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const body = await request.json() as Partial<WorkflowInput>;
    const workflow = await updateWorkflow(id, body);
    await logActivity("Workflow updated", `Updated workflow: ${workflow.name}`, { workflowId: id });
    return jsonResponse({ message: "Workflow updated", workflow });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update workflow";
    console.error("Update workflow error:", err);
    if (message.includes("not found") || message.includes("access denied")) {
      return errorResponse(message, 404);
    }
    return errorResponse(message, 500);
  }
}

// DELETE /api/workflows/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    await deleteWorkflow(id);
    await logActivity("Workflow deleted", `Deleted workflow ${id}`, { workflowId: id });
    return jsonResponse({ message: "Workflow deleted" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete workflow";
    console.error("Delete workflow error:", err);
    if (message.includes("not found") || message.includes("access denied")) {
      return errorResponse(message, 404);
    }
    return errorResponse(message, 500);
  }
}
