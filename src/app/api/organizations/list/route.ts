import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

/**
 * GET /api/organizations/list
 * Returns all organizations owned by the current user.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, slug, plan, openclaw_status, openclaw_gateway_url, openclaw_instance_id, created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Failed to list organizations:", error);
      return NextResponse.json({ error: "Failed to list organizations" }, { status: 500 });
    }

    return NextResponse.json({ organizations: orgs || [] });
  } catch (error) {
    console.error("List organizations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
