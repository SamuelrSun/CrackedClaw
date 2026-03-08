import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

// POST /api/cron/[id]/toggle - Toggle cron job enabled/disabled
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const { id } = await params;

  try {
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("cron_jobs")
      .select("user_id, enabled")
      .eq("id", id)
      .single();

    if (!existing || existing.user_id !== user.id) {
      return errorResponse("Cron job not found", 404);
    }

    const newEnabled = !existing.enabled;

    const { data, error: updateError } = await supabase
      .from("cron_jobs")
      .update({
        enabled: newEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError || !data) {
      console.error("Failed to toggle cron job:", updateError);
      return errorResponse("Failed to toggle cron job", 500);
    }

    return jsonResponse({
      message: `Cron job ${newEnabled ? "enabled" : "disabled"}`,
      cronJob: data,
    });
  } catch (err) {
    console.error("Toggle cron job error:", err);
    return errorResponse("Failed to toggle cron job", 500);
  }
}
