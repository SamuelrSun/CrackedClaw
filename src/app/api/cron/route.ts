import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

// GET /api/cron - List cron jobs
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const supabase = await createClient();
    const { data, error: fetchError } = await supabase
      .from("cron_jobs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Failed to fetch cron jobs:", fetchError);
      return errorResponse("Failed to fetch cron jobs", 500);
    }

    const cronJobs = data || [];
    return jsonResponse({ cronJobs, count: cronJobs.length });
  } catch (err) {
    console.error("Cron jobs fetch error:", err);
    return errorResponse("Failed to fetch cron jobs", 500);
  }
}

// POST /api/cron - Create a cron job
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json() as Record<string, unknown>;

    if (!body.name || typeof body.name !== "string") {
      return errorResponse("Name is required", 400);
    }
    if (!body.schedule || typeof body.schedule !== "string") {
      return errorResponse("Schedule (cron expression) is required", 400);
    }

    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data, error: insertError } = await supabase
      .from("cron_jobs")
      .insert({
        user_id: user.id,
        workflow_id: typeof body.workflow_id === "string" ? body.workflow_id : null,
        name: body.name,
        schedule: body.schedule,
        enabled: typeof body.enabled === "boolean" ? body.enabled : true,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error("Failed to create cron job:", insertError);
      return errorResponse("Failed to create cron job", 500);
    }

    return jsonResponse({ message: "Cron job created", cronJob: data }, 201);
  } catch (err) {
    console.error("Create cron job error:", err);
    return errorResponse("Failed to create cron job", 500);
  }
}
