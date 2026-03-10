"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

export const dynamic = "force-dynamic";

/* ─── Intersection Observer hook for scroll animations ─── */
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    el.querySelectorAll(".fade-in-up").forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, []);
  return ref;
}

/* ─── Data ─── */
const features = [
  {
    label: "Browser",
    title: "Browser Automation",
    desc: "Navigates the web, fills forms, clicks buttons — automates any UI without a single line of code.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <circle cx="6.5" cy="6" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="9" cy="6" r="0.8" fill="currentColor" stroke="none" />
        <circle cx="11.5" cy="6" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Connect",
    title: "Connects Everything",
    desc: "Gmail, Sheets, LinkedIn, any API or web UI — one agent, infinite integrations.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="3" />
        <circle cx="4" cy="6" r="2" />
        <circle cx="20" cy="6" r="2" />
        <circle cx="4" cy="18" r="2" />
        <circle cx="20" cy="18" r="2" />
        <line x1="9.5" y1="10" x2="5.5" y2="7.5" />
        <line x1="14.5" y1="10" x2="18.5" y2="7.5" />
        <line x1="9.5" y1="14" x2="5.5" y2="16.5" />
        <line x1="14.5" y1="14" x2="18.5" y2="16.5" />
      </svg>
    ),
  },
  {
    label: "Memory",
    title: "Persistent Memory",
    desc: "Learns your preferences, contacts, and patterns. Builds context across every session.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 2C6.48 2 2 6 2 10.5c0 2.5 1.5 4.5 3 6v5.5l3.5-2.5c1 .3 2.2.5 3.5.5 5.52 0 10-4 10-8.5S17.52 2 12 2z" />
        <circle cx="8" cy="10.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="12" cy="10.5" r="1" fill="currentColor" stroke="none" />
        <circle cx="16" cy="10.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Agents",
    title: "Subagent Workforce",
    desc: "Spawn multiple agents working concurrently. Parallelize research, outreach, and operations.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="7" r="3" />
        <circle cx="5" cy="17" r="2.5" />
        <circle cx="19" cy="17" r="2.5" />
        <line x1="10" y1="9.5" x2="6.5" y2="15" />
        <line x1="14" y1="9.5" x2="17.5" y2="15" />
      </svg>
    ),
  },
  {
    label: "Messaging",
    title: "Message Anywhere",
    desc: "Command your AI via WhatsApp, iMessage, or Discord. Your agent is always one text away.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <line x1="8" y1="9" x2="16" y2="9" />
        <line x1="8" y1="13" x2="13" y2="13" />
      </svg>
    ),
  },
  {
    label: "Desktop",
    title: "Desktop Control",
    desc: "Our companion app gives AI full access to your computer — mouse, keyboard, screen, everything.",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="1" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
];

const steps = [
  { num: "01", title: "Sign up", desc: "Create your free account in seconds. No credit card required." },
  { num: "02", title: "Connect your tools", desc: "Link Gmail, Sheets, LinkedIn, or any service your agent needs." },
  { num: "03", title: "Let your AI work", desc: "Tell it what to do in plain language. Watch it execute autonomously." },
];

const testimonials = [
  {
    quote: "CrackedClaw replaced three SaaS tools and an intern. It just handles things.",
    name: "Alex Chen",
    role: "Founder, Stealth Startup",
  },
  {
    quote: "I message my agent on WhatsApp and it books meetings, writes follow-ups, researches prospects. Insane.",
    name: "Priya Sharma",
    role: "Head of Sales, ScaleOps",
  },
  {
    quote: "The browser automation alone is worth 10x the price. It does things Zapier can't even dream of.",
    name: "Marcus Webb",
    role: "Operations Lead, Fintech Co",
  },
];

/* ─── Component ─── */
export default function LandingPage() {
  const featuresRef = useScrollReveal();
  const howRef = useScrollReveal();
  const pricingRef = useScrollReveal();
  const proofRef = useScrollReveal();
  const ctaRef = useScrollReveal();

  return (
    <div className="min-h-screen flex flex-col">
      {/* ═══ Header ═══ */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-paper/90 backdrop-blur-sm border-b border-[rgba(58,58,56,0.1)]">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="font-header text-lg font-bold text-forest tracking-tight">
            CrackedClaw
          </Link>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="font-mono text-[10px] uppercase tracking-widest text-grid/50 hover:text-forest transition-colors">
              Features
            </a>
            <a href="#how" className="font-mono text-[10px] uppercase tracking-widest text-grid/50 hover:text-forest transition-colors">
              How it works
            </a>
            <a href="#pricing" className="font-mono text-[10px] uppercase tracking-widest text-grid/50 hover:text-forest transition-colors">
              Pricing
            </a>
          </nav>
          <Link
            href="/login"
            className="font-mono text-[10px] uppercase tracking-widest border border-[rgba(58,58,56,0.25)] px-5 py-2 text-forest hover:bg-forest hover:text-paper transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* ═══ Hero ═══ */}
      <section className="relative pt-32 pb-24 md:pt-44 md:pb-32 px-6 overflow-hidden">
        {/* Animated grid background */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(26,60,43,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(26,60,43,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "48px 48px",
          }} />
          {/* Floating accent dots */}
          {[
            { top: "15%", left: "10%", delay: "0s", size: 6 },
            { top: "25%", right: "15%", delay: "1.5s", size: 4 },
            { top: "60%", left: "20%", delay: "0.8s", size: 5 },
            { top: "45%", right: "10%", delay: "2s", size: 3 },
            { top: "70%", right: "25%", delay: "0.5s", size: 4 },
          ].map((dot, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                top: dot.top,
                left: dot.left,
                right: dot.right,
                width: dot.size,
                height: dot.size,
                backgroundColor: i % 2 === 0 ? "#FF8C69" : "#9EFFBF",
                opacity: 0.35,
                animation: `float 4s ease-in-out ${dot.delay} infinite`,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <div className="hero-animate">
            <span className="inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-coral mb-6 border border-coral/25 px-3 py-1">
              AI Agent Platform
            </span>
          </div>
          <h1 className="hero-animate-delay-1 font-header text-5xl md:text-7xl font-bold text-forest leading-[1.05] tracking-tight mb-6">
            Your AI agent,
            <br />
            <span className="text-coral">in the cloud</span>
          </h1>
          <p className="hero-animate-delay-2 text-lg md:text-xl text-grid/60 leading-relaxed mb-10 max-w-xl mx-auto">
            Autonomous AI that connects your tools, browses the web, and remembers everything — so you can stop doing busywork forever.
          </p>
          <div className="hero-animate-delay-3 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-block bg-forest text-paper font-mono text-[11px] uppercase tracking-widest px-10 py-4 hover:bg-forest/90 transition-colors"
            >
              Get Started Free
            </Link>
            <a
              href="#how"
              className="inline-block font-mono text-[11px] uppercase tracking-widest text-forest/60 px-6 py-4 hover:text-forest transition-colors"
            >
              See how it works &darr;
            </a>
          </div>
        </div>

        {/* Product mockup — CSS-only dashboard wireframe */}
        <div className="hero-animate-delay-3 relative max-w-4xl mx-auto mt-16 md:mt-24">
          <div className="border border-[rgba(26,60,43,0.12)] bg-white/60 backdrop-blur-sm overflow-hidden">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[rgba(26,60,43,0.08)]">
              <div className="w-2 h-2 rounded-full bg-coral/50" />
              <div className="w-2 h-2 rounded-full bg-gold/50" />
              <div className="w-2 h-2 rounded-full bg-mint/50" />
              <div className="flex-1 mx-8">
                <div className="max-w-[200px] mx-auto h-3 bg-forest/5 rounded-sm" />
              </div>
            </div>
            {/* Dashboard content */}
            <div className="flex min-h-[240px] md:min-h-[320px]">
              {/* Sidebar */}
              <div className="hidden md:flex flex-col w-48 border-r border-[rgba(26,60,43,0.08)] p-4 gap-3">
                <div className="h-3 w-24 bg-forest/10 rounded-sm" />
                <div className="h-3 w-20 bg-forest/5 rounded-sm" />
                <div className="h-3 w-28 bg-forest/5 rounded-sm" />
                <div className="h-3 w-16 bg-forest/5 rounded-sm" />
                <div className="mt-auto h-3 w-20 bg-coral/15 rounded-sm" />
              </div>
              {/* Main area */}
              <div className="flex-1 p-4 md:p-6">
                {/* Chat messages mockup */}
                <div className="space-y-4">
                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-forest/10 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-3/4 bg-forest/8 rounded-sm" />
                      <div className="h-3 w-1/2 bg-forest/6 rounded-sm" />
                    </div>
                  </div>
                  <div className="flex gap-3 items-start justify-end">
                    <div className="space-y-1.5 flex-1 flex flex-col items-end">
                      <div className="h-3 w-2/3 bg-coral/12 rounded-sm" />
                      <div className="h-3 w-1/3 bg-coral/8 rounded-sm" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-coral/15 flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-forest/10 flex-shrink-0 mt-0.5" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-3 w-5/6 bg-forest/8 rounded-sm" />
                      <div className="h-3 w-2/3 bg-forest/6 rounded-sm" />
                      <div className="h-3 w-1/4 bg-forest/4 rounded-sm" />
                    </div>
                  </div>
                  {/* Typing indicator */}
                  <div className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-mint/20 flex-shrink-0 mt-0.5" />
                    <div className="flex gap-1 items-center py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-forest/20" style={{ animation: "float 1.2s ease-in-out infinite" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-forest/20" style={{ animation: "float 1.2s ease-in-out 0.2s infinite" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-forest/20" style={{ animation: "float 1.2s ease-in-out 0.4s infinite" }} />
                    </div>
                  </div>
                </div>
                {/* Input bar */}
                <div className="mt-6 flex items-center gap-3 border border-[rgba(26,60,43,0.1)] p-2.5">
                  <div className="flex-1 h-3 bg-forest/4 rounded-sm" />
                  <div className="w-16 h-6 bg-forest/8 rounded-sm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" ref={featuresRef} className="px-6 py-20 md:py-28 border-t border-[rgba(58,58,56,0.1)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 fade-in-up">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">Capabilities</span>
            <h2 className="font-header text-3xl md:text-4xl font-bold text-forest mt-3 tracking-tight">
              Everything your AI agent can do
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[rgba(58,58,56,0.08)]">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`fade-in-up stagger-${i + 1} bg-paper p-8 group hover:bg-forest/[0.02] transition-colors`}
              >
                <div className="text-forest/40 mb-5 group-hover:text-coral transition-colors">
                  {f.icon}
                </div>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-coral/70 block mb-2">
                  {f.label}
                </span>
                <h3 className="font-header text-base font-bold text-forest mb-2 tracking-tight">{f.title}</h3>
                <p className="text-[13px] text-grid/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section id="how" ref={howRef} className="px-6 py-20 md:py-28 border-t border-[rgba(58,58,56,0.1)] bg-forest">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 fade-in-up">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">Process</span>
            <h2 className="font-header text-3xl md:text-4xl font-bold text-paper mt-3 tracking-tight">
              Three steps. That&apos;s it.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0">
            {steps.map((s, i) => (
              <div key={s.num} className={`fade-in-up stagger-${i + 1} relative text-center md:text-left px-6 md:px-8`}>
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-8 right-0 w-px h-16 bg-paper/10" />
                )}
                <span className="font-mono text-[10px] tracking-[0.2em] text-coral block mb-3">{s.num}</span>
                <h3 className="font-header text-xl font-bold text-paper mb-2 tracking-tight">{s.title}</h3>
                <p className="text-[13px] text-paper/50 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Pricing ═══ */}
      <section id="pricing" ref={pricingRef} className="px-6 py-20 md:py-28 border-t border-[rgba(58,58,56,0.1)]">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 fade-in-up">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">Pricing</span>
            <h2 className="font-header text-3xl md:text-4xl font-bold text-forest mt-3 tracking-tight">
              Simple, transparent pricing
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[rgba(58,58,56,0.08)] max-w-3xl mx-auto">
            {/* Free */}
            <div className="fade-in-up stagger-1 bg-paper p-8 md:p-10">
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-grid/40 block mb-1">Free</span>
              <div className="font-header text-4xl font-bold text-forest mb-1">$0</div>
              <span className="text-[13px] text-grid/40">forever</span>
              <ul className="mt-8 space-y-3">
                {["100 messages / day", "3 integrations", "1 agent", "Community support"].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-grid/60">
                    <span className="text-mint mt-0.5 text-xs">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block text-center mt-8 font-mono text-[10px] uppercase tracking-widest border border-[rgba(58,58,56,0.2)] px-6 py-3 text-forest hover:bg-forest hover:text-paper transition-colors"
              >
                Get Started
              </Link>
            </div>
            {/* Pro */}
            <div className="fade-in-up stagger-2 bg-paper p-8 md:p-10 border-l border-[rgba(58,58,56,0.08)]">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-coral block">Pro</span>
                <span className="font-mono text-[8px] uppercase tracking-widest bg-coral/10 text-coral px-2 py-0.5">Popular</span>
              </div>
              <div className="font-header text-4xl font-bold text-forest mb-1">$29</div>
              <span className="text-[13px] text-grid/40">/ month</span>
              <ul className="mt-8 space-y-3">
                {[
                  "Unlimited messages",
                  "Unlimited integrations",
                  "Unlimited agents",
                  "Browser automation",
                  "Desktop companion",
                  "Priority support",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-grid/60">
                    <span className="text-coral mt-0.5 text-xs">&#10003;</span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block text-center mt-8 font-mono text-[10px] uppercase tracking-widest bg-forest text-paper px-6 py-3 hover:bg-forest/90 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Social Proof ═══ */}
      <section ref={proofRef} className="px-6 py-20 md:py-28 border-t border-[rgba(58,58,56,0.1)]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 fade-in-up">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-coral">Testimonials</span>
            <h2 className="font-header text-3xl md:text-4xl font-bold text-forest mt-3 tracking-tight">
              Loved by operators
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[rgba(58,58,56,0.08)]">
            {testimonials.map((t, i) => (
              <div key={t.name} className={`fade-in-up stagger-${i + 1} bg-paper p-8`}>
                <p className="text-[14px] text-grid/70 leading-relaxed mb-6 italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <span className="font-header text-sm font-bold text-forest block">{t.name}</span>
                  <span className="font-mono text-[10px] text-grid/40 uppercase tracking-wide">{t.role}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Final CTA ═══ */}
      <section ref={ctaRef} className="px-6 py-20 md:py-28 border-t border-[rgba(58,58,56,0.1)] bg-forest">
        <div className="max-w-3xl mx-auto text-center fade-in-up">
          <h2 className="font-header text-3xl md:text-5xl font-bold text-paper leading-tight tracking-tight mb-6">
            Ready to 10x
            <br />
            your productivity?
          </h2>
          <p className="text-paper/50 text-[15px] mb-10 max-w-md mx-auto leading-relaxed">
            Join thousands of operators who automated their busywork with CrackedClaw.
          </p>
          <Link
            href="/login"
            className="inline-block bg-coral text-forest font-mono text-[11px] uppercase tracking-widest px-10 py-4 hover:bg-coral/90 transition-colors font-bold"
          >
            Get Started Free
          </Link>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer className="border-t border-[rgba(58,58,56,0.1)] px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <span className="font-header text-base font-bold text-forest tracking-tight block mb-2">CrackedClaw</span>
              <span className="font-mono text-[10px] text-grid/35 uppercase tracking-wide">Your AI agent, in the cloud</span>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              {[
                { label: "Privacy", href: "/privacy" },
                { label: "Terms", href: "/terms" },
                { label: "Docs", href: "#" },
                { label: "Blog", href: "#" },
                { label: "Discord", href: "#" },
              ].map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="font-mono text-[10px] uppercase tracking-widest text-grid/40 hover:text-forest transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-[rgba(58,58,56,0.08)]">
            <span className="font-mono text-[10px] text-grid/30 uppercase tracking-wide">
              &copy; 2026 CrackedClaw. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
