import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

// POST /api/workflows/save - Save a workflow built by the AI builder
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { name, description, trigger, steps } = body;

    if (!name || !trigger || !steps) {
      return errorResponse("name, trigger, and steps are required", 400);
    }

    const supabase = await createClient();

    const now = new Date().toISOString();
    const workflowData = {
      user_id: user.id,
      name,
      description: description || "",
      trigger_config: trigger,
      steps: steps,
      status: "draft",
      created_at: now,
      updated_at: now,
    };

    // Try inserting into a workflows_builder table first, fallback to existing workflows table
    let savedWorkflow = null;

    // Try to use existing workflows table with compatible fields
    try {
      const { data, error: insertError } = await supabase
        .from("workflows")
        .insert({
          name,
          description: description || "",
          status: "inactive",
          trigger_type: trigger.type === "schedule" ? "scheduled" : trigger.type === "webhook" ? "webhook" : "manual",
          schedule: trigger.type === "schedule" ? { cron: trigger.config?.cron, timezone: trigger.config?.timezone } : null,
          metadata: {
            trigger_config: trigger,
            steps: steps.map((s: { id: string; name: string; description: string; integration?: string; config?: Record<string, unknown> }) => ({
              id: s.id,
              description: s.description || s.name,
              integrationSlug: s.integration,
            })),
            requiredIntegrations: Array.from(new Set(steps.map((s: { integration?: string }) => s.integration).filter(Boolean))),
            builderWorkflow: workflowData,
          },
        })
        .select()
        .single();

      if (!insertError && data) {
        savedWorkflow = data;
      }
    } catch (e) {
      console.error("Failed to save to workflows table:", e);
    }

    if (!savedWorkflow) {
      return errorResponse("Failed to save workflow", 500);
    }

    return jsonResponse({ workflow: savedWorkflow, success: true });
  } catch (err) {
    console.error("Failed to save workflow:", err);
    return errorResponse("Failed to save workflow", 500);
  }
}
