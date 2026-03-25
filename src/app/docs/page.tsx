import Link from "next/link";
import { Metadata } from "next";
import DocsPageClient from "./client";

export const metadata: Metadata = {
  title: "Docs — Dopl",
  description: "Everything you need to know about your AI companion.",
};

export default function DocsPage() {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: "#0a0a0f" }}>
      {/* Background */}
      <div
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      <div className="fixed inset-0 z-0" style={{ background: "rgba(0,0,0,0.6)" }} />

      {/* Nav */}
      <nav className="relative z-10 px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-bold text-white/90 hover:text-white transition-colors"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
          >
            Dopl
          </Link>
          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="font-mono text-[10px] text-white/70 uppercase tracking-wide"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="font-mono text-[10px] text-white/50 hover:text-white uppercase tracking-wide transition-colors"
            >
              Sign in →
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <DocsPageClient />
    </div>
  );
}
