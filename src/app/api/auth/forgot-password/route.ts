import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Use configured app URL instead of spoofable Origin header
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://usedopl.com";

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    });

    if (error) {
      // Don't reveal if email exists or not for security
      console.error("Password reset error:", error.message);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      message: "If an account exists with this email, you will receive reset instructions",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
