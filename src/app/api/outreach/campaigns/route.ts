import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ campaigns: [] });
    }

    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch campaigns:", error);
      return NextResponse.json({ campaigns: [] });
    }

    return NextResponse.json({ campaigns: data || [] });
  } catch (err) {
    console.error("Campaigns GET error:", err);
    return NextResponse.json({ campaigns: [] });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const name = (body.name || "").trim();

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Generate a unique slug
    let slug = slugify(name);
    if (!slug) slug = "campaign";

    // Check for slug uniqueness — append a timestamp suffix if needed
    const { data: existing } = await supabase
      .from("campaigns")
      .select("id")
      .eq("user_id", user.id)
      .eq("slug", slug)
      .single();

    if (existing) {
      slug = `${slug}-${Date.now()}`;
    }

    const { data: campaign, error } = await supabase
      .from("campaigns")
      .insert({
        user_id: user.id,
        name,
        slug,
        status: "setup",
        config: body.config || {},
      })
      .select()
      .single();

    if (error || !campaign) {
      console.error("Failed to create campaign:", error);
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error("Campaign POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
