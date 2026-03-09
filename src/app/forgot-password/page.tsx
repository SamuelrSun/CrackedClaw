"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // JS validation (no browser-native required validation)
    if (!email.trim()) {
      setError("Email address is required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to send reset link");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Could not connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-header text-lg font-bold">CC</span>
          </div>
          <h1 className="font-header text-xl font-bold text-forest mb-2">
            Reset Password
          </h1>
          <p className="font-mono text-[11px] text-grid/60 uppercase tracking-wide">
            Enter your email to receive reset instructions
          </p>
        </div>

        <div className="border border-[rgba(58,58,56,0.2)] bg-white/50 p-6">
          {success ? (
            <div className="text-center">
              <div className="p-3 border border-mint/50 bg-mint/20 mb-4">
                <p className="font-mono text-[10px] text-forest uppercase tracking-wide">
                  ✓ Check your email for reset instructions
                </p>
              </div>
              <p className="font-mono text-[10px] text-grid/60 mb-4">
                If an account exists with this email, you will receive a password reset link shortly.
              </p>
              <Link
                href="/login"
                className="inline-block font-mono text-[10px] text-forest/70 hover:text-forest uppercase tracking-wide transition-colors"
              >
                ← Back to Sign In
              </Link>
            </div>
          ) : (
            <>
              <p className="font-mono text-[10px] text-grid/60 uppercase tracking-wide mb-6 text-center">
                We&apos;ll send you a link to reset your password
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block font-mono text-[10px] text-grid/80 uppercase tracking-wide mb-1.5"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-3 py-2 border bg-white font-mono text-sm text-forest focus:outline-none transition-colors ${error ? "border-coral focus:border-coral" : "border-[rgba(58,58,56,0.2)] focus:border-forest"}`}
                    placeholder="you@example.com"
                    autoComplete="email"
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
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link
                  href="/login"
                  className="font-mono text-[10px] text-forest/70 hover:text-forest uppercase tracking-wide transition-colors"
                >
                  ← Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
