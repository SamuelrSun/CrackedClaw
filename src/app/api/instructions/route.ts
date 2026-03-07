import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/supabase/data";

// GET /api/instructions - Fetch user's instructions
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("instructions")
      .select("content")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned (expected for new users)
      console.error("Failed to fetch instructions:", error);
      return NextResponse.json(
        { error: "Failed to fetch instructions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      content: data?.content || "",
    });
  } catch (err) {
    console.error("Instructions GET error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/instructions - Save/update user's instructions
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const content = body.content;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content must be a string" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Check if user already has instructions
    const { data: existing } = await supabase
      .from("instructions")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from("instructions")
        .update({
          content,
          updated_at: now,
        })
        .eq("id", existing.id);

      if (error) {
        console.error("Failed to update instructions:", error);
        return NextResponse.json(
          { error: "Failed to save instructions" },
          { status: 500 }
        );
      }

      // Log activity
      await logActivity(
        "Instructions updated",
        `Updated agent instructions (${content.length} chars)`,
        { length: content.length }
      );
    } else {
      // Insert new
      const { error } = await supabase
        .from("instructions")
        .insert({
          user_id: user.id,
          content,
          created_at: now,
          updated_at: now,
        });

      if (error) {
        console.error("Failed to insert instructions:", error);
        return NextResponse.json(
          { error: "Failed to save instructions" },
          { status: 500 }
        );
      }

      // Log activity
      await logActivity(
        "Instructions created",
        `Created agent instructions (${content.length} chars)`,
        { length: content.length }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Instructions POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PUT is an alias for POST
export async function PUT(request: Request) {
  return POST(request);
}
