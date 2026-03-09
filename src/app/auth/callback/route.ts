import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getOnboardingRedirect(origin: string): Promise<string> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return `${origin}/login`;

    const { data } = await supabase
      .from("onboarding_state")
      .select("phase")
      .eq("user_id", user.id)
      .single();

    if (data?.phase === "complete") return `${origin}/`;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed) return `${origin}/`;
  } catch {
    // Ignore DB errors
  }
  return `${origin}/onboarding`;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? null;
  const type = searchParams.get("type");

  const isEmailVerification =
    type === "email_verification" ||
    searchParams.get("token_hash") !== null ||
    type === "signup" ||
    type === "email";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (isEmailVerification) {
        return NextResponse.redirect(`${origin}/verify-email?status=success`);
      }
      if (next) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const redirectTo = await getOnboardingRedirect(origin);
      return NextResponse.redirect(redirectTo);
    }

    if (isEmailVerification) {
      const errorMessage = encodeURIComponent(error.message || "Verification failed");
      return NextResponse.redirect(`${origin}/verify-email?status=error&error=${errorMessage}`);
    }
  }

  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  if (tokenHash && (tokenType === "signup" || tokenType === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType === "signup" ? "signup" : "email",
    });
    if (!error) return NextResponse.redirect(`${origin}/verify-email?status=success`);
    const errorMessage = encodeURIComponent(error.message || "Verification failed");
    return NextResponse.redirect(`${origin}/verify-email?status=error&error=${errorMessage}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
