"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step =
  | "greeting"
  | "name_capture"
  | "use_case"
  | "token_offer"
  | "auth"
  | "provisioning"
  | "done";

type AuthMode = "signup" | "signin";

interface Message {
  id: string;
  role: "ai" | "user";
  content: string;
  isTyping?: boolean;
  isAuthCard?: boolean;
}

interface PreAuthContext {
  userName: string;
  agentName: string;
  useCase: string;
}

const PRE_AUTH_KEY = "cc_pre_auth";
const TYPING_SPEED_MS = 18;

const GREETING_MESSAGE = `Hey there. I'm an AI agent that can do pretty much anything — and I mean that literally.

Browse the web for you. Run automations. Connect your tools. Remember everything. Work while you sleep.

I'm glad you're here. Let's make this official.

What's your name — and what would you like to call me?`;

function getUseCaseResponse(useCase: string, userName: string): string {
  const lower = useCase.toLowerCase();
  let opener = "";

  if (/email|inbox|gmail|message/.test(lower)) {
    opener = `I can own your inbox — draft replies, filter noise, never let anything slip. That's a perfect place to start.`;
  } else if (/research|find|look up|search|data/.test(lower)) {
    opener = `Research is one of my favourite things. I can dig through anything and hand you exactly what you need.`;
  } else if (/schedule|calendar|meeting|appointment/.test(lower)) {
    opener = `Calendar wrangling? Done. I'll handle the scheduling so you can focus on the work that actually matters.`;
  } else if (/code|build|app|dev|engineer|software/.test(lower)) {
    opener = `Dev work, automation, scripts — I'm right at home there. We're going to make a good team.`;
  } else if (/social|twitter|linkedin|content|post|write/.test(lower)) {
    opener = `Content and social? I can draft, schedule, monitor — the whole operation. Let's go.`;
  } else if (/sales|outreach|lead|customer|crm/.test(lower)) {
    opener = `Sales outreach, lead research, follow-ups — I can run a lot of that quietly in the background.`;
  } else {
    opener = `Got it. I already have a few ideas for how I can start making your life easier, ${userName}.`;
  }

  return `${opener}

Here's the deal: I'm giving you 500,000 tokens, completely free, so we can hit the ground running right away.

Just make an account — I'll apply them the moment you're in. Deal?`;
}

function generateId(): string {
  return Math.random().toString(36).slice(2);
}

function getFriendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return "Wrong email or password.";
  if (m.includes("already registered") || m.includes("already exists")) return "That email is already registered — try signing in.";
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("least"))) return "Password must be at least 6 characters.";
  if (m.includes("email not confirmed")) return "Check your inbox to verify your email first.";
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts — wait a moment and try again.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Connection issue — check your internet and try again.";
  return msg;
}

// ─── Auth Card ────────────────────────────────────────────────────────────────

function AuthCard({ onSuccess }: { onSuccess: () => void }) {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const configured = isSupabaseConfigured();

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) { setError("Auth not configured — set Supabase env vars."); return; }
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?source=landing` },
        });
        if (signUpErr) { setError(getFriendlyError(signUpErr.message)); return; }
        if (data.user?.identities?.length === 0) { setError("That email is already registered — try signing in."); return; }
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) { setError("Check your email to verify your account, then come back!"); return; }
        onSuccess();
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) { setError(getFriendlyError(signInErr.message)); return; }
        onSuccess();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: "google" | "github") {
    if (!configured) { setError("Auth not configured — set Supabase env vars."); return; }
    setOauthLoading(provider);
    setError(null);
    const supabase = createClient();
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback?source=landing` },
    });
    if (oauthErr) { setError(getFriendlyError(oauthErr.message)); setOauthLoading(null); }
  }

  return (
    <div className="border border-[rgba(58,58,56,0.25)] bg-white p-5 mt-1 w-full">
      <div className="space-y-2 mb-4">
        <button onClick={() => handleOAuth("google")} disabled={!!oauthLoading || loading}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.2)] bg-white hover:bg-paper transition-colors disabled:opacity-50">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9086c1.7018-1.5668 2.6836-3.874 2.6836-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.4673-.8059 5.9564-2.1805l-2.9086-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3441 0-4.3282-1.5832-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853"/>
            <path d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1022-1.17.2822-1.71V4.9582H.9573A8.9961 8.9961 0 0 0 0 9c0 1.4523.3477 2.8268.9573 4.0418L3.964 10.71z" fill="#FBBC05"/>
            <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5813C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6559 3.5795 9 3.5795z" fill="#EA4335"/>
          </svg>
          <span className="font-mono text-[11px] text-forest">{oauthLoading === "google" ? "Redirecting..." : "Continue with Google"}</span>
        </button>
        <button onClick={() => handleOAuth("github")} disabled={!!oauthLoading || loading}
          className="w-full flex items-center gap-3 px-4 py-2.5 border border-[rgba(58,58,56,0.2)] bg-white hover:bg-paper transition-colors disabled:opacity-50">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="text-forest">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
          </svg>
          <span className="font-mono text-[11px] text-forest">{oauthLoading === "github" ? "Redirecting..." : "Continue with GitHub"}</span>
        </button>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[rgba(58,58,56,0.15)]" />
        <span className="font-mono text-[10px] text-grid/50 uppercase tracking-wide">or</span>
        <div className="flex-1 h-px bg-[rgba(58,58,56,0.15)]" />
      </div>
      <form onSubmit={handleEmail} className="space-y-3">
        <input type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading || !!oauthLoading}
          className="w-full px-3 py-2 border border-[rgba(58,58,56,0.2)] bg-paper font-mono text-[11px] text-forest placeholder:text-grid/40 focus:outline-none focus:border-forest transition-colors disabled:opacity-50" />
        <input type="password" placeholder="password (min 6 chars)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} disabled={loading || !!oauthLoading}
          className="w-full px-3 py-2 border border-[rgba(58,58,56,0.2)] bg-paper font-mono text-[11px] text-forest placeholder:text-grid/40 focus:outline-none focus:border-forest transition-colors disabled:opacity-50" />
        {error && <p className="font-mono text-[10px] text-coral">{error}</p>}
        <button type="submit" disabled={loading || !!oauthLoading}
          className="w-full px-4 py-2.5 bg-forest text-white font-mono text-[11px] uppercase tracking-wide hover:bg-forest/90 transition-colors disabled:opacity-50">
          {loading ? "Working..." : mode === "signup" ? "Create Account" : "Sign In"}
        </button>
      </form>
      <button type="button" onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setError(null); }}
        className="mt-3 font-mono text-[9px] text-grid/50 hover:text-forest uppercase tracking-wide transition-colors block w-full text-center">
        {mode === "signup" ? "Already have an account? Sign in →" : "← Back to sign up"}
      </button>
    </div>
  );
}

// ─── Message Bubbles ──────────────────────────────────────────────────────────

function AIBubble({ content, animate, onDone, showAuth, onAuthSuccess }: {
  content: string;
  animate: boolean;
  onDone?: () => void;
  showAuth?: boolean;
  onAuthSuccess?: () => void;
}) {
  const [displayed, setDisplayed] = useState(animate ? "" : content);
  const [typing, setTyping] = useState(animate);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!animate) return;
    setDisplayed("");
    setTyping(true);
    indexRef.current = 0;

    function tick() {
      if (indexRef.current < content.length) {
        setDisplayed(content.slice(0, indexRef.current + 1));
        indexRef.current++;
        timerRef.current = setTimeout(tick, TYPING_SPEED_MS);
      } else {
        setTyping(false);
        onDone?.();
      }
    }

    timerRef.current = setTimeout(tick, 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-2 max-w-[88%]">
      <div className="bg-forest text-white px-4 py-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
        {displayed}
        {typing && <span className="inline-block w-[2px] h-[13px] bg-white/70 ml-[1px] align-middle animate-[blink_0.75s_step-end_infinite]" />}
      </div>
      {showAuth && !typing && onAuthSuccess && <AuthCard onSuccess={onAuthSuccess} />}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-paper border border-[rgba(58,58,56,0.15)] text-forest px-4 py-3 font-mono text-[12px] leading-relaxed max-w-[80%] whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

function ProvisioningBubble() {
  return (
    <div className="flex flex-col gap-2 max-w-[88%]">
      <div className="bg-forest text-white px-4 py-3 font-mono text-[12px] leading-relaxed flex items-center gap-2">
        <span>You&apos;re in. Setting everything up</span>
        <span className="flex gap-[3px] items-center">
          <span className="w-[5px] h-[5px] bg-white/60 rounded-full animate-bounce [animation-delay:0ms]" />
          <span className="w-[5px] h-[5px] bg-white/60 rounded-full animate-bounce [animation-delay:150ms]" />
          <span className="w-[5px] h-[5px] bg-white/60 rounded-full animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingChat() {
  const [step, setStep] = useState<Step>("greeting");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isAITyping, setIsAITyping] = useState(false);
  const [userName, setUserName] = useState("");
  const [agentName, setAgentName] = useState("Your Agent");
  const [useCase, setUseCase] = useState("");
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isAITyping && (step === "name_capture" || step === "use_case")) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isAITyping, step]);

  const addAIMessage = useCallback((content: string, opts?: { isAuthCard?: boolean }) => {
    const id = generateId();
    setMessages((prev) => [...prev, { id, role: "ai", content, isTyping: true, ...opts }]);
    setIsAITyping(true);
    return id;
  }, []);

  const addUserMessage = useCallback((content: string) => {
    setMessages((prev) => [...prev, { id: generateId(), role: "user", content }]);
  }, []);

  const provision = useCallback(async (ctx: PreAuthContext) => {
    setStep("provisioning");
    setProvisionError(null);
    try {
      const res = await fetch("/api/organizations/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_display_name: ctx.userName,
          agent_name: ctx.agentName,
          use_case: ctx.useCase,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.organization?.openclaw_gateway_url || (data.error?.includes("already has a provisioned"))) {
          localStorage.removeItem(PRE_AUTH_KEY);
          window.location.href = "/chat";
          return;
        }
        throw new Error(data.error || "Provisioning failed");
      }
      localStorage.removeItem(PRE_AUTH_KEY);
      window.location.href = "/chat";
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : "Something went wrong");
      setStep("auth");
    }
  }, []);

  const handleAuthSuccess = useCallback(() => {
    const ctx = { userName, agentName, useCase };
    localStorage.setItem(PRE_AUTH_KEY, JSON.stringify(ctx));
    provision(ctx);
  }, [userName, agentName, useCase, provision]);

  // On mount: check for existing session (post-OAuth redirect) or start greeting
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      if (!isSupabaseConfigured()) {
        // No Supabase — start greeting directly
        startGreeting();
        return;
      }

      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const stored = localStorage.getItem(PRE_AUTH_KEY);

      if (session && stored) {
        // Came back from OAuth with pre-auth context
        try {
          const ctx: PreAuthContext = JSON.parse(stored);
          setUserName(ctx.userName);
          setAgentName(ctx.agentName || "Your Agent");
          setUseCase(ctx.useCase);
          setStep("provisioning");
          // Show restored context briefly
          setMessages([
            { id: generateId(), role: "ai", content: GREETING_MESSAGE, isTyping: false },
            { id: generateId(), role: "user", content: `${ctx.userName} / ${ctx.agentName}` },
            { id: generateId(), role: "user", content: ctx.useCase },
          ]);
          provision(ctx);
          return;
        } catch {
          localStorage.removeItem(PRE_AUTH_KEY);
        }
      }

      if (session && !stored) {
        window.location.href = "/chat";
        return;
      }

      startGreeting();
    }

    function startGreeting() {
      setTimeout(() => {
        const id = generateId();
        setMessages([{ id, role: "ai", content: GREETING_MESSAGE, isTyping: true }]);
        setIsAITyping(true);
      }, 400);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onAIDone(msgId: string) {
    setIsAITyping(false);
    // Mark message as no longer typing
    setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isTyping: false } : m));

    if (step === "greeting") {
      setStep("name_capture");
    } else if (step === "token_offer") {
      setTimeout(() => {
        const id = generateId();
        setMessages((prev) => [...prev, { id, role: "ai", content: "Perfect. Here's how we make it official 👇", isTyping: true, isAuthCard: true }]);
        setIsAITyping(true);
        setStep("auth");
      }, 500);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isAITyping) return;
    setInput("");
    addUserMessage(trimmed);

    if (step === "name_capture") {
      const parts = trimmed.split(/[\/,]/).map((s) => s.trim()).filter(Boolean);
      const uName = parts[0] || trimmed;
      const aName = parts[1] || "Claude";
      setUserName(uName);
      setAgentName(aName);
      localStorage.setItem(PRE_AUTH_KEY, JSON.stringify({ userName: uName, agentName: aName, useCase: "" }));
      setTimeout(() => {
        setStep("use_case");
        addAIMessage(`Nice to meet you, ${uName}! I'll go by ${aName} from here on out.\n\nSo — what's your world like? Tell me what you do day-to-day, or what kinds of things you'd love to hand off to someone that never gets tired.`);
      }, 350);
    } else if (step === "use_case") {
      setUseCase(trimmed);
      const stored = localStorage.getItem(PRE_AUTH_KEY);
      const ctx = stored ? JSON.parse(stored) : { userName, agentName };
      localStorage.setItem(PRE_AUTH_KEY, JSON.stringify({ ...ctx, useCase: trimmed }));
      setTimeout(() => {
        setStep("token_offer");
        addAIMessage(getUseCaseResponse(trimmed, userName));
      }, 350);
    }
  }

  const inputEnabled = !isAITyping && (step === "name_capture" || step === "use_case");

  return (
    <div className="flex flex-col h-full border border-[rgba(58,58,56,0.2)] bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[rgba(58,58,56,0.1)] bg-paper flex-shrink-0">
        <div className="w-8 h-8 bg-forest flex items-center justify-center">
          <span className="text-white font-header text-xs font-bold">CC</span>
        </div>
        <div>
          <p className="font-mono text-[11px] font-semibold text-forest">{agentName}</p>
          <p className="font-mono text-[9px] text-grid/50 uppercase tracking-wide">
            {step === "provisioning" ? "Setting up your workspace..." : "Online · Ready to work"}
          </p>
        </div>
        <div className="ml-auto">
          <span className={`block w-2 h-2 rounded-full ${step === "provisioning" ? "bg-gold animate-pulse" : "bg-mint"}`} />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {messages.map((msg, idx) => {
          if (msg.role === "user") return <UserBubble key={msg.id} content={msg.content} />;
          const isLast = idx === messages.length - 1;
          return (
            <AIBubble
              key={msg.id}
              content={msg.content}
              animate={!!msg.isTyping}
              onDone={() => onAIDone(msg.id)}
              showAuth={!!msg.isAuthCard && isLast && !msg.isTyping}
              onAuthSuccess={handleAuthSuccess}
            />
          );
        })}

        {step === "provisioning" && <ProvisioningBubble />}

        {provisionError && (
          <div className="font-mono text-[11px] text-coral p-3 border border-coral/30 bg-coral/5">
            ⚠ {provisionError} — <a href="/login" className="underline">click here to sign in manually</a>.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {inputEnabled && (
        <form onSubmit={handleSubmit} className="border-t border-[rgba(58,58,56,0.1)] px-4 py-3 flex gap-3 items-center bg-paper flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isAITyping}
            placeholder={step === "name_capture" ? "Your name / what to call me  (e.g. Sam / Nova)" : "Tell me about your work..."}
            className="flex-1 bg-transparent font-mono text-[12px] text-forest placeholder:text-grid/40 focus:outline-none"
          />
          <button type="submit" disabled={!input.trim() || isAITyping}
            className="w-8 h-8 bg-forest flex items-center justify-center disabled:opacity-30 hover:bg-forest/90 transition-colors flex-shrink-0">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
            </svg>
          </button>
        </form>
      )}
    </div>
  );
}
