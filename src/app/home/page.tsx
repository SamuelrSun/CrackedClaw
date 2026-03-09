import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-[rgba(58,58,56,0.15)] px-6 py-4 flex items-center justify-between">
        <span className="font-header text-lg font-bold text-forest tracking-tight">CrackedClaw</span>
        <Link
          href="/login"
          className="font-mono text-[11px] uppercase tracking-wide border border-[rgba(58,58,56,0.3)] px-4 py-2 text-forest hover:bg-forest hover:text-white transition-colors"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-2xl">
          <h1 className="font-header text-5xl font-bold text-forest leading-tight mb-6">
            Your AI agent,<br />in the cloud
          </h1>
          <p className="text-lg text-grid/70 leading-relaxed mb-10 max-w-xl mx-auto">
            CrackedClaw gives you a personal AI that actually does things — browses the web, connects your tools, and remembers everything across sessions.
          </p>
          <Link
            href="/login"
            className="inline-block bg-forest text-white font-mono text-[11px] uppercase tracking-wide px-8 py-3 hover:bg-forest/90 transition-colors"
          >
            Get Started Free →
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="border-t border-[rgba(58,58,56,0.15)] px-6 py-16">
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
