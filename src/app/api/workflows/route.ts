import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { getWorkflows, createWorkflow } from "@/lib/supabase/data";
import type { WorkflowInput } from "@/lib/supabase/data";

export const dynamic = 'force-dynamic';

// GET /api/workflows - List all workflows
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const workflows = await getWorkflows();
    return jsonResponse({ workflows, count: workflows.length, userId: user.id });
  } catch (err) {
    console.error("Failed to fetch workflows:", err);
    return errorResponse("Failed to fetch workflows", 500);
  }
}

// POST /api/workflows - Create a new workflow
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.name || typeof body.name !== "string") {
      return errorResponse("Name is required", 400);
    }
    if (!body.description || typeof body.description !== "string") {
      return errorResponse("Description is required", 400);
    }

    const input: WorkflowInput = {
      name: body.name,
      description: body.description,
      icon: typeof body.icon === "string" ? body.icon : undefined,
      status: body.status === "active" || body.status === "inactive" || body.status === "pending"
        ? body.status : undefined,
      trigger_type: body.trigger_type === "manual" || body.trigger_type === "scheduled" || body.trigger_type === "webhook"
        ? body.trigger_type : undefined,
      schedule: body.schedule as WorkflowInput["schedule"],
    };

    const workflow = await createWorkflow(input);

    return jsonResponse({ message: "Workflow created", workflow, userId: user.id }, 201);
  } catch (err) {
    console.error("Create workflow error:", err);
    return errorResponse("Failed to create workflow", 500);
  }
}
