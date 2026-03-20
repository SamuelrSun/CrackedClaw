import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { mem0GetAll } from "@/lib/memory/mem0-client";

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

    // Apply user model: check cross-campaign memories and record them in campaign config
    try {
      const [profileMemories, workflowMemories] = await Promise.all([
        mem0GetAll(user.id, 'user:profile').catch(() => []),
        mem0GetAll(user.id, 'user:workflows').catch(() => []),
      ]);

      if (profileMemories.length > 0 || workflowMemories.length > 0) {
        await supabase.from('campaigns').update({
          config: {
            ...(campaign.config as Record<string, unknown>),
            user_model_applied: true,
            user_model_applied_at: new Date().toISOString(),
            user_profile_count: profileMemories.length,
            user_workflow_count: workflowMemories.length,
          },
        }).eq('id', campaign.id);
      }
    } catch (modelErr) {
      // Non-critical — campaign was created successfully
      console.warn('[campaigns] Failed to apply user model:', modelErr);
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    console.error("Campaign POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
