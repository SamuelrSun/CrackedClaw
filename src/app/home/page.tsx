import LandingChat from "@/components/landing/LandingChat";

export const dynamic = 'force-dynamic';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
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

      {/* Main — centered chat panel */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg" style={{ height: "min(600px, calc(100vh - 140px))" }}>
          <LandingChat />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[rgba(58,58,56,0.15)] px-6 py-4 flex-shrink-0">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <span className="font-mono text-[10px] text-grid/40 uppercase tracking-wide">CrackedClaw © 2026</span>
          <div className="flex gap-4">
            {["Browse", "Automate", "Integrate", "Remember"].map((f) => (
              <span key={f} className="font-mono text-[10px] text-grid/35 uppercase tracking-wide">{f}</span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
