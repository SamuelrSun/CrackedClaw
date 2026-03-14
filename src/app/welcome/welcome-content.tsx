"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useFormValidation } from "@/hooks/use-form-validation";
import { validateEmail, validatePassword } from "@/lib/validation";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { Input } from "@/components/ui/input";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const MSG1 = `Hey! Welcome to Dopl.

I'm not your companion yet, just the welcome crew. I'm setting up your personal AI companion right now as we speak. Over time, they'll become your confidant, assistant, partner--and so much more. I'm excited for the adventures you'll go on! Give me just a sec....`;

const MSG2 = `All set! Your agent is warmed up and waiting for you.

I'm giving you both 100,000 tokens to get to know each other. That's a lot of conversations.

When you're ready to meet them, just sign in below. See you on the other side!`;

const CHAR_INTERVAL_MS = 28; // ~36 chars/sec
const MSG2_START_MS = 10000; // 10 seconds after page load

// ─────────────────────────────────────────────────────────
// Error helpers
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
// Typing hook
// ─────────────────────────────────────────────────────────

function useTypewriter(
  fullText: string,
  startTyping: boolean,
  onComplete?: () => void
): string {
  const [displayed, setDisplayed] = useState("");
  const indexRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!startTyping) {
      setDisplayed("");
      indexRef.current = 0;
      return;
    }
    indexRef.current = 0;
    setDisplayed("");

    const id = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(fullText.slice(0, indexRef.current));
      if (indexRef.current >= fullText.length) {
        clearInterval(id);
        onCompleteRef.current?.();
      }
    }, CHAR_INTERVAL_MS);

    return () => clearInterval(id);
  }, [fullText, startTyping]);

  return displayed;
}

// ─────────────────────────────────────────────────────────
// SVG icons
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
// Spinner
// ─────────────────────────────────────────────────────────

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
// Auth form (rendered inside msg2 bubble)
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
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.12)" }}>
      {/* OAuth buttons */}
      <div className="space-y-2 mb-4">
        <button
          type="button"
          onClick={() => handleOAuth("google")}
          disabled={!!oauthLoading || loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 transition-colors disabled:opacity-50"
          style={{
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(255,255,255,0.10)",
          }}
          onMouseEnter={(e) => { if (!oauthLoading && !loading) e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
        >
          <GoogleIcon />
          <span className="font-mono text-[11px] text-white">
            {oauthLoading === "google" ? "Redirecting..." : isSignUp ? "Sign up with Google" : "Sign in with Google"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => handleOAuth("github")}
          disabled={!!oauthLoading || loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 transition-colors disabled:opacity-50"
          style={{
            border: "1px solid rgba(255,255,255,0.20)",
            background: "rgba(255,255,255,0.10)",
          }}
          onMouseEnter={(e) => { if (!oauthLoading && !loading) e.currentTarget.style.background = "rgba(255,255,255,0.18)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.10)"; }}
        >
          <GitHubIcon />
          <span className="font-mono text-[11px] text-white">
            {oauthLoading === "github" ? "Redirecting..." : isSignUp ? "Sign up with GitHub" : "Sign in with GitHub"}
          </span>
        </button>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.20)" }} />
        <span className="font-mono text-[10px] text-white/50 uppercase tracking-wide">or</span>
        <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.20)" }} />
      </div>

      {/* Server error */}
      {serverError && (
        <div className="mb-4">
          <FormErrorSummary errors={[serverError]} onScrollToFirst={form.scrollToFirstError} />
        </div>
      )}

      {/* Success */}
      {success && (
        <div
          className="mb-4 p-3"
          style={{ border: "1px solid rgba(100,220,150,0.5)", background: "rgba(100,220,150,0.15)" }}
        >
          <p className="font-mono text-[11px] text-green-300 uppercase tracking-wide font-medium mb-1">
            ✓ Account created!
          </p>
          <p className="font-mono text-[10px] text-green-200/80">{success}</p>
        </div>
      )}

      {/* Email form */}
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
          className="w-full px-4 py-2.5 text-white font-mono text-[11px] uppercase tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#18181B", borderRadius: 50 }}
          onMouseEnter={(e) => { if (!loading && !form.isSubmitting) e.currentTarget.style.background = "#333"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#18181B"; }}
        >
          {loading || form.isSubmitting ? "Loading..." : isSignUp ? "Sign Up" : "Sign In"}
        </button>

        <div className="!mt-1 text-right">
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
            {isSignUp ? "Already have an account? Sign in" : "Or sign up"}
          </button>
        </div>
      </form>

      {/* Terms */}
      <p className="font-mono text-[9px] text-white/30 text-center mt-5 uppercase tracking-wide">
        <a href="/terms" className="underline hover:text-white transition-colors">
          Terms
        </a>
        <span className="mx-2">·</span>
        <a href="/privacy" className="underline hover:text-white transition-colors">
          Privacy
        </a>
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Message bubble
// ─────────────────────────────────────────────────────────

interface BubbleProps {
  text: string;
  children?: React.ReactNode;
  visible: boolean;
}

function Bubble({ text, children, visible }: BubbleProps) {
  if (!visible) return null;
  return (
    <div
      className="max-w-full"
      style={{
        background: "rgba(255,255,255,0.08)",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <p
        className="font-mono text-[12px] text-white/90 leading-relaxed whitespace-pre-wrap"
        style={{ fontFamily: "monospace" }}
      >
        {text}
      </p>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────

type Phase =
  | "phase1"   // typing msg1
  | "phase1_done" // msg1 done, showing ...
  | "phase2"   // typing msg2
  | "phase2_done" // msg2 + auth form visible
  | "phase3"   // post-auth: fade + spinner + provisioning
  | "phase4";  // panels sliding up → redirect

export function WelcomeContent() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("phase1");
  const [msg1Typing, setMsg1Typing] = useState(true);
  const [msg2Typing, setMsg2Typing] = useState(false);
  const [chatOpacity, setChatOpacity] = useState(1);
  const [showPanels, setShowPanels] = useState(false);
  const [panelsAnimating, setPanelsAnimating] = useState(false);
  const msg2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Typewriter for msg1
  const msg1Text = useTypewriter(MSG1, msg1Typing, () => {
    setPhase("phase1_done");
  });

  // Typewriter for msg2
  const msg2Text = useTypewriter(MSG2, msg2Typing, () => {
    setPhase("phase2_done");
  });

  // Start msg2 after 10s
  useEffect(() => {
    msg2TimerRef.current = setTimeout(() => {
      setMsg2Typing(true);
      setPhase("phase2");
    }, MSG2_START_MS);

    return () => {
      if (msg2TimerRef.current) clearTimeout(msg2TimerRef.current);
    };
  }, []);

  // Called when auth succeeds
  const handleAuthSuccess = useCallback(() => {
    setPhase("phase3");
    // Fade out chat
    setChatOpacity(0);

    // Call provisioning API
    (async () => {
      try {
        await fetch("/api/organizations/provision", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      } catch {
        // Provisioning failed - proceed anyway
      }

      // Start panel reveal
      setShowPanels(true);
      setPhase("phase4");

      // Small delay so panels are in DOM before animating
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPanelsAnimating(true);
        });
      });

      // Redirect after panels finish (~2.8s total)
      setTimeout(() => {
        router.push("/chat");
      }, 2900);
    })();
  }, [router]);

  const isPhase3OrLater = phase === "phase3" || phase === "phase4";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0f" }}
    >
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fixed inset-0 z-0" style={{ background: "rgba(0,0,0,0.25)" }} />

      {/* Chat panel */}
      <div
        className="relative z-10 w-full max-w-lg"
        style={{
          opacity: chatOpacity,
          transition: "opacity 0.5s ease",
          pointerEvents: isPhase3OrLater ? "none" : "auto",
        }}
      >
        {/* Dopl heading */}
        <div
          className="text-center mb-6"
          style={{ animation: "loginFadeIn 0.6s ease-out both" }}
        >
          <h1
            className="text-xl font-bold mb-1"
            style={{
              fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
              fontStyle: "italic",
              color: "#18181B",
            }}
          >
            Dopl
          </h1>
          <p
            className="font-mono text-[11px] uppercase tracking-wide"
            style={{ color: "#18181B" }}
          >
            The AI Personal Companion
          </p>
        </div>

        {/* Chat card */}
        <div
          className="w-full p-5 space-y-3"
          style={{
            animation: "loginFadeIn 0.6s ease-out 0.1s both",
            background: "rgba(255,255,255,0.15)",
            backdropFilter: "blur(40px) saturate(120%)",
            WebkitBackdropFilter: "blur(40px) saturate(120%)",
            border: "1px solid rgba(255,255,255,0.25)",
            borderRadius: 0, // hard edges on card
          }}
        >
          {/* Message 1 */}
          <Bubble text={msg1Text} visible={msg1Text.length > 0}>
            {/* Pulsing dots after msg1 done and before msg2 starts */}
            {(phase === "phase1_done") && (
              <div className="flex gap-1 mt-3">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "rgba(255,255,255,0.6)",
                      animation: `pulseDots 1.4s ease-in-out ${i * 0.22}s infinite`,
                    }}
                  />
                ))}
              </div>
            )}
          </Bubble>

          {/* Message 2 */}
          {(phase === "phase2" || phase === "phase2_done" || isPhase3OrLater) && msg2Text.length > 0 && (
            <Bubble text={msg2Text} visible={true}>
              {/* Auth form appears after msg2 is done */}
              {(phase === "phase2_done" || isPhase3OrLater) && (
                <AuthForm onAuthSuccess={handleAuthSuccess} />
              )}
            </Bubble>
          )}
        </div>
      </div>

      {/* Phase 3: Spinner overlay */}
      {isPhase3OrLater && (
        <div
          className="fixed inset-0 z-20 flex items-center justify-center"
          style={{
            animation: "loginFadeIn 0.4s ease-out both",
          }}
        >
          <Spinner />
        </div>
      )}

      {/* Phase 4: Reveal panels */}
      {showPanels && (
        <div className="fixed inset-0 z-30 flex">
          {/* Sidebar-width panel */}
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
          {/* 3 equal panels */}
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
