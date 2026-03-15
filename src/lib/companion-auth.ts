import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client (bypasses RLS for token lookup)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface CompanionAuthResult {
  userId: string | null;
  error: NextResponse | null;
}

/**
 * Authenticate a companion request via X-Companion-Token header.
 * Looks up the token against the `auth_token` column of the `profiles` table.
 */
export async function authenticateCompanion(
  request: NextRequest
): Promise<CompanionAuthResult> {
  const token = request.headers.get("X-Companion-Token");

  if (!token) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Missing X-Companion-Token header" }, { status: 401 }),
    };
  }

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("auth_token", token)
    .single();

  if (error || !profile) {
    return {
      userId: null,
      error: NextResponse.json({ error: "Invalid or expired companion token" }, { status: 401 }),
    };
  }

  return { userId: profile.id, error: null };
}
