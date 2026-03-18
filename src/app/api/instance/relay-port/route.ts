import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("gateway_url, instance_settings")
    .eq("id", user.id)
    .single();

  // Try to get port from instance_settings first
  const settings = (profile?.instance_settings as Record<string, unknown>) || {};
  if (typeof settings.gatewayPort === "number") {
    return NextResponse.json({ relayPort: settings.gatewayPort + 3 });
  }

  // Fallback: not available
  return NextResponse.json({ relayPort: null });
}
