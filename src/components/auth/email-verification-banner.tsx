"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface EmailVerificationBannerProps {
  email: string;
}

export function EmailVerificationBanner({ email }: EmailVerificationBannerProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    setSent(false);

    try {
      const supabase = createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?type=email_verification`,
        },
      });

      if (resendError) {
        setError(resendError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError("Failed to resend verification email");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-gold/30 border-b border-gold/50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-forest">⚠</span>
            <p className="font-mono text-[10px] text-forest uppercase tracking-wide">
              Your email is not verified
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {sent ? (
              <p className="font-mono text-[10px] text-forest uppercase tracking-wide">
                ✓ Verification email sent!
              </p>
            ) : error ? (
              <p className="font-mono text-[10px] text-coral uppercase tracking-wide">
                {error}
              </p>
            ) : (
              <button
                onClick={handleResend}
                disabled={loading}
                className="font-mono text-[10px] text-forest uppercase tracking-wide underline hover:no-underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Sending..." : "Resend verification email"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
