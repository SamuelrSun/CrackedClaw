import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/cron/[id] - Update a cron job
export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("cron_jobs")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return errorResponse("Cron job not found", 404);
    }

    const body = await request.json() as Record<string, unknown>;
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.name === "string") updateData.name = body.name;
    if (typeof body.schedule === "string") updateData.schedule = body.schedule;
    if (typeof body.workflow_id === "string") updateData.workflow_id = body.workflow_id;
    if (typeof body.enabled === "boolean") updateData.enabled = body.enabled;

    const { data, error: updateError } = await supabase
      .from("cron_jobs")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError || !data) {
      console.error("Failed to update cron job:", updateError);
      return errorResponse("Failed to update cron job", 500);
    }

    return jsonResponse({ message: "Cron job updated", cronJob: data });
  } catch (err) {
    console.error("Update cron job error:", err);
    return errorResponse("Failed to update cron job", 500);
  }
}

// DELETE /api/cron/[id] - Delete a cron job
export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("cron_jobs")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return errorResponse("Cron job not found", 404);
    }

    const { error: deleteError } = await supabase
      .from("cron_jobs")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Failed to delete cron job:", deleteError);
      return errorResponse("Failed to delete cron job", 500);
    }

    return jsonResponse({ message: "Cron job deleted" });
  } catch (err) {
    console.error("Delete cron job error:", err);
    return errorResponse("Failed to delete cron job", 500);
  }
}
