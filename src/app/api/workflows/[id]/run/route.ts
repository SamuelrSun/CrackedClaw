import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { executeWorkflow } from "@/lib/gateway-client";
import { 
  createWorkflowRun, 
  updateWorkflowRun, 
  updateWorkflowLastRun,
  logActivity,
  getOrganization
} from "@/lib/supabase/data";

// POST /api/workflows/[id]/run - Execute a workflow
export async function POST(
  request: NextRequest,
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

    // Check if workflow is active
    if (workflow.status === "inactive") {
      return errorResponse("Workflow is inactive. Activate it first.", 400);
    }

    // Get gateway info from organization (cloud-provisioned) or user_gateways (self-hosted)
    let gatewayUrl: string | null = null;
    let authToken: string | null = null;

    // First check for cloud-provisioned organization
    try {
      const org = await getOrganization(user.id);
      if (org?.openclaw_gateway_url && org?.openclaw_auth_token && org?.openclaw_status === "running") {
        gatewayUrl = org.openclaw_gateway_url;
        authToken = org.openclaw_auth_token;
      }
    } catch (e) {
      console.error("Failed to get organization:", e);
    }

    // Fall back to user_gateways table (self-hosted)
    if (!gatewayUrl) {
      const { data } = await supabase
        .from("user_gateways")
        .select("gateway_url, auth_token")
        .eq("user_id", user.id)
        .limit(1);
      
      if (data && data.length > 0) {
        gatewayUrl = data[0].gateway_url;
        authToken = data[0].auth_token;
      }
    }

    if (!gatewayUrl || !authToken) {
      return errorResponse("No gateway connected. Please connect your OpenClaw gateway first.", 400);
    }

    // Create workflow run record
    const workflowRun = await createWorkflowRun(id, "running");

    // Execute workflow via gateway
    const result = await executeWorkflow(
      gatewayUrl,
      authToken,
      {
        name: workflow.name,
        description: workflow.description || "",
        config: workflow.config,
      }
    );

    // Update run status based on result
    if (result.error) {
      await updateWorkflowRun(workflowRun.id, "failed", { error: result.error });
      
      await logActivity(
        "Workflow failed",
        `${workflow.name} execution failed: ${result.error}`,
        { workflowId: id, runId: workflowRun.id }
      );

      return jsonResponse({
        success: false,
        run: {
          id: workflowRun.id,
          status: "failed",
          error: result.error,
        },
      });
    }

    // Success
    await updateWorkflowRun(workflowRun.id, "completed", { 
      response: result.response,
      runId: result.runId,
    });
    await updateWorkflowLastRun(id);
    
    await logActivity(
      "Workflow completed",
      `${workflow.name} executed successfully`,
      { workflowId: id, runId: workflowRun.id }
    );

    return jsonResponse({
      success: true,
      run: {
        id: workflowRun.id,
        status: "completed",
        response: result.response,
      },
    });
  } catch (err) {
    console.error("Workflow execution error:", err);
    return errorResponse("Failed to execute workflow", 500);
  }
}
