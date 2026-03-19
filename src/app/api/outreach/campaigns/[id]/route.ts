import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.id)
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error("Campaign GET error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.status !== undefined) updates.status = body.status;
    if (body.config !== undefined) updates.config = body.config;
    updates.updated_at = new Date().toISOString();

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .update(updates)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !campaign) {
      return NextResponse.json({ error: "Not found or update failed" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error("Campaign PATCH error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("campaigns")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Delete failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Campaign DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
