"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useFormValidation } from "@/hooks/use-form-validation";
import { validateEmail, validatePassword } from "@/lib/validation";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";

// Demo user for testing without Supabase
const DEMO_USER = {
  id: "demo-user-id",
  email: "demo@openclaw.cloud",
  name: "Demo User",
};

// Onboarding storage key
const ONBOARDING_STORAGE_KEY = "openclaw_onboarding_state";

/**
 * Check if onboarding is complete (client-side)
 */
function checkOnboardingComplete(): boolean {
  try {
    const stored = localStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      return data.completedAt !== null;
    }
  } catch {
    // Ignore
  }
  return false;
}

/**
 * Parse Supabase error messages into user-friendly text
 */
function getErrorMessage(error: { message: string }): string {
  const msg = error.message.toLowerCase();
  
  // Network errors
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch")) {
    return "Could not connect to authentication server";
  }
  
  // Invalid credentials
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
    return "Invalid email or password";
  }
  
  // Email already exists
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already")) {
    return "An account with this email already exists";
  }
  
  // Weak password
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("short") || msg.includes("least"))) {
    return "Password must be at least 6 characters";
  }
  
  // Email not confirmed
  if (msg.includes("email not confirmed") || msg.includes("not confirmed")) {
    return "Please verify your email before signing in";
  }
  
  // Rate limiting
  if (msg.includes("rate limit") || msg.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again";
  }
  
  // Invalid email format
  if (msg.includes("invalid email") || msg.includes("email format")) {
    return "Please enter a valid email address";
  }
  
  // Default: return original message
  return error.message;
}

/**
 * Determine redirect path after successful auth
 */
async function getRedirectPath(nextUrl?: string | null): Promise<string> {
  // If a ?next= param is present, redirect there after login
  if (nextUrl && nextUrl.startsWith("/")) {
    return nextUrl;
  }

  // First check localStorage (fast)
  if (checkOnboardingComplete()) {
    return "/chat";
  }

  // Then check Supabase profile (authoritative)
  try {
    const res = await fetch("/api/onboarding/complete");
    if (res.ok) {
      const data = await res.json();
      if (data.completed) {
        return "/chat";
      }
    }
  } catch {
    // Ignore - use localStorage result
  }

  // Not completed - go to onboarding
  return "/onboarding";
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [supabaseConfigured, setSupabaseConfigured] = useState(true);

  const form = useFormValidation({
    fields: {
      email: validateEmail,
      password: validatePassword,
    },
    onSubmit: handleAuth,
  });

  // Check for URL params on mount
  useEffect(() => {
    setSupabaseConfigured(isSupabaseConfigured());
    
    // Check for error params from auth callback
    const errorParam = searchParams.get("error");
    if (errorParam === "auth_failed") {
      setServerError("Authentication failed. Please try again.");
    }
    
    // Check for password reset success
    const resetParam = searchParams.get("reset");
    if (resetParam === "success") {
      setSuccess("Password reset successfully. Please sign in with your new password.");
    }
  }, [searchParams]);

  const handleDemoMode = async () => {
    // Store demo user in localStorage
    localStorage.setItem("demo_user", JSON.stringify(DEMO_USER));
    localStorage.setItem("demo_mode", "true");
    
    // Check if onboarding completed
    const redirectPath = checkOnboardingComplete() ? "/chat" : "/onboarding";
    router.push(redirectPath);
    router.refresh();
  };

  const handleOAuth = async (provider: "google" | "github") => {
    if (!supabaseConfigured) {
      setServerError("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
      return;
    }
    setOauthLoading(provider);
    setServerError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setServerError(getErrorMessage(error));
      setOauthLoading(null);
    }
  };

  async function handleAuth(values: { email: string; password: string }) {
    setServerError(null);
    setSuccess(null);
    setLoading(true);

    // Check if Supabase is configured
    if (!supabaseConfigured) {
      setServerError("Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
      setLoading(false);
      return;
    }

    const supabase = createClient();

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?type=email_verification`,
          },
        });

        if (signUpError) {
          setServerError(getErrorMessage(signUpError));
          setLoading(false);
          return;
        }

        // Check if email confirmation is required
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setServerError("An account with this email already exists");
          setLoading(false);
          return;
        }

        // Try to sign in immediately (works if email confirmation is disabled)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes("email not confirmed") ||
              signInError.message.toLowerCase().includes("invalid login credentials")) {
            setSuccess("Check your email to verify your account");
            form.reset();
            setServerError(null);
            setLoading(false);
            return;
          }
          setServerError(getErrorMessage(signInError));
          setLoading(false);
          return;
        }

        router.push("/onboarding");
        router.refresh();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes("email not confirmed")) {
            setServerError("Please verify your email before signing in. Check your inbox for the verification link.");
            setLoading(false);
            return;
          }
          setServerError(getErrorMessage(signInError));
          setLoading(false);
          return;
        }

        const nextUrl = searchParams.get("next");
        const redirectPath = await getRedirectPath(nextUrl);
        router.push(redirectPath);
        router.refresh();
      }
    } catch {
      setServerError("Could not connect to authentication server");
    } finally {
      setLoading(false);
    }
  }

  // Combine form errors with server error for display
  const allErrors = [...form.formErrors];
  if (serverError) {
    allErrors.push(serverError);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-header text-lg font-bold">CC</span>
          </div>
          <h1 className="font-header text-xl font-bold text-forest mb-2">
            Welcome to CrackedClaw
          </h1>
          <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
            AI Agent Management Dashboard
          </p>
        </div>

        {/* Supabase not configured warning */}
        {!supabaseConfigured && (
          <div className="mb-4 p-3 border border-coral/30 bg-coral/10">
            <p className="font-mono text-[10px] text-coral uppercase tracking-wide mb-2">
              ⚠ Supabase Not Configured
            </p>
            <p className="font-mono text-[9px] text-grid/70 leading-relaxed">
              Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local to enable authentication.
            </p>
          </div>
        )}

        <div className="border border-[rgba(58,58,56,0.2)] bg-white/50 p-6">
          <p className="font-mono text-[10px] text-grid/60 uppercase tracking-wide mb-6 text-center">
            {isSignUp ? "Create your account" : "Sign in to continue"}
          </p>

          {/* OAuth buttons */}
          <div className="space-y-2 mb-4">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.2)] bg-white hover:bg-paper transition-colors disabled:opacity-50"
            >
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9086c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9086-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5832-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573A8.9961 8.9961 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
                <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
              </svg>
              <span className="font-mono text-[11px] text-forest">
                {oauthLoading === "google" ? "Redirecting..." : (isSignUp ? "Sign up with Google" : "Sign in with Google")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("github")}
              disabled={!!oauthLoading || loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.2)] bg-white hover:bg-paper transition-colors disabled:opacity-50"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" className="text-forest">
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="font-mono text-[11px] text-forest">
                {oauthLoading === "github" ? "Redirecting..." : (isSignUp ? "Sign up with GitHub" : "Sign in with GitHub")}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-[rgba(58,58,56,0.15)]" />
            <span className="font-mono text-[10px] text-grid/50 uppercase tracking-wide">or</span>
            <div className="flex-1 h-px bg-[rgba(58,58,56,0.15)]" />
          </div>

          {/* Error summary - only show server errors at top, not validation errors */}
          {serverError && (
            <div className="mb-4">
              <FormErrorSummary 
                errors={[serverError]} 
                onScrollToFirst={form.scrollToFirstError}
              />
            </div>
          )}

          {/* Success message - mint color */}
          {success && (
            <div className="mb-4 p-3 border border-mint/50 bg-mint/20">
              <p className="font-mono text-[11px] text-forest uppercase tracking-wide font-medium mb-1">
                ✓ Account created!
              </p>
              <p className="font-mono text-[10px] text-forest/80">
                {success}
              </p>
            </div>
          )}

          <form onSubmit={form.handleSubmit} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="Email"
              value={form.values.email}
              onChange={form.handleChange("email")}
              onBlur={form.handleBlur("email")}
              error={form.errors.email}
              touched={form.touched.email}
              placeholder="you@example.com"
              disabled={loading}
            />

            <div>
              <Input
                id="password"
                type="password"
                label="Password"
                value={form.values.password}
                onChange={form.handleChange("password")}
                onBlur={form.handleBlur("password")}
                error={form.errors.password}
                touched={form.touched.password}
                placeholder="••••••••"
                disabled={loading}
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
              {!isSignUp && (
                <div className="mt-1.5 text-right">
                  <a
                    href="/forgot-password"
                    className="font-mono text-[9px] text-forest/60 hover:text-forest uppercase tracking-wide transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || form.isSubmitting}
              className="w-full px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading || form.isSubmitting ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setServerError(null);
                setSuccess(null);
                form.reset();
              }}
              className="font-mono text-[10px] text-forest/70 hover:text-forest uppercase tracking-wide transition-colors"
            >
              {isSignUp
                ? "Already have an account? Sign in →"
                : "← Back to sign up"}
            </button>
          </div>

          {/* Demo Mode - only show if Supabase is not configured */}
          {!supabaseConfigured && (
            <div className="mt-6 pt-4 border-t border-[rgba(58,58,56,0.1)]">
              <p className="font-mono text-[9px] text-grid/50 uppercase tracking-wide text-center mb-3">
                Or try without authentication
              </p>
              <button
                type="button"
                onClick={handleDemoMode}
                className="w-full px-4 py-2.5 border border-forest/30 text-forest font-mono text-[11px] uppercase tracking-wide hover:bg-forest/5 transition-colors"
              >
                Enter Demo Mode
              </button>
            </div>
          )}
        </div>

        <p className="font-mono text-[9px] text-grid/40 text-center mt-6 uppercase tracking-wide">
          By signing in, you agree to our <a href="/terms" className="underline hover:text-forest transition-colors">terms of service</a>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center">
            <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-header text-lg font-bold">CC</span>
            </div>
            <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
              Loading...
            </p>
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
