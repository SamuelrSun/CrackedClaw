"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

export const dynamic = "force-dynamic";

/* ─────────────────────────────────────────────────────────
   Scroll-reveal hook
───────────────────────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.1 }
    );
    el.querySelectorAll(".fade-in-up").forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─────────────────────────────────────────────────────────
   Demo Chat Component
───────────────────────────────────────────────────────── */
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

const WELCOME_MSG: ChatMessage = {
  role: "assistant",
  content:
    "Hey! I'm Dopl, your AI that actually does things. Ask me anything about what I can do — from automating your inbox to controlling your browser. What would you like to know?",
};

function DemoChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const allMessages = [...messages.filter((m) => !m.streaming), userMsg];
    setMessages([...allMessages, { role: "assistant", content: "", streaming: true }]);
    setLoading(true);

    try {
      const res = await fetch("/api/demo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("Stream failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: accumulated,
            streaming: true,
          };
          return updated;
        });
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: accumulated,
          streaming: false,
        };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Oops, something went wrong. Try again!",
          streaming: false,
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/10">
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-[#3A5FFF] flex items-center justify-center">
            <span className="font-display text-white text-sm" style={{ fontStyle: "italic", fontFamily: "var(--font-bodoni, serif)" }}>D</span>
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#15151f]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>Dopl</p>
          <p className="text-[11px] text-green-400" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ minHeight: 0 }}>
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-[#3A5FFF]/20 flex items-center justify-center flex-shrink-0 mt-1">
                <span style={{ fontFamily: "var(--font-bodoni, serif)", fontStyle: "italic", fontSize: 12, color: "#6B8BFF" }}>D</span>
              </div>
            )}
            <div
              className={`max-w-[78%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed ${
                msg.role === "user"
                  ? "text-white rounded-tr-sm"
                  : "rounded-tl-sm"
              }`}
              style={
                msg.role === "user"
                  ? { background: "#3A5FFF", fontFamily: "var(--font-inter, sans-serif)" }
                  : {
                      background: "#1e1e2e",
                      color: "rgba(255,255,255,0.9)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontFamily: "var(--font-inter, sans-serif)",
                    }
              }
            >
              {msg.content}
              {msg.streaming && msg.content === "" && (
                <span className="flex gap-1 py-0.5">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/40 inline-block" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/40 inline-block" />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-white/40 inline-block" />
                </span>
              )}
              {msg.streaming && msg.content !== "" && (
                <span className="inline-block w-0.5 h-3.5 bg-white/50 ml-0.5 animate-pulse align-middle" />
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/10">
        <div
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 focus-within:border-[#3A5FFF] transition-colors"
          style={{
            background: "#12121c",
            border: "1px solid rgba(255,255,255,0.15)",
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Ask Dopl anything..."
            disabled={loading}
            className="flex-1 bg-transparent text-[15px] text-white/90 placeholder-white/40 outline-none"
            style={{ fontFamily: "var(--font-inter, sans-serif)" }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="w-8 h-8 rounded-lg bg-[#3A5FFF] flex items-center justify-center disabled:opacity-40 hover:bg-[#2a4fef] transition-colors flex-shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Demo Dashboard (sidebar + chat + right panel)
───────────────────────────────────────────────────────── */
function DemoDashboard() {
  return (
    <div className="flex h-full overflow-hidden" style={{ fontFamily: "var(--font-inter, sans-serif)" }}>
      {/* Sidebar */}
      <div
        className="hidden sm:flex flex-col w-[220px] lg:w-[260px] flex-shrink-0 overflow-y-auto"
        style={{
          background: "#0d0d1a",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="font-display text-white text-xl" style={{ fontStyle: "italic", fontFamily: "var(--font-bodoni, serif)" }}>Dopl</span>
        </div>

        {/* Conversations */}
        <div className="px-4 pt-5 pb-2">
          <p className="text-[11px] uppercase tracking-[0.18em] mb-2 px-1" style={{ color: "rgba(255,255,255,0.45)" }}>Conversations</p>
          {[
            { label: "Morning briefing", active: true },
            { label: "Research: AR market size", active: false },
            { label: "Draft email to investors", active: false },
            { label: "Weekly calendar review", active: false },
          ].map((c) => (
            <div
              key={c.label}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg mb-0.5 cursor-pointer ${c.active ? "bg-white/10" : "hover:bg-white/5"}`}
            >
              {c.active && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 pulse-indicator" />}
              <span
                className="text-[13px] truncate"
                style={{ color: c.active ? "white" : "rgba(255,255,255,0.65)" }}
              >
                {c.label}
              </span>
            </div>
          ))}
        </div>

        {/* Integrations */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] uppercase tracking-[0.18em] mb-2 px-1" style={{ color: "rgba(255,255,255,0.45)" }}>Integrations</p>
          {[
            { name: "Google", sub: "Gmail · Calendar", dot: "bg-green-400", badge: "Connected", badgeColor: "text-green-400" },
            { name: "LinkedIn", sub: "Browser", dot: "bg-blue-400", badge: "Browser", badgeColor: "text-blue-400" },
            { name: "Slack", sub: "Workspace", dot: "bg-green-400", badge: "Connected", badgeColor: "text-green-400" },
            { name: "GitHub", sub: "Repositories", dot: "bg-green-400", badge: "Connected", badgeColor: "text-green-400" },
          ].map((intg) => (
            <div key={intg.name} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${intg.dot}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{intg.name}</p>
                <p className="text-[11px] truncate" style={{ color: "rgba(255,255,255,0.45)" }}>{intg.sub}</p>
              </div>
              <span className={`text-[10px] font-medium ${intg.badgeColor}`}>{intg.badge}</span>
            </div>
          ))}
        </div>

        {/* Companion */}
        <div className="mt-auto px-4 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[11px] uppercase tracking-[0.18em] mb-2 px-1" style={{ color: "rgba(255,255,255,0.45)" }}>Companion</p>
          <div className="flex items-center gap-2.5 px-2 py-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0 pulse-indicator" />
            <div>
              <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.85)" }}>MacBook Pro</p>
              <p className="text-[11px] text-green-400">Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0" style={{ background: "#15151f" }}>
        <DemoChat />
      </div>

      {/* Right tasks panel */}
      <div
        className="hidden lg:flex flex-col w-[200px] xl:w-[220px] flex-shrink-0"
        style={{
          background: "#161622",
          borderLeft: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="px-4 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <p className="text-[13px] font-semibold text-white">Active Tasks</p>
        </div>
        <div className="px-3 py-4 space-y-3">
          {[
            { label: "Monitoring inbox", status: "running", color: "text-green-400", dot: "bg-green-400" },
            { label: "LinkedIn profile research", status: "done", color: "text-white/50", dot: "bg-white/30" },
            { label: "Draft weekly report", status: "queued", color: "text-amber-400", dot: "bg-amber-400" },
          ].map((task) => (
            <div
              key={task.label}
              className="rounded-lg p-3"
              style={{
                background: "#1e1e2e",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div className="flex items-start gap-2">
                <span className={`w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${task.dot} ${task.status === "running" ? "pulse-indicator" : ""}`} />
                <div className="min-w-0">
                  <p className="text-[13px] leading-snug truncate" style={{ color: "rgba(255,255,255,0.85)" }}>{task.label}</p>
                  <p className={`text-[11px] mt-0.5 ${task.color}`}>
                    {task.status === "running" ? "● Running" : task.status === "done" ? "✓ Done" : "◷ Queued"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Scroll-Expand Demo Section
───────────────────────────────────────────────────────── */
function ScrollExpandDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const containerH = el.offsetHeight;
      const viewportH = window.innerHeight;
      // progress: 0 when top of container is at bottom of viewport, 1 when we've scrolled 60% of container
      const scrolled = -rect.top;
      const range = containerH - viewportH;
      const p = range > 0 ? Math.min(1, Math.max(0, scrolled / (range * 0.65))) : 0;
      setProgress(p);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Interpolate card styles
  const borderRadius = Math.round(16 * (1 - progress));
  const scaleX = 0.78 + 0.22 * progress;
  const shadowOpacity = Math.max(0.15, 0.4 * (1 - progress * 0.5));
  const cardOpacity = Math.min(1, 0.4 + 0.6 * (progress * 2));
  const glowOpacity = 0.08 + 0.05 * progress;

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: "220vh" }}
    >
      {/* Label above */}
      <div className="absolute top-0 left-0 right-0 flex flex-col items-center pt-16 pointer-events-none z-10">
        <span
          className="inline-block text-[11px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border mb-4"
          style={{
            fontFamily: "var(--font-inter, sans-serif)",
            color: "#6B8BFF",
            borderColor: "#3A5FFF44",
            background: "#3A5FFF11",
          }}
        >
          Live Demo
        </span>
        <h2
          className="text-3xl md:text-4xl lg:text-5xl font-bold text-center text-white px-6"
          style={{ fontFamily: "var(--font-bodoni, serif)", fontStyle: "italic" }}
        >
          See Dopl in action
        </h2>
        <p
          className="mt-4 text-base md:text-lg text-center max-w-md px-6"
          style={{
            fontFamily: "var(--font-inter, sans-serif)",
            color: "rgba(255,255,255,0.65)",
          }}
        >
          Scroll to explore the dashboard — then ask it anything
        </p>
      </div>

      {/* Sticky card */}
      <div
        className="sticky top-0 flex items-center justify-center"
        style={{ height: "100vh" }}
      >
        <div
          style={{
            width: "90vw",
            maxWidth: "1400px",
            height: "86vh",
            maxHeight: "820px",
            transform: `scaleX(${scaleX})`,
            transformOrigin: "center center",
            borderRadius: borderRadius,
            overflow: "hidden",
            boxShadow: `0 0 60px rgba(58,95,255,${glowOpacity}), 0 ${Math.round(32 * (1 - progress))}px ${Math.round(100 * (1 - progress))}px rgba(0,0,0,${shadowOpacity})`,
            opacity: cardOpacity,
            transition: "none",
            willChange: "transform, border-radius, box-shadow",
            background: "#111118",
            border: `1px solid rgba(255,255,255,${0.12 - 0.04 * progress})`,
          }}
        >
          <DemoDashboard />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Feature sections
───────────────────────────────────────────────────────── */
function FeatureSection({
  label,
  labelColor = "#3A5FFF",
  heading,
  description,
  visual,
  reverse = false,
  bg = "#0a0a0f",
}: {
  label: string;
  labelColor?: string;
  heading: string;
  description: string;
  visual: React.ReactNode;
  reverse?: boolean;
  bg?: string;
}) {
  const ref = useScrollReveal();

  return (
    <section
      ref={ref as React.RefObject<HTMLElement>}
      className="py-24 md:py-32 px-6 overflow-hidden"
      style={{
        background: bg,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <div className={`flex flex-col ${reverse ? "lg:flex-row-reverse" : "lg:flex-row"} items-center gap-12 lg:gap-20`}>
          <div className="flex-1 max-w-xl fade-in-up">
            <span
              className="inline-block text-[11px] uppercase tracking-[0.18em] px-3 py-1 rounded-full mb-5"
              style={{
                fontFamily: "var(--font-inter, sans-serif)",
                color: labelColor,
                background: labelColor + "20",
              }}
            >
              {label}
            </span>
            <h2
              className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5"
              style={{ fontFamily: "var(--font-bodoni, serif)", fontStyle: "italic" }}
            >
              {heading}
            </h2>
            <p
              className="text-gray-200 text-lg md:text-xl leading-relaxed"
              style={{ fontFamily: "var(--font-inter, sans-serif)" }}
            >
              {description}
            </p>
          </div>
          <div className="flex-1 w-full fade-in-up stagger-2">
            {visual}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────
   Integration cards visual
───────────────────────────────────────────────────────── */
const INTEGRATIONS = [
  { name: "Gmail", icon: "✉️", color: "#EA4335" },
  { name: "Calendar", icon: "📅", color: "#4285F4" },
  { name: "Slack", icon: "💬", color: "#E01E5A" },
  { name: "LinkedIn", icon: "💼", color: "#0A66C2" },
  { name: "GitHub", icon: "⚙️", color: "#24292e" },
  { name: "Drive", icon: "📁", color: "#34A853" },
  { name: "Notion", icon: "📝", color: "#000000" },
  { name: "Zapier", icon: "⚡", color: "#FF4A00" },
  { name: "HubSpot", icon: "🔗", color: "#FF7A59" },
];

function IntegrationsVisual() {
  return (
    <div
      className="grid grid-cols-3 gap-4 max-w-sm mx-auto"
      style={{
        transform: "scale(1.2)",
        transformOrigin: "center center",
      }}
    >
      {INTEGRATIONS.map((intg) => (
        <div
          key={intg.name}
          className="rounded-xl p-4 flex flex-col items-center gap-2 transition-colors cursor-default"
          style={{
            background: "#1e1e2e",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}
        >
          <span className="text-2xl">{intg.icon}</span>
          <span
            className="text-[11px] font-medium"
            style={{ color: "rgba(255,255,255,0.85)", fontFamily: "var(--font-inter, sans-serif)" }}
          >
            {intg.name}
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Page
───────────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden relative">
      {/* Fixed background image — stays put while everything scrolls over it */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Dark overlay */}
      <div
        className="fixed inset-0 z-0"
        style={{ background: "rgba(0,0,0,0.25)" }}
      />

      {/* ═══ Vertical Grid Lines ═══ */}
      <div className="fixed inset-0 pointer-events-none z-[1]">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${(i / 6) * 100}%`,
              width: "2px",
              background: "rgba(255,255,255,0.08)",
            }}
          />
        ))}
      </div>

      {/* ═══ Hero ═══ */}
      <section
        className="relative z-10 flex flex-col items-start justify-start px-12 md:px-20 pt-20 pb-16"
        style={{ minHeight: "78vh" }}
      >
        {/* Coordinates — top left */}
        <div
          className="absolute top-5 left-5 z-20 hero-animate"
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.15em",
            opacity: 0.4,
            fontFamily: "var(--font-inter, 'Inter', sans-serif)",
            color: "#888",
          }}
        >
          N 37° 46&apos; 29&quot; / W 122° 25&apos; 10&quot;
        </div>

        {/* Logo — center top */}
        <div
          className="absolute top-7 left-1/2 -translate-x-1/2 z-20 hero-animate"
          style={{
            fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 14,
            color: "#18181B",
          }}
        >
          Dopl
        </div>

        {/* ── Nav button floating on image (top-right) ── */}
        <div className="absolute top-5 right-8 z-20 flex items-center gap-3 hero-animate">
          <Link
            href="/login"
            className="transition-all duration-300"
            style={{
              fontFamily: "var(--font-inter, 'Inter', sans-serif)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "0.2em",
              padding: "12px 24px",
              border: "1px solid #18181B",
              borderRadius: 50,
              color: "#18181B",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#18181B"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#18181B"; }}
          >
            Get Access
          </Link>
        </div>

        <div className="relative z-10 max-w-4xl">
          {/* Eyebrow */}
          <div className="hero-animate mb-5">
            <span
              className="block text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{
                fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                color: "#0066FF",
              }}
            >
              Introducing Dopl, your
            </span>
          </div>

          {/* Headline */}
          <h1
            className="hero-animate-1 leading-[0.95] mb-3"
            style={{
              fontSize: "clamp(72px, 10vw, 140px)",
              letterSpacing: "-0.05em",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
                fontStyle: "italic",
                fontWeight: 400,
                color: "#18181B",
                fontSize: "0.85em",
              }}
            >
              Digital
            </div>
            <div
              className="uppercase"
              style={{
                fontWeight: 900,
                fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                WebkitTextStroke: "1px #18181B",
                color: "transparent",
                letterSpacing: "-0.08em",
              }}
            >
              Companion
            </div>
          </h1>

          {/* Content row */}
          <div
            className="hero-animate-2 flex gap-[60px] items-start pb-10 mb-10"
            style={{ marginTop: 40 }}
            style={{ borderBottom: "1px solid rgba(255,255,255,0.15)" }}
          >
            <div className="flex-1">
              {/* Body */}
              <p
                className="max-w-[480px]"
                style={{
                  fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Dopl is the always-on intelligent twin that works so you don&apos;t. Leverage the full power of OpenClaw with zero setup — just connect your accounts and let your agent operate. <strong style={{ color: "rgba(255,255,255,0.9)" }}>Get started free.</strong>
              </p>
            </div>

            {/* CTA group */}
            <div className="flex-1 flex flex-col">
              <Link
                href="/login"
                className="flex items-center justify-center hover:opacity-90 transition-colors"
                style={{
                  fontFamily: "'Courier New', Courier, monospace",
                  fontSize: 12,
                  fontWeight: 400,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.1em",
                  background: "#18181B",
                  color: "white",
                  height: 50,
                  width: "100%",
                  textDecoration: "none",
                }}
              >
                Get Access
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="hero-animate-4 absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "rgba(255,255,255,0.45)", fontFamily: "var(--font-roboto, sans-serif)" }}
          >
            Scroll
          </span>
          <div className="w-px h-8 bg-gradient-to-b from-white/30 to-transparent" />
        </div>
      </section>

      {/* ═══ Demo Section ═══ */}
      <div id="demo" className="relative z-10">
        <ScrollExpandDemo />
      </div>

      {/* ═══ Footer ═══ */}
      <footer className="relative z-10 bg-[#1A1A1A]" role="contentinfo">
        <div className="relative overflow-hidden">

          {/* Giant DOPL background text */}
          <p
            className="pointer-events-none absolute bottom-0 left-0 top-0 flex select-none items-center font-black uppercase text-[#222]"
            style={{ fontSize: "clamp(150px, 30vw, 380px)", lineHeight: 0.8 }}
            aria-hidden="true"
          >
            DOPL
          </p>

          <div className="relative z-10 mx-auto max-w-screen-xl px-4 py-16 md:px-6">
            <div className="flex flex-col gap-16 md:flex-row md:items-start md:justify-between">

              {/* Left: CTA */}
              <div>
                <h2 className="text-5xl font-light leading-tight tracking-tight text-white md:text-6xl">
                  Have an idea?
                </h2>
                <p className="font-[family-name:var(--font-playfair)] text-5xl italic font-light text-[#666] md:text-6xl">
                  Let&apos;s build it.
                </p>
                <a
                  href="mailto:hello@usedopl.com"
                  className="mt-8 inline-flex items-center gap-2 border-b border-white pb-1 font-mono text-[18px] text-white transition-colors hover:border-[#3A5FFF] hover:text-[#3A5FFF]"
                >
                  hello@usedopl.com
                  <span className="text-[15px]" aria-hidden="true">↗</span>
                </a>
              </div>

              {/* Right: columns */}
              <div className="flex gap-16 md:gap-20">

                {/* Connect */}
                <nav aria-label="Social links">
                  <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#555]">
                    [ Connect ]
                  </p>
                  <ul className="space-y-3.5">
                    {[
                      { label: "Twitter / X", href: "https://twitter.com/usedopl" },
                      { label: "LinkedIn", href: "https://linkedin.com/company/usedopl" },
                      { label: "GitHub", href: "https://github.com/usedopl" },
                      { label: "Discord", href: "#" },
                    ].map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="font-mono text-[13px] text-[#888] transition-colors hover:text-white"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* Navigate */}
                <nav aria-label="Site navigation">
                  <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#555]">
                    [ Navigate ]
                  </p>
                  <ul className="space-y-3.5">
                    {[
                      { label: "Home", href: "/" },
                      { label: "Features", href: "#features" },
                      { label: "Demo", href: "#demo" },
                      { label: "Sign In", href: "/login" },
                    ].map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="font-mono text-[13px] text-[#888] transition-colors hover:text-white"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                {/* Legal */}
                <nav aria-label="Legal links">
                  <p className="mb-6 font-mono text-[10px] uppercase tracking-[0.2em] text-[#555]">
                    [ Legal ]
                  </p>
                  <ul className="space-y-3.5">
                    {[
                      { label: "Terms of Service", href: "/terms" },
                      { label: "Privacy Policy", href: "/privacy" },
                    ].map((item) => (
                      <li key={item.label}>
                        <Link
                          href={item.href}
                          className="font-mono text-[13px] text-[#888] transition-colors hover:text-white"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
