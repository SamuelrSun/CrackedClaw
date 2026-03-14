"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(3);
  
  const status = searchParams.get("status");
  const error = searchParams.get("error");
  
  const isSuccess = status === "success";
  const isError = status === "error" || error;

  useEffect(() => {
    if (isSuccess) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push("/login");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isSuccess, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-forest mx-auto mb-4 flex items-center justify-center">
            <span className="text-white font-header text-lg font-bold">OC</span>
          </div>
          <h1 className="font-header text-xl font-bold text-forest mb-2">
            Email Verification
          </h1>
        </div>

        <div className="border border-white/[0.1] bg-white/50 p-6">
          {isSuccess && (
            <>
              <div className="p-4 border border-mint/50 bg-mint/20 mb-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="font-mono text-[11px] text-forest uppercase tracking-wide text-center font-medium">
                  Email verified successfully!
                </p>
              </div>
              <p className="font-mono text-[10px] text-grid/60 uppercase tracking-wide text-center">
                Redirecting to login in {countdown} second{countdown !== 1 ? "s" : ""}...
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full mt-4 px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors"
              >
                Go to Login Now
              </button>
            </>
          )}

          {isError && (
            <>
              <div className="p-4 border border-coral/30 bg-coral/10 mb-4">
                <div className="flex items-center justify-center mb-2">
                  <span className="text-2xl">✗</span>
                </div>
                <p className="font-mono text-[11px] text-coral uppercase tracking-wide text-center font-medium">
                  Verification failed
                </p>
                {error && (
                  <p className="font-mono text-[9px] text-coral/80 text-center mt-2">
                    {decodeURIComponent(error)}
                  </p>
                )}
              </div>
              <p className="font-mono text-[10px] text-grid/60 uppercase tracking-wide text-center mb-4">
                The verification link may have expired or is invalid.
              </p>
              <button
                onClick={() => router.push("/login")}
                className="w-full px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors"
              >
                Back to Login
              </button>
            </>
          )}

          {!isSuccess && !isError && (
            <>
              <div className="p-4 border border-grid/20 bg-grid/5 mb-4">
                <p className="font-mono text-[11px] text-grid uppercase tracking-wide text-center">
                  Verifying your email...
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
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
      <VerifyEmailContent />
    </Suspense>
  );
}
