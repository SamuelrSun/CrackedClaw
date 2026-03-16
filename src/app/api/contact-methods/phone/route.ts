import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Format phone number to E.164 (+1XXXXXXXXXX)
function formatPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) {
    const d = raw.replace(/[^\d+]/g, "");
    if (d.length >= 10) return d;
  }
  return null;
}

// GET: return current phone status
export async function GET() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("profiles")
    .select("phone_number, phone_verified, phone_pending_at")
    .eq("id", user.id)
    .single();

  return NextResponse.json({
    phone_number: data?.phone_number ?? null,
    phone_verified: data?.phone_verified ?? false,
    phone_pending_at: data?.phone_pending_at ?? null,
    twilio_number: process.env.TWILIO_PHONE_NUMBER ?? null,
  });
}

// POST: register/update phone number
export async function POST(request: NextRequest) {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const body = await request.json().catch(() => ({}));
  const raw = (body.phone_number ?? "") as string;

  const formatted = formatPhone(raw);
  if (!formatted) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check if this number is already used by another user
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("phone_number", formatted)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "This phone number is already registered" },
      { status: 409 }
    );
  }

  // Save as pending
  await supabase
    .from("profiles")
    .update({
      phone_number: formatted,
      phone_verified: false,
      phone_pending_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  return NextResponse.json({
    success: true,
    phone_number: formatted,
    phone_verified: false,
    twilio_number: process.env.TWILIO_PHONE_NUMBER ?? null,
  });
}

// DELETE: remove phone number
export async function DELETE() {
  const { user, error } = await requireApiAuth();
  if (error) return error;

  const supabase = createAdminClient();
  await supabase
    .from("profiles")
    .update({ phone_number: null, phone_verified: false, phone_pending_at: null })
    .eq("id", user.id);

  return NextResponse.json({ success: true });
}
