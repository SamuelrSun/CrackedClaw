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
async function getRedirectPath(): Promise<string> {
  // First check localStorage (fast)
  if (checkOnboardingComplete()) {
    return "/";
  }

  // Then check Supabase profile (authoritative)
  try {
    const res = await fetch("/api/onboarding/complete");
    if (res.ok) {
      const data = await res.json();
      if (data.completed) {
        return "/";
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
  const [isSignUp, setIsSignUp] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
    const redirectPath = checkOnboardingComplete() ? "/" : "/onboarding";
    router.push(redirectPath);
    router.refresh();
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

        const redirectPath = await getRedirectPath();
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
            <span className="text-white font-header text-lg font-bold">OC</span>
          </div>
          <h1 className="font-header text-xl font-bold text-forest mb-2">
            Welcome to OpenClaw
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
          By signing in, you agree to our terms of service
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
              <span className="text-white font-header text-lg font-bold">OC</span>
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
