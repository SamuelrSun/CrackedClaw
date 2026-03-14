import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * When OAuth completes in a popup window, return an HTML page
 * that notifies the opener and closes itself instead of redirecting.
 */
function popupCloseResponse(redirectTo: string, cookies: { name: string; value: string }[]) {
  const html = `<!DOCTYPE html><html><head><title>Authenticating...</title></head><body>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: 'oauth-complete', redirectTo: ${JSON.stringify(redirectTo)} }, window.location.origin);
    window.close();
  } else {
    window.location.href = ${JSON.stringify(redirectTo)};
  }
</script>
<noscript><a href="${redirectTo}">Click here to continue</a></noscript>
</body></html>`;
  const response = new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
  cookies.forEach(({ name, value, ...rest }) => {
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

    // Check if user has completed onboarding via their profile
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
    // Build the redirect response first so we can attach cookies directly to it.
    // IMPORTANT: cookies set via next/headers cookies() are NOT forwarded to a
    // NextResponse.redirect() created separately — the session cookie would be
    // lost, causing /chat to redirect back to /login immediately after OAuth.
    const response = NextResponse.redirect(new URL(`${origin}/login?error=auth_failed`));

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write cookies directly onto the response we will return
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const isPopup = searchParams.get("popup") === "1";

      if (isEmailVerification) {
        return NextResponse.redirect(new URL(`${origin}/verify-email?status=success`));
      }

      let targetUrl: string;
      if (next) {
        targetUrl = `${origin}${next}`;
      } else {
        targetUrl = await getPostAuthRedirect(supabase, origin);
      }

      // If this callback is inside a popup window, close it and notify the opener
      if (isPopup) {
        return popupCloseResponse(targetUrl, response.cookies.getAll());
      }

      const redirectResponse = NextResponse.redirect(new URL(targetUrl));
      response.cookies.getAll().forEach(({ name, value, ...rest }) => {
        redirectResponse.cookies.set(name, value, rest);
      });
      return redirectResponse;
    }

    if (isEmailVerification) {
      const errorMessage = encodeURIComponent(error.message || "Verification failed");
      return NextResponse.redirect(
        new URL(`${origin}/verify-email?status=error&error=${errorMessage}`)
      );
    }

    // Return with auth_failed + cookies (though session didn't establish)
    return response;
  }

  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");
  if (tokenHash && (tokenType === "signup" || tokenType === "email")) {
    const response = NextResponse.redirect(new URL(`${origin}/login?error=auth_failed`));

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: tokenType === "signup" ? "signup" : "email",
    });
    if (!error) {
      const successResponse = NextResponse.redirect(new URL(`${origin}/verify-email?status=success`));
      response.cookies.getAll().forEach(({ name, value, ...rest }) => {
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
