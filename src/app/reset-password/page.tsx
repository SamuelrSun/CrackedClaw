"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validatingToken, setValidatingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);

  // Handle the token from URL when redirected from email
  useEffect(() => {
    const handleTokenFromUrl = async () => {
      // Check for error in URL (e.g., expired link)
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");
      
      if (errorParam) {
        setError(errorDescription || "Invalid or expired reset link");
        setValidatingToken(false);
        return;
      }

      // Supabase handles the token via hash fragment
      // When user clicks email link, Supabase SDK detects and processes it
      const supabase = createClient();
      
      // Check if there's a session (Supabase auto-processes the recovery token)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        setError("Invalid or expired reset link");
        setValidatingToken(false);
        return;
      }

      // For password recovery, Supabase creates a temporary session
      if (session) {
        setTokenValid(true);
      } else {
        // No session means no valid token - user may have navigated directly
        setError("No reset token found. Please request a new password reset link.");
      }
      
      setValidatingToken(false);
    };

    handleTokenFromUrl();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push("/login?reset=success");
      }, 2000);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validatingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-header text-lg font-bold">OC</span>
          </div>
          <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
            Validating reset link...
          </p>
        </div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid && !success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-header text-lg font-bold">OC</span>
            </div>
            <h1 className="font-header text-xl font-bold text-forest mb-2">
              Reset Password
            </h1>
          </div>

          <div className="border border-white/[0.1] bg-white/50 p-6">
            <div className="p-3 border border-coral/30 bg-coral/10 mb-4">
              <p className="font-mono text-[10px] text-coral uppercase tracking-wide">
                {error || "Invalid or expired reset link"}
              </p>
            </div>
            <p className="font-mono text-[10px] text-grid/60 mb-4 text-center">
              Please request a new password reset link.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href="/forgot-password"
                className="w-full px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors text-center"
              >
                Request New Link
              </Link>
              <Link
                href="/login"
                className="w-full px-4 py-2.5 border border-forest/30 text-forest font-mono text-[11px] uppercase tracking-wide hover:bg-forest/5 transition-colors text-center"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-header text-lg font-bold">OC</span>
          </div>
          <h1 className="font-header text-xl font-bold text-forest mb-2">
            Set New Password
          </h1>
          <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
            Enter your new password below
          </p>
        </div>

        <div className="border border-white/[0.1] bg-white/50 p-6">
          {success ? (
            <div className="text-center">
              <div className="p-3 border border-mint/50 bg-mint/20 mb-4">
                <p className="font-mono text-[10px] text-forest uppercase tracking-wide">
                  ✓ Password reset successfully
                </p>
              </div>
              <p className="font-mono text-[10px] text-grid/60">
                Redirecting to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block font-mono text-[10px] text-grid/80 uppercase tracking-wide mb-1.5"
                >
                  New Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-white/[0.1] bg-white font-mono text-sm text-forest focus:outline-none focus:border-forest transition-colors"
                  placeholder="••••••••"
                />
                <p className="font-mono text-[9px] text-grid/50 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block font-mono text-[10px] text-grid/80 uppercase tracking-wide mb-1.5"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-white/[0.1] bg-white font-mono text-sm text-forest focus:outline-none focus:border-forest transition-colors"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="p-2 border border-coral/30 bg-coral/10">
                  <p className="font-mono text-[10px] text-coral uppercase tracking-wide">
                    {error}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Resetting..." : "Reset Password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="w-full max-w-sm text-center">
            <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
              <span className="text-white font-header text-lg font-bold">OC</span>
            </div>
            <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
              Loading...
            </p>
          </div>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
