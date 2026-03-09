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

    // Map slugs to OAuth providers (e.g. google-sheets -> google)
    const SLUG_TO_PROVIDER: Record<string, string> = {
      "google-sheets": "google",
      "google-drive": "google",
      "google-calendar": "google",
      "google-docs": "google",
      "gmail": "google",
      "google-workspace": "google",
    };

    // Get unique providers to check
    const providersToCheck = Array.from(new Set(slugs.map(s => SLUG_TO_PROVIDER[s] || s)));

    // Check user_integrations (where OAuth connections are actually stored)
    const { data, error: dbErr } = await supabase
      .from("user_integrations")
      .select("provider, status")
      .eq("user_id", user.id)
      .eq("status", "connected")
      .in("provider", providersToCheck);

    if (dbErr) {
      console.error("status-by-slugs error:", dbErr.message);
      return jsonResponse({ connected: [] });
    }

    // Map back: if google is connected, mark all google-* slugs as connected
    const connectedProviders = new Set((data || []).map((r: { provider: string }) => r.provider));
    const connected = slugs.filter(slug => {
      const provider = SLUG_TO_PROVIDER[slug] || slug;
      return connectedProviders.has(provider);
    });

    return jsonResponse({ connected });
  } catch {
    return errorResponse("Invalid request", 400);
  }
}
