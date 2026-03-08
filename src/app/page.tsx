import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RootPage() {
  // Check auth
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/chat");
  }

  // Not authenticated — show landing page
  return (
    <div className="min-h-screen bg-paper text-forest font-body">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-forest/10">
        <span className="font-header text-xl font-bold tracking-tight">CrackedClaw</span>
        <Link
          href="/login"
          className="font-mono text-[11px] uppercase tracking-wide border border-forest/30 px-4 py-2 hover:bg-forest hover:text-white transition-colors"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center justify-center text-center px-6 py-24 mosaic-bg">
        <div className="w-16 h-16 bg-forest mb-8 flex items-center justify-center">
          <span className="text-white font-header text-2xl font-bold">CC</span>
        </div>
        <h1 className="font-header text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-6 max-w-2xl">
          Your AI agent,<br />in the cloud
        </h1>
        <p className="font-mono text-[13px] text-grid/70 max-w-lg mb-10 leading-relaxed">
          CrackedClaw gives you a personal AI that actually does things — browses the
          web, connects your tools, remembers everything.
        </p>
        <Link
          href="/login"
          className="bg-forest text-white font-mono text-[12px] uppercase tracking-wide px-8 py-3 hover:bg-forest/90 transition-colors"
        >
          Get Started Free →
        </Link>
      </section>

      {/* Features */}
      <section className="px-6 py-20 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-forest/10">
          <div className="bg-paper p-8">
            <div className="w-12 h-12 bg-mint/30 flex items-center justify-center mb-4 text-2xl">
              🌐
            </div>
            <h3 className="font-header text-lg font-bold mb-2">Browser automation</h3>
            <p className="font-mono text-[11px] text-grid/60 leading-relaxed">
              Your agent navigates the web, fills forms, and automates any task with a UI
            </p>
          </div>
          <div className="bg-paper p-8">
            <div className="w-12 h-12 bg-gold/30 flex items-center justify-center mb-4 text-2xl">
              🔗
            </div>
            <h3 className="font-header text-lg font-bold mb-2">Connects everything</h3>
            <p className="font-mono text-[11px] text-grid/60 leading-relaxed">
              Gmail, Sheets, LinkedIn, Twilio — if it has an API or a web UI, your agent can use it
            </p>
          </div>
          <div className="bg-paper p-8">
            <div className="w-12 h-12 bg-coral/30 flex items-center justify-center mb-4 text-2xl">
              🧠
            </div>
            <h3 className="font-header text-lg font-bold mb-2">Remembers across sessions</h3>
            <p className="font-mono text-[11px] text-grid/60 leading-relaxed">
              Your agent builds a persistent memory of your preferences, credentials, and context
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-forest/10 px-6 py-6 text-center">
        <p className="font-mono text-[10px] text-grid/40 uppercase tracking-wide">
          CrackedClaw © 2026
        </p>
      </footer>
    </div>
  );
}
