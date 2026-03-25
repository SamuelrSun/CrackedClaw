"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Brain,
  Zap,
  Shield,
  Smartphone,
  Globe,
  Link2,
  MessageSquare,
  Settings,
  ChevronRight,
  Terminal,
  Layers,
  Key,
  ArrowUpRight,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Docs sidebar sections & articles
───────────────────────────────────────────────────────── */

interface DocArticle {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface DocSection {
  id: string;
  label: string;
  articles: DocArticle[];
}

const SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    articles: [
      {
        id: "what-is-dopl",
        title: "What is Dopl?",
        icon: <BookOpen className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              Dopl is your always-on AI companion — an intelligent digital twin that operates on your behalf. Built on top of OpenClaw, Dopl requires zero setup. Connect your accounts, and your agent starts working.
            </p>
            <p>
              Unlike traditional AI assistants that wait for prompts, Dopl proactively manages tasks: monitoring your inbox, scheduling meetings, conducting research, and executing complex workflows — all while learning your preferences over time.
            </p>
            <div className="mt-6 p-4 border border-white/[0.08] bg-white/[0.02]">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-2">Key Capabilities</p>
              <ul className="space-y-2 text-white/60">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">→</span>
                  <span>Autonomous task execution across email, calendar, and connected services</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">→</span>
                  <span>Persistent memory that learns your preferences and decision patterns</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">→</span>
                  <span>Multi-channel access — web, desktop companion, browser extension</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">→</span>
                  <span>Portable Brain that works across AI tools via MCP</span>
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: "quickstart",
        title: "Quickstart Guide",
        icon: <Zap className="w-4 h-4" />,
        content: (
          <div className="space-y-6">
            <p>Get up and running in under 2 minutes.</p>

            <div className="space-y-5">
              <Step n={1} title="Create your account">
                <p>
                  Sign up at{" "}
                  <Link href="/welcome" className="text-blue-400 hover:underline">
                    usedopl.com/welcome
                  </Link>
                  . You can sign in with Google or create an account with email.
                </p>
              </Step>

              <Step n={2} title="Start chatting">
                <p>
                  Your Dopl agent is ready immediately. Open the{" "}
                  <Link href="/chat" className="text-blue-400 hover:underline">
                    Chat
                  </Link>{" "}
                  tab and start a conversation. Dopl understands natural language — just tell it what you need.
                </p>
              </Step>

              <Step n={3} title="Connect your accounts">
                <p>
                  Go to{" "}
                  <Link href="/integrations" className="text-blue-400 hover:underline">
                    Integrations
                  </Link>{" "}
                  to connect Gmail, Google Calendar, and other services. This lets Dopl act on your behalf — sending emails, checking your schedule, and more.
                </p>
              </Step>

              <Step n={4} title="Let it learn">
                <p>
                  The more you interact with Dopl, the better it gets. It learns your communication style, preferences, and decision patterns through its Brain — no manual configuration needed.
                </p>
              </Step>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "core-features",
    label: "Core Features",
    articles: [
      {
        id: "brain",
        title: "The Brain",
        icon: <Brain className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              The Brain is Dopl&apos;s persistent memory system. It learns from every conversation — extracting preferences, decisions, and context that make future interactions more personalized.
            </p>

            <div className="mt-4 p-4 border border-white/[0.08] bg-white/[0.02]">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">How It Works</p>
              <div className="space-y-3 text-white/60">
                <p>
                  <span className="text-white/80 font-medium">Automatic extraction</span> — Dopl identifies important facts from your conversations and stores them as structured memories with semantic embeddings.
                </p>
                <p>
                  <span className="text-white/80 font-medium">Domain classification</span> — Each memory is tagged by domain (work, personal, preferences, health, etc.) for organized retrieval.
                </p>
                <p>
                  <span className="text-white/80 font-medium">Semantic search</span> — When context is needed, Dopl searches your Brain using meaning — not just keywords.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 border border-emerald-500/[0.15] bg-emerald-500/[0.03]">
              <p className="text-[11px] text-emerald-400/80 mb-1">Manage your Brain</p>
              <p className="text-white/50 text-[12px]">
                Visit the{" "}
                <Link href="/brain" className="text-emerald-400 hover:underline">
                  Brain tab
                </Link>{" "}
                to see what Dopl has learned, edit memories, or add new ones manually.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "chat",
        title: "Chat",
        icon: <MessageSquare className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              Chat is your primary interface with Dopl. It supports natural language for everything — from quick questions to complex multi-step tasks.
            </p>
            <div className="mt-4 space-y-3">
              <Feature title="File attachments">
                Attach images, PDFs, documents, and code files directly in chat. Dopl reads and understands them.
              </Feature>
              <Feature title="Voice input">
                Click the microphone icon to speak instead of type. Dopl transcribes and responds.
              </Feature>
              <Feature title="Rich responses">
                Dopl renders code blocks, tables, lists, and formatted text. Results from tools and integrations appear as styled cards.
              </Feature>
              <Feature title="Conversation history">
                All conversations are saved and searchable. Pick up where you left off.
              </Feature>
            </div>
          </div>
        ),
      },
      {
        id: "outreach",
        title: "Outreach",
        icon: <Layers className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              The Outreach module is a purpose-built tool for lead generation and sales automation. Dopl finds prospects, crafts personalized messages, and manages follow-up sequences.
            </p>
            <div className="mt-4 space-y-3">
              <Feature title="Lead search">
                Define your ideal customer profile, and Dopl searches LinkedIn, company databases, and the web for matching contacts.
              </Feature>
              <Feature title="Personalized messaging">
                Dopl analyzes each prospect and generates tailored outreach messages that match your writing style.
              </Feature>
              <Feature title="Campaign management">
                Track open rates, responses, and follow-ups in a unified dashboard. Dopl handles the timing automatically.
              </Feature>
              <Feature title="Learning criteria">
                Rate leads and Dopl refines its search criteria over time — getting smarter with every batch.
              </Feature>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "connectivity",
    label: "Connectivity",
    articles: [
      {
        id: "companion-app",
        title: "Desktop Companion",
        icon: <Smartphone className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              Dopl Connect is a lightweight macOS desktop app that gives your agent access to your computer — running commands, managing files, and executing tasks locally.
            </p>

            <div className="space-y-5 mt-6">
              <Step n={1} title="Download">
                <p>
                  Get Dopl Connect from{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">
                    Settings → Connected Devices
                  </Link>{" "}
                  or download the .dmg directly.
                </p>
              </Step>

              <Step n={2} title="Install & pair">
                <p>
                  Open the .dmg, drag to Applications, and launch. Paste your connection token from the Settings page to pair with your Dopl instance.
                </p>
              </Step>

              <Step n={3} title="Grant permissions">
                <p>
                  Dopl Connect needs Accessibility, Screen Recording, and Full Disk Access permissions to operate. The app will prompt you on first launch.
                </p>
              </Step>
            </div>

            <div className="mt-4 p-4 border border-amber-500/[0.15] bg-amber-500/[0.03]">
              <p className="text-[11px] text-amber-400/80 mb-1">macOS only</p>
              <p className="text-white/50 text-[12px]">
                Dopl Connect is currently available for macOS (Apple Silicon). Windows and Linux support is planned.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "browser-relay",
        title: "Browser Extension",
        icon: <Globe className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              The Dopl Browser Relay extension connects your browser to your agent. Dopl can see your tabs, read page content, fill forms, and take actions on websites — all with your permission.
            </p>

            <div className="space-y-5 mt-6">
              <Step n={1} title="Install the extension">
                <p>
                  Download from{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">
                    Settings → Browser Relay
                  </Link>
                  . Load it as an unpacked extension in Chrome (chrome://extensions → Developer mode → Load unpacked).
                </p>
              </Step>

              <Step n={2} title="Enter your connection key">
                <p>
                  Click the extension icon → Options. Paste the connection key from your Settings page.
                </p>
              </Step>

              <Step n={3} title="Attach tabs">
                <p>
                  Navigate to any tab and click the extension icon to attach it to Dopl. The badge turns gold when connected.
                </p>
              </Step>
            </div>

            <div className="mt-4 space-y-3">
              <Feature title="Per-tab chat">
                Each attached tab gets its own chat context. Switch tabs to switch conversations.
              </Feature>
              <Feature title="Page awareness">
                Dopl can read the current page content and interact with elements on your behalf.
              </Feature>
            </div>
          </div>
        ),
      },
      {
        id: "connect-ai-tools",
        title: "Connect AI Tools (MCP)",
        icon: <Link2 className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              Dopl Brain is portable. Connect it to Claude Desktop, OpenClaw, or any MCP-compatible AI tool — your memories and preferences travel with you.
            </p>

            <div className="mt-4 p-4 border border-white/[0.08] bg-white/[0.02]">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">What is MCP?</p>
              <p className="text-white/60">
                The Model Context Protocol (MCP) is an open standard for connecting AI applications to external data sources and tools. Think of it as a USB-C port for AI — one standard connector that works everywhere.
              </p>
            </div>

            <div className="space-y-5 mt-6">
              <Step n={1} title="Generate an API key">
                <p>
                  Go to{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">
                    Settings → Connect AI Tools
                  </Link>{" "}
                  and click &ldquo;Generate API Key&rdquo;. Copy the key — it&apos;s only shown once.
                </p>
              </Step>

              <Step n={2} title="Download the setup file">
                <p>
                  Choose your platform (OpenClaw or Claude) and download the setup file. This contains your credentials and step-by-step instructions.
                </p>
              </Step>

              <Step n={3} title="Let your AI set it up">
                <p>
                  Drop the setup file into your AI tool&apos;s workspace and say &ldquo;set this up.&rdquo; The AI reads the instructions and configures the MCP connection automatically.
                </p>
              </Step>

              <Step n={4} title="Import existing memories">
                <p>
                  If you have an OpenClaw workspace with MEMORY.md, tell your AI: &ldquo;Import my memories into Dopl Brain.&rdquo; It will extract facts, deduplicate, and sync them to your Brain.
                </p>
              </Step>
            </div>

            <div className="mt-6 p-4 border border-white/[0.08] bg-white/[0.02]">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Supported Platforms</p>
              <div className="grid grid-cols-2 gap-3">
                {["OpenClaw", "Claude Desktop", "Claude Cowork", "Cursor"].map((p) => (
                  <div key={p} className="flex items-center gap-2 text-white/60 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "account",
    label: "Account & Security",
    articles: [
      {
        id: "api-keys",
        title: "API Keys",
        icon: <Key className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              API keys authenticate external tools with your Dopl Brain. Each key is hashed using SHA-256 before storage — even a database breach wouldn&apos;t expose your keys.
            </p>
            <div className="mt-4 space-y-3">
              <Feature title="One key, full access">
                Each API key provides access to your Brain&apos;s recall, remember, update, and forget endpoints. It cannot access chat, billing, or account settings.
              </Feature>
              <Feature title="Instant revocation">
                Revoke a key from Settings at any time. All connected tools lose access immediately.
              </Feature>
              <Feature title="Rate limited">
                All API endpoints are rate-limited per user to prevent abuse. Limits range from 5 req/min (imports) to 60 req/min (search).
              </Feature>
            </div>
          </div>
        ),
      },
      {
        id: "privacy-security",
        title: "Privacy & Security",
        icon: <Shield className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              Your data belongs to you. Dopl is designed with privacy as a core principle, not an afterthought.
            </p>
            <div className="mt-4 space-y-3">
              <Feature title="Your data stays yours">
                Dopl never sells your data or uses it to train models. Your conversations and memories are used solely to serve you.
              </Feature>
              <Feature title="Encrypted storage">
                All data is encrypted at rest in Supabase (AES-256). API keys are stored as SHA-256 hashes. Connection tokens use OS keychain when available.
              </Feature>
              <Feature title="Minimal scopes">
                When you connect third-party accounts (Gmail, Calendar), Dopl requests only the minimum permissions needed. You can revoke access at any time.
              </Feature>
              <Feature title="Delete everything">
                Go to Settings → Danger Zone → Delete Account. This permanently removes all your data — conversations, memories, Brain, files, everything.
              </Feature>
            </div>
            <div className="mt-4">
              <Link href="/privacy" className="text-blue-400 hover:underline text-[12px] flex items-center gap-1">
                Read the full Privacy Policy <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "settings",
        title: "Settings",
        icon: <Settings className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              The{" "}
              <Link href="/settings" className="text-blue-400 hover:underline">
                Settings page
              </Link>{" "}
              is your control center for managing your Dopl instance.
            </p>
            <div className="mt-4 space-y-3">
              <Feature title="Usage & billing">
                Track your daily and weekly usage. View your current plan and manage billing.
              </Feature>
              <Feature title="Connected devices">
                See which devices are paired with your agent. Re-pair or disconnect companion apps.
              </Feature>
              <Feature title="Browser relay">
                Manage your browser extension connection key and status.
              </Feature>
              <Feature title="AI Brain controls">
                Toggle adaptive learning, unified memory, and auto memory extraction. These control how aggressively Dopl learns from your interactions.
              </Feature>
              <Feature title="Connect AI Tools">
                Generate API keys and download setup files to connect your Brain to external AI tools.
              </Feature>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "reference",
    label: "Reference",
    articles: [
      {
        id: "brain-api",
        title: "Brain API",
        icon: <Terminal className="w-4 h-4" />,
        content: (
          <div className="space-y-4">
            <p>
              The Brain API provides programmatic access to your Dopl Brain via REST endpoints. All endpoints require authentication via API key.
            </p>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Base URL</p>
              <code className="block p-3 bg-white/[0.03] border border-white/[0.08] text-emerald-400 text-[12px] font-mono">
                https://usedopl.com/api/brain
              </code>
            </div>

            <div className="mt-4">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Authentication</p>
              <code className="block p-3 bg-white/[0.03] border border-white/[0.08] text-white/60 text-[12px] font-mono">
                Authorization: Bearer dpb_sk_your_token_here
              </code>
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Endpoints</p>
              <div className="space-y-2">
                <ApiEndpoint method="POST" path="/recall" desc="Semantic search over your memories" />
                <ApiEndpoint method="POST" path="/remember" desc="Store a new fact" />
                <ApiEndpoint method="PATCH" path="/update" desc="Update an existing memory" />
                <ApiEndpoint method="DELETE" path="/forget" desc="Delete a memory" />
                <ApiEndpoint method="GET" path="/profile" desc="Your Brain profile and stats" />
                <ApiEndpoint method="POST" path="/extract" desc="Extract facts from text (LLM)" />
                <ApiEndpoint method="POST" path="/import" desc="Bulk import with deduplication" />
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] uppercase tracking-widest text-white/40 mb-3">Rate Limits</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { endpoint: "recall", limit: "60/min" },
                  { endpoint: "remember", limit: "30/min" },
                  { endpoint: "update", limit: "30/min" },
                  { endpoint: "forget", limit: "30/min" },
                  { endpoint: "profile", limit: "30/min" },
                  { endpoint: "extract", limit: "10/min" },
                  { endpoint: "import", limit: "5/min" },
                ].map((r) => (
                  <div key={r.endpoint} className="flex items-center justify-between text-[12px] py-1 px-2 bg-white/[0.02] border border-white/[0.04]">
                    <span className="font-mono text-white/50">{r.endpoint}</span>
                    <span className="font-mono text-white/30">{r.limit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
];

/* ─────────────────────────────────────────────────────────
   Shared components
───────────────────────────────────────────────────────── */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-7 h-7 flex items-center justify-center border border-white/[0.12] text-[11px] font-mono text-white/40">
        {n}
      </div>
      <div>
        <p className="text-[13px] font-medium text-white/80 mb-1">{title}</p>
        <div className="text-white/50 text-[12px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pl-4 border-l border-white/[0.08]">
      <p className="text-[12px] font-medium text-white/70 mb-0.5">{title}</p>
      <p className="text-[12px] text-white/40 leading-relaxed">{children}</p>
    </div>
  );
}

function ApiEndpoint({ method, path, desc }: { method: string; path: string; desc: string }) {
  const colors: Record<string, string> = {
    GET: "text-emerald-400",
    POST: "text-blue-400",
    PATCH: "text-amber-400",
    DELETE: "text-red-400",
  };
  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-white/[0.02] border border-white/[0.06]">
      <span className={`font-mono text-[10px] font-bold w-14 ${colors[method] || "text-white/40"}`}>
        {method}
      </span>
      <span className="font-mono text-[12px] text-white/60">{path}</span>
      <span className="text-[11px] text-white/30 ml-auto hidden sm:block">{desc}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Docs Client
───────────────────────────────────────────────────────── */

export default function DocsPageClient() {
  const [activeArticle, setActiveArticle] = useState("what-is-dopl");

  const currentArticle = SECTIONS.flatMap((s) => s.articles).find((a) => a.id === activeArticle);

  return (
    <main className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pb-20">
      {/* Header */}
      <div className="py-8 sm:py-12">
        <h1
          className="text-3xl sm:text-4xl font-bold text-white mb-2"
          style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
        >
          Documentation
        </h1>
        <p className="font-mono text-[11px] text-white/40 uppercase tracking-wide">
          Everything you need to know about Dopl
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {/* Sidebar */}
        <aside className="lg:w-56 flex-shrink-0">
          <nav className="lg:sticky lg:top-24 space-y-5">
            {SECTIONS.map((section) => (
              <div key={section.id}>
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-white/30 mb-2">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.articles.map((article) => (
                    <li key={article.id}>
                      <button
                        onClick={() => setActiveArticle(article.id)}
                        className={`w-full text-left flex items-center gap-2 py-1.5 px-2 text-[12px] transition-colors ${
                          activeArticle === article.id
                            ? "text-white bg-white/[0.06]"
                            : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                        }`}
                      >
                        <span className="flex-shrink-0 opacity-60">{article.icon}</span>
                        {article.title}
                        {activeArticle === article.id && (
                          <ChevronRight className="w-3 h-3 ml-auto text-white/30" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>

        {/* Article content */}
        <article className="flex-1 min-w-0">
          <div
            className="p-5 sm:p-8 border border-white/[0.08]"
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(20px)" }}
          >
            {currentArticle && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-white/50">{currentArticle.icon}</span>
                  <h2 className="text-xl font-semibold text-white" style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>
                    {currentArticle.title}
                  </h2>
                </div>
                <div className="font-mono text-[13px] leading-relaxed text-white/60">
                  {currentArticle.content}
                </div>
              </>
            )}
          </div>
        </article>
      </div>
    </main>
  );
}
