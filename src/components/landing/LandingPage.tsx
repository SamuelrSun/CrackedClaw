"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import AuthCard from "@/components/landing/AuthCard";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "chatting" | "auth" | "provisioning";

interface ChatMessage {
  id: string;
  role: "ai" | "user";
  content: string;
  isAuthCard?: boolean;
}

interface ApiMessage {
  role: "user" | "assistant";
  content: string;
}

interface PreAuthContext {
  userName: string;
  agentName: string;
  useCase: string;
}

const PRE_AUTH_KEY = "cc_pre_auth";
const CHAR_SPEED = 20;

const HERO_SMALL = "Hey there!";
const HERO_BIG = "I'm your intelligent personal assistant, here to do whatever you need.";
const HERO_SUB = "I'm fresh out of the box and excited to meet you! First — what's your name, and what would you like to call me?";

function uid() { return Math.random().toString(36).slice(2); }

// Strip <data>...</data> tags and [SHOW_AUTH] marker from display text
function stripMeta(text: string): string {
  let out = text;
  // Remove <data>...</data> blocks (may span lines)
  while (out.includes("<data>") && out.includes("</data>")) {
    const start = out.indexOf("<data>");
    const end = out.indexOf("</data>") + "</data>".length;
    out = out.slice(0, start) + out.slice(end);
  }
  return out.replace("[SHOW_AUTH]", "").trim();
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
  const [heroReady, setHeroReady] = useState(false);

  // Chat state
  const [step, setStep] = useState<Step>("chatting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiTyping, setAiTyping] = useState(false);
  const [streamingText, setStreamingText] = useState("");

  const [userName, setUserName] = useState("");
  const [agentName, setAgentName] = useState("Your Agent");
  const [useCase, setUseCase] = useState("");
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);

  // Scroll chat container to bottom
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  // ── Hero typewriter chain ──────────────────────────────────────────────────

  const smallTw = useTypewriter(HERO_SMALL, stageSmall, () => setTimeout(() => setStageBig(true), 200));
  const bigTw = useTypewriter(HERO_BIG, stageBig, () => setTimeout(() => setStageSub(true), 150));
  const subTw = useTypewriter(HERO_SUB, stageSub, () => setTimeout(() => setHeroReady(true), 300));

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    if (!isSupabaseConfigured()) {
      setTimeout(() => setStageSmall(true), 500);
      return;
    }

    // If already signed in, go straight to chat — no need to show onboarding
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session: s } }: { data: { session: import("@supabase/supabase-js").Session | null } }) => {
      const session = s;
      if (session) {
        window.location.href = "/chat";
      } else {
        setTimeout(() => setStageSmall(true), 500);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (heroReady && step === "chatting" && messages.length === 0) {
      // no-op: input is now shown, user types first
    }
  }, [heroReady, step, messages.length]);

  // ── Streaming AI response ──────────────────────────────────────────────────

  const streamAiResponse = useCallback(async (history: ApiMessage[]) => {
    setAiTyping(true);
    setStreamingText("");

    try {
      const res = await fetch("/api/landing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const evt = JSON.parse(data);
            if (evt.type === "content_block_delta" && evt.delta?.text) {
              fullText += evt.delta.text;
              // Strip the <data> tag from display
              const display = stripMeta(fullText);
              setStreamingText(display);
            }
          } catch { /* skip malformed */ }
        }
      }

      // Parse metadata from the full response
      const dataMatch = fullText.match(/<data>([\s\S]*?)<\/data>/);
      if (dataMatch) {
        try {
          const parsed = JSON.parse(dataMatch[1]);
          if (parsed.userName) { setUserName(parsed.userName); }
          if (parsed.agentName) { setAgentName(parsed.agentName); }
          // Store whatever we know
          const existing = localStorage.getItem(PRE_AUTH_KEY);
          const prev = existing ? JSON.parse(existing) : {};
          localStorage.setItem(PRE_AUTH_KEY, JSON.stringify({
            ...prev,
            ...(parsed.userName ? { userName: parsed.userName } : {}),
            ...(parsed.agentName ? { agentName: parsed.agentName } : {}),
          }));
        } catch { /* ignore */ }
      }

      const showAuth = fullText.includes("[SHOW_AUTH]");
      const cleanText = stripMeta(fullText);

      // Commit streamed message to history
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "ai", content: cleanText, isAuthCard: showAuth },
      ]);
      setApiHistory((prev) => [...prev, { role: "assistant", content: cleanText }]);
      setStreamingText("");
      setAiTyping(false);

      if (showAuth) setStep("auth");

    } catch (err) {
      console.error("Stream error:", err);
      setStreamingText("");
      setAiTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "ai", content: "Something went wrong — please refresh and try again." },
      ]);
    }
  }, []);

  // ── User submit ────────────────────────────────────────────────────────────

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || aiTyping || step !== "chatting") return;
    setInput("");

    const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMsg]);

    // Update use case context in localStorage
    const existing = localStorage.getItem(PRE_AUTH_KEY);
    const prev = existing ? JSON.parse(existing) : {};
    localStorage.setItem(PRE_AUTH_KEY, JSON.stringify({ ...prev, useCase: trimmed }));
    setUseCase(trimmed);

    const newHistory: ApiMessage[] = [...apiHistory, { role: "user", content: trimmed }];
    setApiHistory(newHistory);
    streamAiResponse(newHistory);
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
    const stored = localStorage.getItem(PRE_AUTH_KEY);
    const ctx: PreAuthContext = stored ? JSON.parse(stored) : { userName, agentName, useCase };
    localStorage.setItem(PRE_AUTH_KEY, JSON.stringify(ctx));
    setStep("provisioning");
    triggerProvision(ctx);
  }

  const showInput = heroReady && step === "chatting" && !aiTyping;

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

              {/* Streaming AI response */}
              {aiTyping && streamingText && (
                <div className="mb-6">
                  <p className="font-mono text-[9px] text-grid/35 uppercase tracking-widest mb-1">{agentName}</p>
                  <div className="text-forest text-[15px] leading-relaxed whitespace-pre-wrap font-body">
                    {streamingText}
                    <span className="inline-block w-[2px] h-[15px] bg-forest/40 ml-[1px] align-middle animate-[blink_0.75s_step-end_infinite]" />
                  </div>
                </div>
              )}
              {aiTyping && !streamingText && (
                <div className="mb-6 flex gap-[4px] items-center">
                  <span className="w-[5px] h-[5px] bg-forest/25 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-[5px] h-[5px] bg-forest/25 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-[5px] h-[5px] bg-forest/25 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              )}

              {/* Provisioning */}
              {step === "provisioning" && (
                <div className="text-forest text-[15px] leading-relaxed font-body mt-2 flex items-center gap-2">
                  <span>Setting everything up for you</span>
                  <span className="flex gap-[3px] items-center ml-1">
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
