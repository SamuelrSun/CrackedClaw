import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Return an HTML page that detects whether it's inside a popup (window.opener)
 * or a direct navigation, and acts accordingly.
 * - Popup: postMessage to opener + close self
 * - Direct: redirect via window.location.href (preserves cookies set by this response)
 */
function authCompleteResponse(redirectTo: string, responseCookies: ReturnType<typeof NextResponse.prototype.cookies.getAll>) {
  const html = `<!DOCTYPE html><html><head><title>Authenticating...</title>
<style>body{background:#0a0a0f;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:monospace;color:rgba(255,255,255,0.5);font-size:11px;text-transform:uppercase;letter-spacing:0.1em}</style>
</head><body><p>Signing in...</p>
<script>
  if (window.opener) {
    try {
      window.opener.postMessage({ type: 'oauth-complete', redirectTo: ${JSON.stringify(redirectTo)} }, window.location.origin);
    } catch(e) {}
    window.close();
    // Fallback if window.close() is blocked
    setTimeout(function() { window.location.href = ${JSON.stringify(redirectTo)}; }, 500);
  } else {
    window.location.href = ${JSON.stringify(redirectTo)};
  }
</script>
<noscript><meta http-equiv="refresh" content="0;url=${redirectTo}"><a href="${redirectTo}">Click here to continue</a></noscript>
</body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  responseCookies.forEach(({ name, value, ...rest }) => {
    response.cookies.set(name, value, rest as Record<string, unknown>);
  });
  return response;
}

async function getPostAuthRedirect(
  supabase: ReturnType<typeof createServerClient>,
  origin: string
): Promise<string> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return `${origin}/login`;

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed, instance_id")
      .eq("id", user.id)
      .single();

    if (profile?.onboarding_completed || profile?.instance_id) {
      return `${origin}/chat`;
    }
  } catch {
    // Default to onboarding on DB errors
  }
  return `${origin}/onboarding`;
}

function createSupabaseFromRequest(request: NextRequest, cookieResponse: NextResponse) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieResponse.cookies.set(name, value, options);
        });
      },
    },
  });
}

export async function GET(request: NextRequest) {
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
    // Create a response to collect cookies onto
    const cookieResponse = NextResponse.redirect(new URL(`${origin}/login?error=auth_failed`));
    const supabase = createSupabaseFromRequest(request, cookieResponse);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (isEmailVerification) {
        return NextResponse.redirect(new URL(`${origin}/verify-email?status=success`));
      }

      let targetUrl: string;
      if (next) {
        targetUrl = `${origin}${next}`;
      } else {
        targetUrl = await getPostAuthRedirect(supabase, origin);
      }

      // Always return HTML that detects popup vs direct navigation client-side.
      // This avoids needing query params (which Supabase may strip/reject).
      return authCompleteResponse(targetUrl, cookieResponse.cookies.getAll());
    }

    if (isEmailVerification) {
      const errorMessage = encodeURIComponent(error.message || "Verification failed");
      return NextResponse.redirect(
        new URL(`${origin}/verify-email?status=error&error=${errorMessage}`)
      );
    }

    return cookieResponse;
  }

  // Handle email verification via token hash
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  if (tokenHash && (tokenType === "signup" || tokenType === "email")) {
    const cookieResponse = NextResponse.redirect(new URL(`${origin}/login?error=auth_failed`));
    const supabase = createSupabaseFromRequest(request, cookieResponse);

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType === "signup" ? "signup" : "email",
    });
    if (!error) {
      const successResponse = NextResponse.redirect(new URL(`${origin}/verify-email?status=success`));
      cookieResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
        successResponse.cookies.set(name, value, rest);
      });
      return successResponse;
    }
    const errorMessage = encodeURIComponent(error.message || "Verification failed");
    return NextResponse.redirect(
      new URL(`${origin}/verify-email?status=error&error=${errorMessage}`)
    );
  }

  return NextResponse.redirect(new URL(`${origin}/login?error=auth_failed`));
}
