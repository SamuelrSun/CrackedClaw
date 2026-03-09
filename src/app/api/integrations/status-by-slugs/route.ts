import { NextRequest } from "next/server";
import { requireApiAuth, jsonResponse, errorResponse } from "@/lib/api-auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/integrations/status-by-slugs
// Body: { slugs: string[] }
// Returns which slugs are already connected for this user
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  try {
    const { slugs } = await request.json() as { slugs: string[] };
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return jsonResponse({ connected: [] });
    }

    const supabase = await createClient();

    const { data, error: dbErr } = await supabase
      .from("integrations")
      .select("slug, status")
      .eq("user_id", user.id)
      .in("slug", slugs);

    if (dbErr) {
      console.error("status-by-slugs error:", dbErr.message);
      return jsonResponse({ connected: [] });
    }

    // Consider "connected" or "disconnected" (record exists) both as "added"
    const connected = (data || []).map((r: { slug: string }) => r.slug);

    return jsonResponse({ connected });
  } catch {
    return errorResponse("Invalid request", 400);
  }
}
