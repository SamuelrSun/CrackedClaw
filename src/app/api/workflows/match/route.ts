import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";
import { matchWorkflow } from "@/lib/workflows/matcher";

// POST /api/workflows/match - Check if a message matches any user workflows
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return errorResponse("Message is required", 400);
    }

    const supabase = await createClient();
    const { data: workflows } = await supabase
      .from("workflows")
      .select("id, name, description, prompt, trigger_phrases")
      .eq("user_id", user.id)
      .eq("status", "active");

    const match = matchWorkflow(message, workflows || []);

    return NextResponse.json({ match });
  } catch {
    return errorResponse("Invalid request body", 400);
  }
}
