import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function requireApiAuth() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return { 
      user: null, 
      error: NextResponse.json(
        { error: "Unauthorized" }, 
        { status: 401 }
      ) 
    };
  }

  return { user, error: null };
}

export function jsonResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
