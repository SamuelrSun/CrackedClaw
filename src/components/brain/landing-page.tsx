'use client';

import Link from 'next/link';

// ─── Platform logos (simple text-based, no external assets needed) ───────────

const PLATFORMS = [
  { name: 'Claude Code', icon: '⌘' },
  { name: 'Cursor', icon: '▶' },
  { name: 'VS Code', icon: '◆' },
  { name: 'ChatGPT', icon: '◉' },
  { name: 'OpenClaw', icon: '🦞' },
  { name: 'Any MCP Client', icon: '⚡' },
];

const STEPS = [
  {
    number: '01',
    title: 'Sign up & get your Brain',
    description: 'Your brain starts learning from day one. Every conversation adds to what it knows about you.',
  },
  {
    number: '02',
    title: 'Connect your tools',
    description: 'One-click MCP setup for Claude Code, Cursor, VS Code, ChatGPT, and more.',
  },
  {
    number: '03',
    title: 'Your AI knows you everywhere',
    description: 'Same preferences, memories, and context across every tool. No more repeating yourself.',
  },
];

const FEATURES = [
  {
    title: 'Learns from every conversation',
    description: 'Extracts facts, preferences, and patterns automatically from your interactions.',
    icon: '🧠',
  },
  {
    title: 'Works everywhere via MCP',
    description: 'Universal protocol supported by all major AI tools. One brain, every client.',
    icon: '🔗',
  },
  {
    title: 'Your data, your control',
    description: 'View, edit, and export your brain anytime. Full transparency into what it knows.',
    icon: '🔒',
  },
  {
    title: 'Gets smarter over time',
    description: 'Behavioral signals improve preferences continuously. The more you use it, the better it gets.',
    icon: '📈',
  },
];

// ─── Landing Page ────────────────────────────────────────────────────────────

export function BrainLandingPage() {
  const ctaHref = '/welcome?intent=brain';

  return (
    <div
      className="min-h-screen text-white"
      style={{
        backgroundColor: '#0a0a0f',
        backgroundImage: "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('/img/landing_background.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ── Minimal top bar ── */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
          >
            Dopl
          </span>
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/40 mt-1">
            Brain
          </span>
        </Link>
        <Link
          href={ctaHref}
          className="font-mono text-[10px] uppercase tracking-wide px-4 py-2 bg-white/[0.1] hover:bg-white/[0.15] border border-white/[0.15] text-white transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero ── */}
      <section className="px-6 pt-20 pb-24 md:pt-32 md:pb-32 max-w-4xl mx-auto text-center">
        <div className="inline-block mb-6">
          <span className="font-mono text-[10px] uppercase tracking-widest text-white/40 px-3 py-1.5 border border-white/[0.1] bg-white/[0.05]">
            Portable AI Memory
          </span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 leading-[1.1]">
          Your AI Brain
        </h1>
        <p
          className="text-xl md:text-2xl text-white/60 font-light mb-3"
          style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}
        >
          One memory. Every tool.
        </p>
        <p className="text-sm md:text-base text-white/40 max-w-2xl mx-auto leading-relaxed mb-10">
          Build a personal AI brain that learns from your conversations and works with
          Claude Code, Cursor, VS Code, ChatGPT, and more.
        </p>
        <Link
          href={ctaHref}
          className="inline-block px-8 py-3 bg-white text-black font-mono text-[11px] uppercase tracking-wide font-medium hover:bg-white/90 transition-colors"
        >
          Get Started Free →
        </Link>
      </section>

      {/* ── Platforms ── */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30 text-center mb-8">
          Works with your favorite AI tools
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className="flex flex-col items-center gap-2 py-4 px-3 bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] transition-colors"
            >
              <span className="text-xl">{p.icon}</span>
              <span className="font-mono text-[9px] text-white/50 text-center leading-tight">
                {p.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="px-6 py-20 md:py-28 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40 text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {STEPS.map((step) => (
              <div key={step.number} className="space-y-3">
                <span className="font-mono text-[10px] text-white/20">{step.number}</span>
                <h3 className="text-base font-medium text-white/85">{step.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 md:py-28 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-white/40 text-center mb-12">
            Features
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="p-5 bg-white/[0.03] border border-white/[0.06] space-y-2 hover:border-white/[0.12] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{f.icon}</span>
                  <h3 className="text-sm font-medium text-white/80">{f.title}</h3>
                </div>
                <p className="text-xs text-white/40 leading-relaxed pl-8">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="px-6 py-24 md:py-32 border-t border-white/[0.06] text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-4">
          Give your AI a memory
        </h2>
        <p className="text-sm text-white/40 max-w-md mx-auto mb-8">
          Stop repeating yourself to every AI tool. Your Brain remembers everything, everywhere.
        </p>
        <Link
          href={ctaHref}
          className="inline-block px-8 py-3 bg-white text-black font-mono text-[11px] uppercase tracking-wide font-medium hover:bg-white/90 transition-colors"
        >
          Get Your Brain →
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer className="px-6 py-8 border-t border-white/[0.06]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="font-mono text-[9px] text-white/25 uppercase tracking-wide">
            © 2026 Dopl
          </span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="font-mono text-[9px] text-white/25 hover:text-white/50 uppercase tracking-wide transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="font-mono text-[9px] text-white/25 hover:text-white/50 uppercase tracking-wide transition-colors">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
