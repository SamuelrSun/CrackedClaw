import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { getWorkflows, logActivity } from "@/lib/supabase/data";

// GET /api/workflows - List all workflows
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const workflows = await getWorkflows();
    
    return jsonResponse({
      workflows,
      count: workflows.length,
      userId: user.id,
    });
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
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return errorResponse("Name is required", 400);
    }
    if (!body.description) {
      return errorResponse("Description is required", 400);
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error: insertError } = await supabase
      .from("workflows")
      .insert({
        user_id: user.id,
        name: body.name,
        description: body.description,
        status: body.status || "active",
        icon: body.icon || "Zap",
        config: body.config || {},
        schedule: body.schedule || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create workflow:", insertError);
      return errorResponse("Failed to create workflow", 500);
    }

    // Log activity
    await logActivity(
      "Workflow created",
      `Created workflow: ${body.name}`,
      { workflowId: data.id }
    );

    const workflow = {
      id: data.id,
      name: data.name,
      description: data.description,
      status: data.status || "active",
      lastRun: data.last_run || "Never",
      icon: data.icon || "Zap",
    };

    return jsonResponse(
      { 
        message: "Workflow created", 
        workflow,
      }, 
      201
    );
  } catch (err) {
    console.error("Create workflow error:", err);
    return errorResponse("Invalid request body", 400);
  }
}
