"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useFormValidation } from "@/hooks/use-form-validation";
import { validateEmail, validatePassword } from "@/lib/validation";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────
// Message sequence
// ─────────────────────────────────────────────────────────

const SEQUENCE = [
  {
    text: "Hey! Welcome to Dopl.",
    pauseAfterMs: 1000,
    showDots: false,
  },
  {
    text: "I'm not your AI companion yet, just the welcome crew. I'm setting them up right now as we speak. Over time, they'll become your confidant, assistant, partner, and so much more. I'm excited for the adventures you'll go on!",
    pauseAfterMs: 5000,
    showDots: true, // show "..." while agent "spins up"
  },
  {
    text: "All set! Your agent is warmed up and waiting for you.\n\nI'm giving you both 100,000 tokens to get to know each other. That's a lot of conversations.\n\nWhen you're ready to meet them, just sign in below. See you on the other side!",
    pauseAfterMs: 1200,
    showDots: false,
  },
];

const CHAR_INTERVAL_MS = 55; // slower typing (~18 chars/sec)

// ─────────────────────────────────────────────────────────
// Opacity per position-from-bottom
// ─────────────────────────────────────────────────────────

function getBubbleOpacity(posFromBottom: number): number {
  if (posFromBottom === 0) return 1.0;
  if (posFromBottom === 1) return 0.5;
  if (posFromBottom === 2) return 0.22;
  return 0.07;
}

// ─────────────────────────────────────────────────────────
// Error helper
// ─────────────────────────────────────────────────────────

function getErrorMessage(error: { message: string }): string {
  const msg = error.message.toLowerCase();
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch"))
    return "Could not connect to authentication server";
  if (msg.includes("invalid login credentials") || msg.includes("invalid credentials"))
    return "Invalid email or password";
  if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already"))
    return "An account with this email already exists";
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("short") || msg.includes("least")))
    return "Password must be at least 6 characters";
  if (msg.includes("email not confirmed") || msg.includes("not confirmed"))
    return "Please verify your email before signing in";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts. Please wait a moment and try again";
  if (msg.includes("invalid email") || msg.includes("email format"))
    return "Please enter a valid email address";
  return error.message;
}

// ─────────────────────────────────────────────────────────
// Icons
// ─────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9086c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9086-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5832-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573A8.9961 8.9961 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05" />
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function Spinner() {
  return (
    <div
      style={{
        width: 56,
        height: 56,
        border: "3px solid rgba(255,255,255,0.15)",
        borderTop: "3px solid rgba(255,255,255,0.8)",
        borderRadius: "50%",
        animation: "spin 0.9s linear infinite",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────
// Auth Form (sign-in bubble)
// ─────────────────────────────────────────────────────────

interface AuthFormProps {
  onAuthSuccess: () => void;
}

function AuthForm({ onAuthSuccess }: AuthFormProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [supabaseConfigured] = useState(() => isSupabaseConfigured());

  const form = useFormValidation({
    fields: {
      email: validateEmail,
      password: validatePassword,
    },
    onSubmit: handleAuth,
  });

  const handleOAuth = useCallback(
    async (provider: "google" | "github") => {
      if (!supabaseConfigured) {
        setServerError("Supabase not configured.");
        return;
      }
      setOauthLoading(provider);
      setServerError(null);
      const supabase = createClient();

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) {
        setServerError(error ? getErrorMessage(error) : "Could not start authentication");
        setOauthLoading(null);
        return;
      }

      const width = 500;
      const height = 650;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      const popup = window.open(
        data.url,
        `${provider}_oauth`,
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
      );

      if (!popup) {
        window.location.href = data.url;
        return;
      }

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "oauth-complete") {
          window.removeEventListener("message", handleMessage);
          clearInterval(pollInterval);
          onAuthSuccess();
        }
      };
      window.addEventListener("message", handleMessage);

      const pollInterval = setInterval(async () => {
        if (popup.closed) {
          clearInterval(pollInterval);
          window.removeEventListener("message", handleMessage);
          const { data: sessionData } = await supabase.auth.getSession();
          if (sessionData.session) {
            onAuthSuccess();
          } else {
            setOauthLoading(null);
          }
        }
      }, 500);
    },
    [supabaseConfigured, onAuthSuccess]
  );

  async function handleAuth(values: { email: string; password: string }) {
    setServerError(null);
    setSuccess(null);
    setLoading(true);

    if (!supabaseConfigured) {
      setServerError("Supabase not configured.");
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

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setServerError("An account with this email already exists");
          setLoading(false);
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (signInError) {
          if (
            signInError.message.toLowerCase().includes("email not confirmed") ||
            signInError.message.toLowerCase().includes("invalid login credentials")
          ) {
            setSuccess("Check your email to verify your account");
            form.reset();
            setLoading(false);
            return;
          }
          setServerError(getErrorMessage(signInError));
          setLoading(false);
          return;
        }

        onAuthSuccess();
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });

        if (signInError) {
          if (signInError.message.toLowerCase().includes("email not confirmed")) {
            setServerError(
              "Please verify your email before signing in. Check your inbox for the verification link."
            );
            setLoading(false);
            return;
          }
          setServerError(getErrorMessage(signInError));
          setLoading(false);
          return;
        }

        onAuthSuccess();
      }
    } catch {
      setServerError("Could not connect to authentication server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* OAuth buttons */}
      <button
        type="button"
        onClick={() => handleOAuth("google")}
        disabled={!!oauthLoading || loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 transition-all disabled:opacity-50"
        style={{
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(255,255,255,0.09)",
          borderRadius: 10,
          fontFamily: "Verdana, sans-serif",
          fontSize: 15,
          color: "white",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!oauthLoading && !loading) e.currentTarget.style.background = "rgba(255,255,255,0.18)";
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
      >
        <GoogleIcon />
        <span>{oauthLoading === "google" ? "Redirecting..." : isSignUp ? "Sign up with Google" : "Sign in with Google"}</span>
      </button>

      <button
        type="button"
        onClick={() => handleOAuth("github")}
        disabled={!!oauthLoading || loading}
        className="w-full flex items-center justify-center gap-3 px-4 py-3 transition-all disabled:opacity-50"
        style={{
          border: "1px solid rgba(255,255,255,0.22)",
          background: "rgba(255,255,255,0.09)",
          borderRadius: 10,
          fontFamily: "Verdana, sans-serif",
          fontSize: 15,
          color: "white",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!oauthLoading && !loading) e.currentTarget.style.background = "rgba(255,255,255,0.18)";
        }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.09)"; }}
      >
        <GitHubIcon />
        <span>{oauthLoading === "github" ? "Redirecting..." : isSignUp ? "Sign up with GitHub" : "Sign in with GitHub"}</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 py-1">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.18)" }} />
        <span style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)" }}>or</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.18)" }} />
      </div>

      {/* Server error */}
      {serverError && (
        <div className="mb-1">
          <FormErrorSummary errors={[serverError]} onScrollToFirst={form.scrollToFirstError} />
        </div>
      )}

      {/* Success */}
      {success && (
        <div
          className="p-3"
          style={{
            border: "1px solid rgba(100,220,150,0.5)",
            background: "rgba(100,220,150,0.15)",
            borderRadius: 8,
          }}
        >
          <p style={{ fontFamily: "Verdana, sans-serif", fontSize: 13, color: "rgb(134,239,172)", margin: 0 }}>
            ✓ {success}
          </p>
        </div>
      )}

      {/* Email / password form */}
      <form onSubmit={form.handleSubmit} className="space-y-3">
        <Input
          id="welcome-email"
          type="email"
          label="Email"
          value={form.values.email}
          onChange={form.handleChange("email")}
          onBlur={form.handleBlur("email")}
          error={form.errors.email}
          touched={form.touched.email}
          disabled={loading}
          className="login-glass bg-white/10 border-white/20 text-white placeholder:text-transparent focus:border-white/40"
        />
        <div>
          <Input
            id="welcome-password"
            type="password"
            label="Password"
            value={form.values.password}
            onChange={form.handleChange("password")}
            onBlur={form.handleBlur("password")}
            error={form.errors.password}
            touched={form.touched.password}
            disabled={loading}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="login-glass bg-white/10 border-white/20 text-white placeholder:text-transparent focus:border-white/40"
          />
          {!isSignUp && (
            <div className="mt-1.5 text-right">
              <a
                href="/forgot-password"
                style={{ fontFamily: "Verdana, sans-serif", fontSize: 11, color: "rgba(255,255,255,0.45)" }}
              >
                Forgot password?
              </a>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || form.isSubmitting}
          className="w-full px-4 py-3 text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "#18181B",
            borderRadius: 10,
            fontFamily: "Verdana, sans-serif",
            fontSize: 15,
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading && !form.isSubmitting) e.currentTarget.style.background = "#333";
          }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#18181B"; }}
        >
          {loading || form.isSubmitting ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <div className="text-right">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setServerError(null);
              setSuccess(null);
              form.reset();
            }}
            style={{ fontFamily: "Verdana, sans-serif", fontSize: 12, color: "rgba(255,255,255,0.45)", cursor: "pointer" }}
          >
            {isSignUp ? "Already have an account? Sign in" : "Or sign up"}
          </button>
        </div>
      </form>

      <p
        style={{
          fontFamily: "Verdana, sans-serif",
          fontSize: 11,
          color: "rgba(255,255,255,0.28)",
          textAlign: "center",
          marginTop: 8,
        }}
      >
        <a href="/terms" className="underline hover:text-white transition-colors">Terms</a>
        <span style={{ margin: "0 8px" }}>·</span>
        <a href="/privacy" className="underline hover:text-white transition-colors">Privacy</a>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Message Bubble — no outer glass panel, just bubble
// ─────────────────────────────────────────────────────────

function Bubble({
  children,
  opacity,
}: {
  children: React.ReactNode;
  opacity: number;
}) {
  return (
    <div
      style={{
        opacity,
        transition: "opacity 1.2s ease",
        background: "rgba(15,15,22,0.72)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 18,
        padding: "20px 26px",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Pulsing dots bubble
// ─────────────────────────────────────────────────────────

function DotsBubble({ opacity }: { opacity: number }) {
  return (
    <Bubble opacity={opacity}>
      <div className="flex items-center gap-2" style={{ height: 22 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.65)",
              animation: `pulseDots 1.4s ease-in-out ${i * 0.24}s infinite`,
            }}
          />
        ))}
      </div>
    </Bubble>
  );
}

// ─────────────────────────────────────────────────────────
// Text content inside bubbles
// ─────────────────────────────────────────────────────────

function BubbleText({ text, showCursor }: { text: string; showCursor?: boolean }) {
  return (
    <p
      style={{
        fontFamily: "Verdana, sans-serif",
        fontSize: 17,
        color: "rgba(255,255,255,0.92)",
        lineHeight: 1.75,
        whiteSpace: "pre-wrap",
        margin: 0,
      }}
    >
      {text}
      {showCursor && (
        <span
          style={{
            display: "inline-block",
            width: 2,
            height: "1.1em",
            background: "rgba(255,255,255,0.75)",
            verticalAlign: "text-bottom",
            marginLeft: 2,
            animation: "blink 1s step-end infinite",
          }}
        />
      )}
    </p>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

type AppPhase = "typing" | "auth" | "provisioning" | "done";

export function WelcomeContent() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  // Completed messages (fully typed, pushed to history)
  const [completedMsgs, setCompletedMsgs] = useState<string[]>([]);
  // Index into SEQUENCE (0–2 = text msgs, 3 = auth)
  const [seqIndex, setSeqIndex] = useState(0);
  // Currently typed text (active message)
  const [currentText, setCurrentText] = useState("");
  // Show waiting dots (during long pause between msg2 and msg3)
  const [showDots, setShowDots] = useState(false);
  // Show auth bubble
  const [showAuth, setShowAuth] = useState(false);

  // Post-auth state
  const [phase, setPhase] = useState<AppPhase>("typing");
  const [chatOpacity, setChatOpacity] = useState(1);
  const [showPanels, setShowPanels] = useState(false);
  const [panelsAnimating, setPanelsAnimating] = useState(false);

  // ── Auto-scroll to bottom while typing ──
  useEffect(() => {
    if (!autoScrollRef.current) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [currentText, completedMsgs, showDots, showAuth]);

  // ── Main typing sequencer ──
  useEffect(() => {
    if (seqIndex >= SEQUENCE.length) {
      // All text done → show auth after short pause
      const id = setTimeout(() => {
        setShowAuth(true);
        setPhase("auth");
        // Let one final scroll happen, then let user scroll freely
        setTimeout(() => { autoScrollRef.current = false; }, 600);
      }, 600);
      return () => clearTimeout(id);
    }

    const { text, pauseAfterMs, showDots: wantDots } = SEQUENCE[seqIndex];
    let charIndex = 0;
    setCurrentText("");
    setShowDots(false);

    let pauseTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const intervalId = setInterval(() => {
      charIndex++;
      setCurrentText(text.slice(0, charIndex));

      if (charIndex >= text.length) {
        clearInterval(intervalId);

        // Show waiting dots if requested (e.g., between msg2 and msg3)
        if (wantDots) setShowDots(true);

        pauseTimeoutId = setTimeout(() => {
          setShowDots(false);
          setCompletedMsgs((prev) => [...prev, text]);
          setCurrentText("");
          setSeqIndex((prev) => prev + 1);
        }, pauseAfterMs);
      }
    }, CHAR_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (pauseTimeoutId) clearTimeout(pauseTimeoutId);
    };
  }, [seqIndex]);

  // ── Auth success → provision → redirect ──
  const handleAuthSuccess = useCallback(() => {
    setPhase("provisioning");
    setChatOpacity(0);

    (async () => {
      try {
        await fetch("/api/organizations/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {
        // proceed anyway
      }

      setShowPanels(true);
      setPhase("done");

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPanelsAnimating(true);
        });
      });

      setTimeout(() => {
        router.push("/chat");
      }, 2900);
    })();
  }, [router]);

  const isPostAuth = phase === "provisioning" || phase === "done";

  // ── Calculate how many "slots" are below each completed message ──
  // (determines opacity: more below = more faded = pushed higher up)
  const slotsBelow = (i: number) =>
    (completedMsgs.length - 1 - i) +
    (currentText ? 1 : 0) +
    (showDots ? 1 : 0) +
    (showAuth ? 1 : 0);

  return (
    <div className="fixed inset-0" style={{ backgroundColor: "#0a0a0f", overflow: "hidden" }}>
      {/* ── Full-screen background ── */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="absolute inset-0 z-0" style={{ background: "rgba(0,0,0,0.38)" }} />

      {/* ── Dopl title (fixed top) ── */}
      <div
        className="absolute top-8 left-1/2 -translate-x-1/2 z-20 text-center pointer-events-none"
        style={{ animation: "loginFadeIn 0.6s ease-out both" }}
      >
        <h1
          style={{
            fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 20,
            color: "#18181B",
            marginBottom: 4,
          }}
        >
          Dopl
        </h1>
        <p
          style={{
            fontFamily: "Verdana, sans-serif",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "#18181B",
            margin: 0,
          }}
        >
          The AI Personal Companion
        </p>
      </div>

      {/* ── Scrollable messages area (no visible scrollbar) ── */}
      <div
        ref={scrollRef}
        className="welcome-scroll absolute inset-0 z-10"
        style={{
          overflowY: "scroll",
          opacity: chatOpacity,
          transition: "opacity 0.5s ease",
          pointerEvents: isPostAuth ? "none" : "auto",
        }}
      >
        {/*
          min-h-full + flex + justify-end pushes all content to the bottom.
          As the active bubble grows downward, previous bubbles are pushed upward.
        */}
        <div
          className="min-h-full flex flex-col justify-end"
          style={{ maxWidth: 520, margin: "0 auto", padding: "120px 24px 80px" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Completed (history) messages — fade based on distance from bottom */}
            {completedMsgs.map((msg, i) => (
              <Bubble key={i} opacity={getBubbleOpacity(slotsBelow(i))}>
                <BubbleText text={msg} />
              </Bubble>
            ))}

            {/* Waiting dots (during long pause — "setting up your agent...") */}
            {showDots && <DotsBubble opacity={1} />}

            {/* Currently typing message */}
            {currentText && (
              <Bubble opacity={1}>
                <BubbleText text={currentText} showCursor />
              </Bubble>
            )}

            {/* Auth bubble — sign-in buttons as their own message */}
            {showAuth && (
              <Bubble opacity={1}>
                <AuthForm onAuthSuccess={handleAuthSuccess} />
              </Bubble>
            )}

          </div>
        </div>
      </div>

      {/* ── Post-auth: spinner ── */}
      {isPostAuth && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center"
          style={{ animation: "loginFadeIn 0.4s ease-out both" }}
        >
          <Spinner />
        </div>
      )}

      {/* ── Post-auth: reveal panels ── */}
      {showPanels && (
        <div className="fixed inset-0 z-30 flex">
          <div
            style={{
              width: 288,
              flexShrink: 0,
              background: "#0a0a0f",
              transform: panelsAnimating ? "translateY(-100%)" : "translateY(0)",
              transition: panelsAnimating
                ? "transform 2s cubic-bezier(0.76,0,0.24,1) 0s"
                : "none",
            }}
          />
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: "#0a0a0f",
                transform: panelsAnimating ? "translateY(-100%)" : "translateY(0)",
                transition: panelsAnimating
                  ? `transform 2s cubic-bezier(0.76,0,0.24,1) ${i * 0.2}s`
                  : "none",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
