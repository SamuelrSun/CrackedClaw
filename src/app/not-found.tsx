import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found — Dopl",
};

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-[#0a0a0f]">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="w-12 h-12 bg-white/[0.1] border border-white/[0.2] mx-auto mb-4 flex items-center justify-center">
          <span className="text-white font-header text-lg font-bold">D</span>
        </div>

        <h1 className="font-header text-4xl font-bold text-white/90 mb-2">404</h1>
        <p className="font-header text-xl font-bold text-white/80 mb-2">Page Not Found</p>
        <p className="font-mono text-[11px] text-white/40 uppercase tracking-wide mb-8">
          The page you&apos;re looking for doesn&apos;t exist
        </p>

        <div className="border border-white/[0.1] bg-white/[0.06] backdrop-blur-md p-6 space-y-3">
          <Link
            href="/"
            className="block w-full px-4 py-2.5 bg-white/[0.12] text-white font-mono text-[11px] uppercase tracking-wide hover:bg-white/[0.2] transition-colors text-center"
          >
            Go Home
          </Link>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Link
              href="/chat"
              className="px-3 py-2 border border-white/[0.1] font-mono text-[10px] uppercase tracking-wide text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors text-center"
            >
              Chat
            </Link>
            <Link
              href="/integrations"
              className="px-3 py-2 border border-white/[0.1] font-mono text-[10px] uppercase tracking-wide text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors text-center"
            >
              Integrations
            </Link>
            <Link
              href="/settings"
              className="px-3 py-2 border border-white/[0.1] font-mono text-[10px] uppercase tracking-wide text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors text-center"
            >
              Settings
            </Link>
            <Link
              href="/memory"
              className="px-3 py-2 border border-white/[0.1] font-mono text-[10px] uppercase tracking-wide text-white/60 hover:bg-white/[0.1] hover:text-white transition-colors text-center"
            >
              Memory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
