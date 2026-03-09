"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import AuthCard from "@/components/landing/AuthCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "greeting" | "name_capture" | "use_case" | "token_offer" | "auth" | "provisioning";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  isAuthCard?: boolean;
}

interface PreAuthContext {
  userName: string;
  agentName: string;
  useCase: string;
}

const PRE_AUTH_KEY = "cc_pre_auth";
const CHAR_SPEED = 22;

// ─── AI message copy ─────────────────────────────────────────────────────────

const HERO_SMALL = "Hey there!";
const HERO_BIG = "I'm your intelligent personal assistant, here to do whatever you need.";
const HERO_SUB = "I'm fresh out of the box and excited to meet you! First — what's your name, and what would you like to call me?";

function getUseCaseResponse(useCase: string, userName: string): string {
  const lower = useCase.toLowerCase();
  let opener = "";
  if (/email|inbox|gmail|message/.test(lower)) {
    opener = `I'll own your inbox — drafting replies, filtering noise, nothing slips through.`;
  } else if (/research|find|look up|search|data/.test(lower)) {
    opener = `Research is one of my favourite things. I'll dig through anything and hand you exactly what you need.`;
  } else if (/schedule|calendar|meeting|appointment/.test(lower)) {
    opener = `Calendar wrangling? I've got it. You focus on the work that matters.`;
  } else if (/code|build|app|dev|engineer|software/.test(lower)) {
    opener = `Dev work, automation, scripts — right at home. We'll make a good team.`;
  } else if (/social|twitter|linkedin|content|post|write/.test(lower)) {
    opener = `Content and social? I can draft, schedule, monitor — the whole thing.`;
  } else if (/sales|outreach|lead|customer|crm/.test(lower)) {
    opener = `Sales outreach, follow-ups, lead research — I can run a lot of that quietly for you.`;
  } else {
    opener = `Perfect. I already have a few ideas for where to start, ${userName}.`;
  }
  return `${opener}\n\nHere's the deal: 500,000 tokens, on me, so we can hit the ground running. Just make an account and I'll apply them the moment you're in.`;
}

function uid() { return Math.random().toString(36).slice(2); }

// ─── Natural language name parser ─────────────────────────────────────────────
// Handles: "Sam / Sophia", "I'm Sam, call yourself Nova", "Sam and you're Aria", etc.
function parseNames(raw: string): { uName: string; aName: string } {
  const text = raw.trim();

  // Explicit slash separator: "Sam / Nova"
  if (text.includes("/")) {
    const [a, b] = text.split("/").map((s) => s.trim());
    return { uName: extractName(a), aName: extractName(b) || "Claude" };
  }

  // Look for agent name patterns first (more specific)
  const agentPatterns = [
    /(?:you(?:\s+can)?\s+(?:be|go by|call yourself|are)|call you|i['']?ll call you|name you)\s+([A-Za-z][A-Za-z\s\-]{0,20}?)(?:[,\.!]|$)/i,
    /(?:and\s+)?you(?:'re|\s+are)?\s+([A-Z][a-zA-Z\-]{1,20})/,
  ];
  let aName = "";
  for (const pat of agentPatterns) {
    const m = text.match(pat);
    if (m?.[1]) { aName = m[1].trim().split(/\s+/)[0]; break; }
  }

  // Look for user name patterns
  const userPatterns = [
    /i['']?m\s+([A-Z][a-zA-Z\-]{1,20})/i,
    /my\s+name\s+is\s+([A-Z][a-zA-Z\-]{1,20})/i,
    /(?:^|,\s*)([A-Z][a-zA-Z\-]{1,20})(?:\s+(?:and|,))/i,
    /^([A-Z][a-zA-Z\-]{1,20})$/i,
  ];
  let uName = "";
  for (const pat of userPatterns) {
    const m = text.match(pat);
    if (m?.[1] && m[1].toLowerCase() !== "and" && m[1].toLowerCase() !== "you") {
      uName = m[1].trim();
      break;
    }
  }

  // Fallback: if no patterns matched, split on comma or "and"
  if (!uName) {
    const parts = text.split(/,|and/i).map((s) => s.trim()).filter(Boolean);
    uName = extractName(parts[0]) || text.split(/\s+/)[0];
    if (!aName && parts[1]) aName = extractName(parts[1]);
  }

  return { uName: capitalize(uName) || "friend", aName: capitalize(aName) || "Claude" };
}

// Strip filler words and possessives, return the core name
function extractName(s: string): string {
  return s
    .replace(/^(i['']?m|my name is|call (me|yourself|you)|you can be|you('re| are)|and you|and)/gi, "")
    .replace(/[^A-Za-z\-]/g, " ")
    .trim()
    .split(/\s+/)[0] || "";
}

function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s;
}

// ─── Typing animation hook ────────────────────────────────────────────────────

function useTypewriter(text: string, active: boolean, onDone: () => void) {
  const [out, setOut] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);
  const i = useRef(0);

  useEffect(() => {
    if (!active) return;
    setOut(""); setDone(false); i.current = 0;
    function tick() {
      if (i.current < text.length) {
        setOut(text.slice(0, i.current + 1));
        i.current++;
        ref.current = setTimeout(tick, CHAR_SPEED);
      } else {
        setDone(true);
        onDone();
      }
    }
    ref.current = setTimeout(tick, 120);
    return () => { if (ref.current) clearTimeout(ref.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active]);

  return { out, done };
}

// ─── Block cursor input ────────────────────────────────────────────────────────
// Uses an invisible real <input> on top of a mirrored display div,
// so the block cursor always sits flush after the last character.

function BlockInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter" && value.trim()) onSubmit();
  }

  return (
    <div className="relative" onClick={() => inputRef.current?.focus()}>
      {/* Invisible real input — handles all keyboard events */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        disabled={disabled}
        className="absolute inset-0 w-full opacity-0 cursor-default"
        style={{ caretColor: "transparent" }}
        autoComplete="off"
        spellCheck={false}
      />
      {/* Visual display — mirrors the input value with the block cursor inline */}
      <div className="font-body text-[15px] text-forest leading-relaxed flex items-center min-h-[28px]">
        <span className="whitespace-pre">{value}</span>
        {!disabled && (
          <span
            className="inline-block ml-[1px] flex-shrink-0 animate-[cursorFade_1.1s_ease-in-out_infinite]"
            style={{ width: "10px", height: "20px", background: "#1A3C2B", verticalAlign: "middle" }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  // Hero typewriter stages
  const [stageSmall, setStageSmall] = useState(false);
  const [stageBig, setStageBig] = useState(false);
  const [stageSub, setStageSub] = useState(false);
  const [heroReady, setHeroReady] = useState(false); // input appears

  // Chat state
  const [step, setStep] = useState<Step>("greeting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const [currentAiText, setCurrentAiText] = useState("");
  const [currentAiActive, setCurrentAiActive] = useState(false);
  const [currentAiIsAuthCard, setCurrentAiIsAuthCard] = useState(false);

  const [userName, setUserName] = useState("");
  const [agentName, setAgentName] = useState("Your Agent");
  const [useCase, setUseCase] = useState("");
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Scroll chat container to bottom — does NOT scroll the page
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, currentAiText]);

  // ── Hero typewriter chain ──────────────────────────────────────────────────

  // Small text ("Hey there!") — starts immediately
  const smallTw = useTypewriter(HERO_SMALL, stageSmall, () => {
    setTimeout(() => setStageBig(true), 200);
  });

  // Big text
  const bigTw = useTypewriter(HERO_BIG, stageBig, () => {
    setTimeout(() => setStageSub(true), 150);
  });

  // Sub text
  const subTw = useTypewriter(HERO_SUB, stageSub, () => {
    setTimeout(() => setHeroReady(true), 300);
  });

  // Start the chain
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      if (isSupabaseConfigured()) {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const stored = localStorage.getItem(PRE_AUTH_KEY);
        if (session && stored) {
          try {
            const ctx: PreAuthContext = JSON.parse(stored);
            setUserName(ctx.userName);
            setAgentName(ctx.agentName || "Your Agent");
            setUseCase(ctx.useCase);
            setStep("provisioning");
            triggerProvision(ctx);
            return;
          } catch { localStorage.removeItem(PRE_AUTH_KEY); }
        }
        if (session && !stored) { window.location.href = "/chat"; return; }
      }
      setTimeout(() => setStageSmall(true), 500);
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── AI inline chat (after hero) ────────────────────────────────────────────

  const onAiDone = useCallback(() => {
    setCurrentAiActive(false);
    setMessages((prev) => [
      ...prev,
      {
        id: uid(),
        role: "ai",
        content: currentAiText,
        isAuthCard: currentAiIsAuthCard,
      },
    ]);
    setCurrentAiText("");
    setAiTyping(false);

    if (step === "token_offer") {
      setTimeout(() => {
        pushAiMessage("Perfect. Here's how we make it official 👇", true);
        setStep("auth");
      }, 500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, currentAiText, currentAiIsAuthCard]);

  function pushAiMessage(text: string, isAuthCard = false) {
    setAiTyping(true);
    setCurrentAiIsAuthCard(isAuthCard);
    setCurrentAiText(text);
    setCurrentAiActive(true);
  }

  // ── User submit ────────────────────────────────────────────────────────────

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || aiTyping) return;
    setInput("");
    setMessages((prev) => [...prev, { id: uid(), role: "user", content: trimmed }]);

    if (step === "name_capture") {
      const { uName, aName } = parseNames(trimmed);
      setUserName(uName);
      setAgentName(aName);
      localStorage.setItem(PRE_AUTH_KEY, JSON.stringify({ userName: uName, agentName: aName, useCase: "" }));
      setTimeout(() => {
        setStep("use_case");
        pushAiMessage(`Nice to meet you, ${uName}! I'll go by ${aName} from here.\n\nSo — what does your day-to-day look like? What would you love to hand off?`);
      }, 300);
    } else if (step === "use_case") {
      setUseCase(trimmed);
      const stored = localStorage.getItem(PRE_AUTH_KEY);
      const ctx = stored ? JSON.parse(stored) : { userName, agentName };
      localStorage.setItem(PRE_AUTH_KEY, JSON.stringify({ ...ctx, useCase: trimmed }));
      setTimeout(() => {
        setStep("token_offer");
        pushAiMessage(getUseCaseResponse(trimmed, userName));
      }, 300);
    }
  }

  // ── Provisioning ───────────────────────────────────────────────────────────

  const triggerProvision = useCallback(async (ctx: PreAuthContext) => {
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
      if (!res.ok && !data.organization?.openclaw_gateway_url && !data.error?.includes("already has a provisioned")) {
        throw new Error(data.error || "Provisioning failed");
      }
      localStorage.removeItem(PRE_AUTH_KEY);
      window.location.href = "/chat";
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : "Something went wrong");
      setStep("auth");
    }
  }, []);

  function handleAuthSuccess() {
    const ctx = { userName, agentName, useCase };
    localStorage.setItem(PRE_AUTH_KEY, JSON.stringify(ctx));
    setStep("provisioning");
    triggerProvision(ctx);
  }

  // Input placeholder text based on step
  const inputPlaceholder =
    step === "name_capture" ? "Your name / what to call me  (e.g. Sam / Nova)" :
    step === "use_case" ? "Tell me what you do..." : "";

  const showInput = heroReady && (step === "name_capture" || step === "use_case") && !aiTyping;

  // Activate name_capture once hero is ready
  useEffect(() => {
    if (heroReady && step === "greeting") setStep("name_capture");
  }, [heroReady, step]);

  // ── Current AI bubble (typing in progress) ────────────────────────────────
  function CurrentAiBubble() {
    const { out } = useTypewriter(currentAiText, currentAiActive, onAiDone);
    return (
      <div className="text-forest text-[15px] leading-relaxed whitespace-pre-wrap font-body mt-6">
        {out}
        <span className="inline-block w-[2px] h-[15px] bg-forest/50 ml-[1px] align-middle animate-[blink_0.75s_step-end_infinite]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[rgba(58,58,56,0.15)] px-6 py-4 flex items-center justify-between flex-shrink-0">
        <span className="font-header text-lg font-bold text-forest tracking-tight">CrackedClaw</span>
        <a
          href="/login"
          className="font-mono text-[11px] uppercase tracking-wide border border-[rgba(58,58,56,0.3)] px-4 py-2 text-forest hover:bg-forest hover:text-white transition-colors"
        >
          Sign In
        </a>
      </header>

      {/* Hero — chat lives here. Fixed height so features section never shifts. */}
      <main className="flex flex-col items-center px-6 pt-16 pb-8" style={{ minHeight: "520px" }}>
        <div className="w-full max-w-2xl">

          {/* Scrollable chat region with fade */}
          <div className="relative">
            {/* Fade top */}
            {messages.length > 0 && (
              <div className="absolute top-0 left-0 right-0 h-12 bg-gradient-to-b from-paper to-transparent z-10 pointer-events-none" />
            )}

            {/* Content */}
            <div ref={chatScrollRef} className="max-h-[55vh] overflow-y-auto" style={{ scrollbarWidth: "none" }}>
              {/* Hero copy — always visible at top */}
              <div className="text-center mb-8">
                {/* Small label */}
                <p className="font-mono text-[11px] text-grid/50 uppercase tracking-widest mb-4 min-h-[16px]">
                  {smallTw.out}

                </p>

                {/* Big heading */}
                {stageBig && (
                  <h1 className="font-header text-4xl md:text-5xl font-bold text-forest leading-tight mb-5 min-h-[60px]">
                    {bigTw.out}

                  </h1>
                )}

                {/* Sub text */}
                {stageSub && (
                  <p className="text-base text-grid/60 leading-relaxed max-w-xl mx-auto font-body min-h-[48px]">
                    {subTw.out}

                  </p>
                )}
              </div>

              {/* Chat messages */}
              {messages.map((msg) => (
                <div key={msg.id} className={`mb-6 ${msg.role === "user" ? "flex justify-end" : ""}`}>
                  {msg.role === "ai" ? (
                    <div>
                      <p className="font-mono text-[9px] text-grid/35 uppercase tracking-widest mb-1">{agentName}</p>
                      <div className="text-forest text-[15px] leading-relaxed whitespace-pre-wrap font-body">
                        {msg.content}
                      </div>
                      {msg.isAuthCard && (
                        <div className="mt-4 max-w-sm">
                          <AuthCard onSuccess={handleAuthSuccess} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="max-w-[70%]">
                      <p className="font-mono text-[9px] text-grid/35 uppercase tracking-widest mb-1 text-right">You</p>
                      <div className="bg-forest text-white px-4 py-3 text-sm leading-relaxed font-body">
                        {msg.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Current AI typing */}
              {aiTyping && currentAiActive && <CurrentAiBubble />}

              {/* Provisioning */}
              {step === "provisioning" && (
                <div className="text-forest text-[15px] leading-relaxed font-body mt-6 flex items-center gap-2">
                  <span>Setting everything up for you</span>
                  <span className="flex gap-[3px] items-center">
                    <span className="w-[5px] h-[5px] bg-forest/30 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-[5px] h-[5px] bg-forest/30 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-[5px] h-[5px] bg-forest/30 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              )}

              {provisionError && (
                <p className="font-mono text-[11px] text-coral mt-4">
                  ⚠ {provisionError} — <a href="/login" className="underline">sign in here</a>.
                </p>
              )}

              <div />
            </div>

            {/* Fade bottom */}
            {messages.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-paper to-transparent z-10 pointer-events-none" />
            )}
          </div>

          {/* Input — appears below hero after typing finishes */}
          {showInput && (
            <div className="mt-8 animate-in fade-in duration-500">
              <BlockInput
                value={input}
                onChange={setInput}
                onSubmit={handleSubmit}
                disabled={aiTyping}
              />
            </div>
          )}
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-[rgba(58,58,56,0.15)] px-6 py-16 mt-24">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-px bg-[rgba(58,58,56,0.15)]">
          {[
            {
              icon: "🌐",
              title: "Browser automation",
              desc: "Your agent navigates the web, fills forms, and automates any task with a UI — no code needed.",
            },
            {
              icon: "🔗",
              title: "Connects everything",
              desc: "Gmail, Sheets, LinkedIn, Twilio — if it has an API or a web UI, your agent can use it.",
            },
            {
              icon: "🧠",
              title: "Remembers across sessions",
              desc: "Credentials, preferences, context — your agent builds persistent memory so you never repeat yourself.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-paper p-8">
              <div className="text-2xl mb-4">{f.icon}</div>
              <h3 className="font-header text-sm font-bold text-forest mb-2">{f.title}</h3>
              <p className="font-mono text-[11px] text-grid/60 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[rgba(58,58,56,0.15)] px-6 py-6 text-center">
        <span className="font-mono text-[10px] text-grid/40 uppercase tracking-wide">CrackedClaw © 2026</span>
      </footer>
    </div>
  );
}
