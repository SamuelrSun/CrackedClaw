"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
   GlassText — backdrop-blur visible through letter shapes
───────────────────────────────────────────────────────── */
function GlassText({ children, className, style }: { children: string; className?: string; style?: React.CSSProperties }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [maskUrl, setMaskUrl] = useState<string>("");

  useEffect(() => {
    const generate = () => {
      const textEl = textRef.current;
      if (!textEl) return;

      const rect = textEl.getBoundingClientRect();
      if (rect.width === 0) return;

      const dpr = window.devicePixelRatio || 1;
      const canvas = document.createElement("canvas");
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      const computed = getComputedStyle(textEl);
      ctx.font = `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`;
      ctx.fillStyle = "white";
      ctx.textBaseline = "top";

      const letterSpacing = parseFloat(computed.letterSpacing) || 0;
      const text = children;
      let x = 0;
      for (const char of text) {
        ctx.fillText(char, x, 0);
        x += ctx.measureText(char).width + letterSpacing;
      }

      setMaskUrl(canvas.toDataURL());
    };

    document.fonts.ready.then(generate);

    const observer = new ResizeObserver(generate);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div ref={containerRef} className={className} style={{ position: "relative", ...style }}>
      {/* Hidden text for layout sizing */}
      <div
        ref={textRef}
        aria-hidden="true"
        style={{
          visibility: "hidden",
          fontWeight: 900,
          fontFamily: "var(--font-inter, 'Inter', sans-serif)",
          letterSpacing: "-0.08em",
          textTransform: "uppercase",
          fontSize: "inherit",
          lineHeight: "inherit",
        }}
      >
        {children}
      </div>

      {/* Backdrop blur layer masked to text shape */}
      {maskUrl && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0, 0, 0, 0.07)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            WebkitMaskImage: `url(${maskUrl})`,
            maskImage: `url(${maskUrl})`,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      )}

      {/* Visible stroke outline */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          fontWeight: 900,
          fontFamily: "var(--font-inter, 'Inter', sans-serif)",
          WebkitTextStroke: "1px rgba(255, 255, 255, 0.1)",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          letterSpacing: "-0.08em",
          textTransform: "uppercase",
          fontSize: "inherit",
          lineHeight: "inherit",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Demo Chat Component
───────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────
   Video Demo Placeholder
───────────────────────────────────────────────────────── */
function DemoVideo() {
  return (
    <div className="relative z-10 py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <div
          className="relative overflow-hidden"
          style={{
            aspectRatio: "16/9",
            background: "#111118",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          {/* Replace src with actual demo video */}
          <video
            className="w-full h-full object-cover"
            poster=""
            controls
            playsInline
          >
            {/* <source src="/video/demo.mp4" type="video/mp4" /> */}
          </video>
          {/* Placeholder overlay — remove when video is added */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-6"
              style={{ border: "2px solid rgba(255,255,255,0.3)" }}
            >
              <span className="text-3xl ml-1">▶</span>
            </div>
            <p
              className="text-sm uppercase tracking-[0.2em]"
              style={{
                fontFamily: "var(--font-inter, sans-serif)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              Demo Video Coming Soon
            </p>
          </div>
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
      className="grid grid-cols-3 gap-2 sm:gap-4 max-w-sm mx-auto"
      style={{
        transform: "scale(1)",
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


      {/* Vertical grid lines removed */}

      {/* ═══ Hero ═══ */}
      <section
        className="relative z-10 flex flex-col items-start justify-start px-6 sm:px-12 md:px-20 pt-16 sm:pt-20 pb-12 sm:pb-16"
        style={{ minHeight: "78vh" }}
      >
        {/* Coordinates — top left */}
        <div
          className="absolute top-5 left-5 z-20 hero-animate hidden sm:block"
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
          className="absolute top-7 left-1/2 -translate-x-1/2 z-20 hero-animate text-xl font-bold"
          style={{
            fontFamily: "var(--font-playfair, 'Playfair Display', serif)",
            fontStyle: "italic",
            color: "#18181B",
          }}
        >
          Dopl
        </div>

        {/* ── Nav button floating on image (top-right) ── */}
        <div className="absolute top-4 right-4 sm:top-5 sm:right-8 z-20 flex items-center gap-3 hero-animate">
          <Link
            href="/welcome"
            className="transition-all duration-300"
            style={{
              fontFamily: "var(--font-inter, 'Inter', sans-serif)",
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase" as const,
              letterSpacing: "0.2em",
              padding: "12px 24px",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: 3,
              color: "white",
              textDecoration: "none",
              background: "rgba(0, 0, 0, 0.07)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.07)"; }}
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
            <GlassText
              style={{
                fontSize: "inherit",
                lineHeight: "inherit",
              }}
            >
              Companion
            </GlassText>
          </h1>

          {/* Body + CTA */}
          <div className="hero-animate-2" style={{ marginTop: 40 }}>
              <p
                className="max-w-[480px] mb-8"
                style={{
                  fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.7)",
                }}
              >
                Dopl is the always-on intelligent twin that works so you don&apos;t. Leverage the full power of OpenClaw with zero setup — just connect your accounts and let your agent operate.
              </p>
              <Link
                href="/welcome"
                className="inline-block transition-all duration-300"
                style={{
                  fontFamily: "var(--font-inter, 'Inter', sans-serif)",
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase" as const,
                  letterSpacing: "0.2em",
                  padding: "14px 32px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 3,
                  color: "white",
                  background: "rgba(0, 0, 0, 0.07)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0, 0, 0, 0.07)"; }}
              >
                Get Access
              </Link>
          </div>
        </div>

        {/* Scroll indicator removed */}
      </section>

      {/* ═══ Demo Section ═══ */}
      <div id="demo" className="relative z-10">
        <DemoVideo />
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
              <div className="flex flex-wrap gap-10 sm:gap-16 md:gap-20">

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
                      { label: "Sign In", href: "/welcome" },
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
