"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useFormValidation } from "@/hooks/use-form-validation";
import { validateEmail, validatePassword } from "@/lib/validation";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────
// Message sequence (post-auth, centered on screen)
// Messages before "waiting" play immediately.
// "waiting" = animated dots, holds until provisioning completes.
// Messages after "waiting" play once provisioning is done.
// ─────────────────────────────────────────────────────────

type MsgEntry =
  | { kind: "text"; text: string; pauseAfterMs: number }
  | { kind: "waiting" }; // animated dots — waits for provisioning

const MESSAGES: MsgEntry[] = [
  { kind: "text", text: "Hey! Welcome to Dopl.", pauseAfterMs: 1200 },
  { kind: "text", text: "I'm not your intelligent companion yet, just the welcome (and setup!) crew.", pauseAfterMs: 1200 },
  { kind: "text", text: "I'm getting them set up for you as we speak.", pauseAfterMs: 1200 },
  { kind: "text", text: "Over time, they'll become your confidant, assistant, partner, and so much more.", pauseAfterMs: 1500 },
  { kind: "text", text: "Who knows what adventures you'll go on!", pauseAfterMs: 1500 },
  { kind: "waiting" }, // "Give me just a moment more..." with animated dots — holds here until provisioning finishes
  { kind: "text", text: "All set! Your companion is warmed up and waiting for you.", pauseAfterMs: 1500 },
  { kind: "text", text: "I'm giving you both an allowance to get to know each other.", pauseAfterMs: 1200 },
  { kind: "text", text: "Farewell!", pauseAfterMs: 1500 },
];

const CHAR_INTERVAL_MS = 30;
const FADE_OUT_DURATION_MS = 800;

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

// ─────────────────────────────────────────────────────────
// Auth Form — glass panel style
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
        let closed = false;
        try {
          closed = !!popup.closed;
        } catch {
          // COOP policy blocks window.closed — fall back to assuming still open
          return;
        }
        if (closed) {
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
    <>
      {/* OAuth buttons */}
      <div className="space-y-2 mb-4">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={!!oauthLoading || loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-white/20 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          <GoogleIcon />
          <span className="font-mono text-[11px] text-white">
            {oauthLoading === "google" ? "Redirecting..." : (isSignUp ? "Sign up with Google" : "Sign in with Google")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("github")}
          disabled={!!oauthLoading || loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-white/20 bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
        >
          <GitHubIcon />
          <span className="font-mono text-[11px] text-white">
            {oauthLoading === "github" ? "Redirecting..." : (isSignUp ? "Sign up with GitHub" : "Sign in with GitHub")}
          </span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-white/20" />
        <span className="font-mono text-[10px] text-white/50 uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-white/20" />
      </div>

      {/* Server error */}
      {serverError && (
        <div className="mb-4">
          <FormErrorSummary errors={[serverError]} onScrollToFirst={form.scrollToFirstError} />
        </div>
      )}

      {/* Success */}
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

      {/* Email / password form */}
      <form onSubmit={form.handleSubmit} className="space-y-4">
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
                className="font-mono text-[9px] text-white/50 hover:text-white uppercase tracking-wide transition-colors"
              >
                Forgot password?
              </a>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || form.isSubmitting}
          className="w-full px-4 py-2.5 bg-[#18181B] text-white font-mono text-[11px] uppercase tracking-wide hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ borderRadius: 50 }}
        >
          {loading || form.isSubmitting ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>
      </form>

      <div className="mt-1.5 text-center">
        <button
          type="button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setServerError(null);
            setSuccess(null);
            form.reset();
          }}
          className="font-mono text-[9px] text-white/50 hover:text-white uppercase tracking-wide transition-colors"
        >
          {isSignUp
            ? "Already have an account? Sign in →"
            : "Or sign up"}
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

// Phases:
//   "login"     → glass panel visible, waiting for auth
//   "panelOut"  → panel sliding/fading out, provisioning started
//   "messaging" → centered typed messages playing
//   "done"      → panels sliding up, redirect to /chat

type AppPhase = "login" | "panelOut" | "messaging" | "done";

export function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBrainIntent = searchParams.get('intent') === 'brain';

  const [phase, setPhase] = useState<AppPhase>("login");

  // Messaging state
  const [msgIndex, setMsgIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState("");
  const [msgOpacity, setMsgOpacity] = useState(1);
  const [showWaiting, setShowWaiting] = useState(false); // "Give me just a moment..." with animated dots

  // Post-messaging cover panels (phase 1: slide up from below to cover screen)
  const [showPanels, setShowPanels] = useState(false);
  const [panelsCovering, setPanelsCovering] = useState(false);
  const [showDoplText, setShowDoplText] = useState(false);

  // Refs to coordinate provisioning + messaging completion
  const provisionDoneRef = useRef(false);
  const completionFiredRef = useRef(false);
  const firstConvoIdRef = useRef<string | null>(null);

  // ── Trigger the final panels cover + redirect ──
  const triggerCompletion = useCallback(() => {
    if (completionFiredRef.current) return;
    completionFiredRef.current = true;

    // Prefetch the chat route so it's ready
    router.prefetch('/chat');

    // Phase 1: show panels off-screen below, then animate them up to cover
    setShowPanels(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setPanelsCovering(true);
      });
    });

    // Show "Dopl" text after panels finish covering (~1.8s for last panel)
    setTimeout(() => {
      setShowDoplText(true);
    }, 2000);

    // Navigate to chat while panels are still covering (chat page renders underneath)
    // The chat page will handle the reveal animation via ?intro=1
    setTimeout(() => {
      const convoId = firstConvoIdRef.current;
      if (convoId) {
        router.push(`/chat?c=${convoId}&intro=1`);
      } else {
        router.push('/chat?intro=1');
      }
    }, 3500);
  }, [router]);

  // ── Auth success handler (popup flow) ──
  const handleAuthSuccess = useCallback(() => {
    // Brain-only signup: skip provisioning + onboarding, go straight to /brain
    if (isBrainIntent) {
      router.push('/brain');
      return;
    }

    // Start provisioning immediately in the background
    (async () => {
      try {
        const res = await fetch("/api/organizations/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.first_conversation_id) {
            firstConvoIdRef.current = data.first_conversation_id;
          }
        }
      } catch {
        // proceed anyway
      }
      provisionDoneRef.current = true;
    })();

    // Animate panel out, then switch to messaging phase
    setPhase("panelOut");
    setTimeout(() => {
      setPhase("messaging");
    }, 600);
  }, [isBrainIntent, router]);

  // ── When provisioning finishes and we're on the waiting step, advance past it ──
  useEffect(() => {
    if (!showWaiting || !provisionDoneRef.current) return;
    // Provisioning already done — fade out the waiting message and advance
    const fadeDelay = setTimeout(() => {
      setMsgOpacity(0);
      const advanceDelay = setTimeout(() => {
        setShowWaiting(false);
        setMsgIndex((prev) => prev + 1);
      }, FADE_OUT_DURATION_MS);
      return () => clearTimeout(advanceDelay);
    }, 500); // brief pause so user sees it resolved
    return () => clearTimeout(fadeDelay);
  }, [showWaiting]);

  // ── Poll for provisioning completion while waiting ──
  useEffect(() => {
    if (!showWaiting) return;
    if (provisionDoneRef.current) {
      // Already done, trigger advance
      setMsgOpacity(0);
      const t = setTimeout(() => {
        setShowWaiting(false);
        setMsgIndex((prev) => prev + 1);
      }, FADE_OUT_DURATION_MS + 500);
      return () => clearTimeout(t);
    }
    const interval = setInterval(() => {
      if (provisionDoneRef.current) {
        clearInterval(interval);
        // Brief pause, then fade + advance
        setTimeout(() => {
          setMsgOpacity(0);
          setTimeout(() => {
            setShowWaiting(false);
            setMsgIndex((prev) => prev + 1);
          }, FADE_OUT_DURATION_MS);
        }, 500);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [showWaiting]);

  // ── Message sequencer (runs during "messaging" phase) ──
  useEffect(() => {
    if (phase !== "messaging") return;

    if (msgIndex >= MESSAGES.length) {
      // All messages done → trigger final transition
      triggerCompletion();
      return;
    }

    const msg = MESSAGES[msgIndex];

    // Handle "waiting" step — show animated dots until provisioning finishes
    if (msg.kind === "waiting") {
      setDisplayedText("");
      setMsgOpacity(1);
      setShowWaiting(true);
      return; // waiting effect handles advancing
    }

    // Normal text message
    const { text, pauseAfterMs } = msg;
    const isLast = msgIndex === MESSAGES.length - 1;

    let charIndex = 0;
    setDisplayedText("");
    setMsgOpacity(1);
    setShowWaiting(false);

    let pauseTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let fadeTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const intervalId = setInterval(() => {
      charIndex++;
      setDisplayedText(text.slice(0, charIndex));

      if (charIndex >= text.length) {
        clearInterval(intervalId);

        pauseTimeoutId = setTimeout(() => {
          if (isLast) {
            // Last message: stay visible briefly, then trigger completion
            triggerCompletion();
          } else {
            // Fade out, then advance to next message
            setMsgOpacity(0);
            fadeTimeoutId = setTimeout(() => {
              setMsgIndex((prev) => prev + 1);
            }, FADE_OUT_DURATION_MS);
          }
        }, pauseAfterMs);
      }
    }, CHAR_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
      if (pauseTimeoutId) clearTimeout(pauseTimeoutId);
      if (fadeTimeoutId) clearTimeout(fadeTimeoutId);
    };
  }, [phase, msgIndex, triggerCompletion]);

  // ── Derived: whether the login panel should be rendered ──
  const showLoginPanel = phase === "login" || phase === "panelOut";

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


      {/* ── Login section (title + glass panel, exact clone of old /login page) ── */}
      {showLoginPanel && (
        <div
          className="min-h-screen flex flex-col items-center justify-center px-6 relative z-10"
          style={{
            opacity: phase === "panelOut" ? 0 : 1,
            transform: phase === "panelOut" ? "translateY(-30px)" : "translateY(0)",
            transition: phase === "panelOut" ? "opacity 0.5s ease, transform 0.5s ease" : undefined,
          }}
        >
          <div className="text-center mb-6 relative z-10"
               style={{ animation: "loginFadeIn 0.6s ease-out both" }}
          >
            <h1
              className="text-xl font-bold mb-2"
              style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic", color: "#18181B" }}
            >
              Dopl
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-wide" style={{ color: "#18181B" }}>
              The AI Personal Companion
            </p>
          </div>

          <div
            className="w-full max-w-sm relative z-10 p-6"
            style={{
              animation: "loginFadeIn 0.6s ease-out both",
              animationDelay: "0.1s",
              background: "rgba(255,255,255,0.05)",
              backdropFilter: "blur(40px) saturate(120%)",
              WebkitBackdropFilter: "blur(40px) saturate(120%)",
              border: "1px solid rgba(255,255,255,0.25)",
            }}
          >
            <AuthForm onAuthSuccess={handleAuthSuccess} />
          </div>

          <p className="w-full max-w-sm relative z-10 font-mono text-[9px] text-white/40 text-center mt-4 uppercase tracking-wide"
             style={{ animation: "loginFadeIn 0.6s ease-out both", animationDelay: "0.3s" }}
          >
            <a href="/terms" className="underline hover:text-white transition-colors">Terms of Service</a>
            <span style={{ margin: "0 4px" }}>·</span>
            <a href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</a>
          </p>
        </div>
      )}

      {/* ── Centered welcome messages (post-auth) ── */}
      {phase === "messaging" && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ padding: "0 24px", pointerEvents: "none" }}
        >
          <div
            style={{
              maxWidth: 520,
              width: "100%",
              opacity: msgOpacity,
              transition: `opacity ${FADE_OUT_DURATION_MS}ms ease`,
            }}
          >
            {showWaiting ? (
              <p
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 15,
                  color: "rgba(255,255,255,0.92)",
                  lineHeight: 1.75,
                  margin: 0,
                  textAlign: "center",
                }}
              >
                Give me just a moment more
                <span className="animated-dots">
                  <span className="dot dot-1">.</span>
                  <span className="dot dot-2">.</span>
                  <span className="dot dot-3">.</span>
                </span>
              </p>
            ) : (
              <p
                style={{
                  fontFamily: "Verdana, sans-serif",
                  fontSize: 15,
                  color: "rgba(255,255,255,0.92)",
                  lineHeight: 1.75,
                  whiteSpace: "pre-wrap",
                  margin: 0,
                  textAlign: "center",
                }}
              >
                {displayedText}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Post-messages: cover panels (slide UP from below to cover screen) ── */}
      {showPanels && (
        <div className="fixed inset-0 z-30 flex" style={{ pointerEvents: "none" }}>
          {/* Sidebar-width panel */}
          <div
            style={{
              width: 288,
              flexShrink: 0,
              background: "#373024",
              transform: panelsCovering ? "translateY(0)" : "translateY(100%)",
              transition: panelsCovering
                ? "transform 1.2s cubic-bezier(0.76,0,0.24,1) 0s"
                : "none",
            }}
          />
          {/* 3 content panels, staggered */}
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: "#373024",
                transform: panelsCovering ? "translateY(0)" : "translateY(100%)",
                transition: panelsCovering
                  ? `transform 1.2s cubic-bezier(0.76,0,0.24,1) ${i * 0.2}s`
                  : "none",
              }}
            />
          ))}
          {/* Centered "Dopl" text — appears after panels finish covering */}
          {showDoplText && (
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 1 }}
            >
              <h1
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontStyle: "italic",
                  color: "white",
                  fontSize: 32,
                  opacity: 0.9,
                  margin: 0,
                }}
              >
                Dopl
              </h1>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
