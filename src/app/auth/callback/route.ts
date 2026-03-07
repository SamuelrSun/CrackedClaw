import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const type = searchParams.get("type");

  // Handle email verification callback
  const isEmailVerification = type === "email_verification" || 
    searchParams.get("token_hash") || 
    searchParams.get("type") === "signup" ||
    searchParams.get("type") === "email";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // If this is an email verification, redirect to verify-email page
      if (isEmailVerification) {
        return NextResponse.redirect(`${origin}/verify-email?status=success`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    
    // If verification failed, redirect to verify-email with error
    if (isEmailVerification) {
      const errorMessage = encodeURIComponent(error.message || "Verification failed");
      return NextResponse.redirect(`${origin}/verify-email?status=error&error=${errorMessage}`);
    }
  }

  // Handle token_hash for email verification (Supabase magic link format)
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  
  if (tokenHash && (tokenType === "signup" || tokenType === "email")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType === "signup" ? "signup" : "email",
    });
    
    if (!error) {
      return NextResponse.redirect(`${origin}/verify-email?status=success`);
    }
    
    const errorMessage = encodeURIComponent(error.message || "Verification failed");
    return NextResponse.redirect(`${origin}/verify-email?status=error&error=${errorMessage}`);
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
