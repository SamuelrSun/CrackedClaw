"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Brain,
  Zap,
  Shield,
  Monitor,
  Globe,
  Link2,
  MessageSquare,
  Key,
  Terminal,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Lock,
  Download,
  Settings,
  Eye,
  Cpu,
  Layers,
  ArrowUpRight,
  HelpCircle,
  FileText,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────── */

interface DocArticle {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

interface DocSection {
  id: string;
  label: string;
  description: string;
  articles: DocArticle[];
}

/* ─────────────────────────────────────────────────────────
   Shared components
───────────────────────────────────────────────────────── */

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-white/[0.12] bg-white/[0.03] text-[12px] font-mono text-white/50">
        {n}
      </div>
      <div className="flex-1">
        <p className="text-[14px] font-medium text-white/85 mb-1.5">{title}</p>
        <div className="text-white/50 text-[13px] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Feature({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="pl-4 border-l-2 border-white/[0.08]">
      <p className="text-[13px] font-medium text-white/75 mb-1">{title}</p>
      <p className="text-[13px] text-white/45 leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ label, variant = "default", children }: { label: string; variant?: "default" | "success" | "warning"; children: React.ReactNode }) {
  const styles = {
    default: "border-white/[0.08] bg-white/[0.02]",
    success: "border-emerald-500/[0.15] bg-emerald-500/[0.03]",
    warning: "border-amber-500/[0.15] bg-amber-500/[0.03]",
  };
  const labelStyles = {
    default: "text-white/40",
    success: "text-emerald-400/80",
    warning: "text-amber-400/80",
  };
  return (
    <div className={`p-4 border ${styles[variant]}`}>
      <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold ${labelStyles[variant]} mb-2`}>{label}</p>
      <div className="text-[13px] text-white/55 leading-relaxed">{children}</div>
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
    <div className="flex items-center gap-3 py-2.5 px-3 bg-white/[0.02] border border-white/[0.06]">
      <span className={`font-mono text-[10px] font-bold w-14 ${colors[method] || "text-white/40"}`}>
        {method}
      </span>
      <span className="font-mono text-[12px] text-white/60">{path}</span>
      <span className="text-[11px] text-white/30 ml-auto hidden sm:block">{desc}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Documentation content
───────────────────────────────────────────────────────── */

const SECTIONS: DocSection[] = [
  {
    id: "getting-started",
    label: "Getting Started",
    description: "What Dopl is and how to get up and running",
    articles: [
      {
        id: "what-is-dopl",
        title: "What is Dopl?",
        subtitle: "Your always-on AI companion that works for you",
        icon: <BookOpen className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Dopl is an AI companion — a personal assistant that lives in your browser, on your desktop, and across your devices. Think of it like having a brilliant, tireless helper who knows your preferences, remembers your conversations, and can take action on your behalf.
            </p>
            <p>
              Unlike chatbots that forget you the moment you close the tab, Dopl has a <strong className="text-white/80">Brain</strong> — a persistent memory that learns who you are over time. The more you use it, the better it gets at helping you.
            </p>

            <InfoBox label="What can Dopl do?">
              <ul className="space-y-2 mt-1">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Chat naturally</strong> — Ask questions, get help with writing, brainstorm ideas, analyze documents. Just talk to it like you would a smart friend.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Remember everything</strong> — Dopl learns your preferences, decisions, and context. It won&apos;t ask you the same question twice.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Browse the web for you</strong> — With the Browser Extension, Dopl can navigate websites, fill out forms, and interact with pages using your logged-in accounts.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Work on your computer</strong> — With the Desktop Companion, Dopl can run commands, manage files, and execute tasks locally on your Mac.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Travel with you</strong> — Your Brain is portable. Connect it to other AI tools like Claude Desktop or OpenClaw so your preferences follow you everywhere.</span>
                </li>
              </ul>
            </InfoBox>

            <InfoBox label="How is this different from ChatGPT or Claude?">
              <p>
                ChatGPT and Claude are general-purpose chat interfaces. They don&apos;t remember you between sessions (or barely do), can&apos;t take actions on your computer, and can&apos;t browse the web with your accounts. Dopl is built to be <em>yours</em> — it has persistent memory, can control your browser, run programs on your desktop, and its Brain works across multiple AI platforms. It&apos;s not just a chat window — it&apos;s a digital assistant that actually <em>does things</em>.
              </p>
            </InfoBox>
          </div>
        ),
      },
      {
        id: "quickstart",
        title: "Getting Started",
        subtitle: "Up and running in under 2 minutes",
        icon: <Zap className="w-4 h-4" />,
        content: (
          <div className="space-y-6">
            <p>Setting up Dopl takes less than two minutes. Here&apos;s how:</p>

            <div className="space-y-6">
              <Step n={1} title="Create your account">
                <p>
                  Go to{" "}
                  <Link href="/welcome" className="text-blue-400 hover:underline">usedopl.com/welcome</Link>
                  {" "}and sign in with Google (or create an account with email). That&apos;s it — your AI agent is provisioned automatically.
                </p>
              </Step>

              <Step n={2} title="Say hello">
                <p>
                  Open the{" "}
                  <Link href="/chat" className="text-blue-400 hover:underline">Chat</Link>
                  {" "}tab. Type anything — &ldquo;Hi, what can you do?&rdquo; is a great start. Dopl understands plain English (and many other languages). No special commands needed.
                </p>
              </Step>

              <Step n={3} title="Let it learn you">
                <p>
                  As you chat, Dopl automatically picks up on your preferences, style, and context. You&apos;ll notice it getting smarter over time — remembering what you like, how you work, and what matters to you. You can see what it&apos;s learned in the{" "}
                  <Link href="/brain" className="text-blue-400 hover:underline">Brain</Link> tab.
                </p>
              </Step>

              <Step n={4} title="Supercharge it (optional)">
                <p>
                  Want Dopl to do more? Install the{" "}
                  <strong className="text-white/70">Browser Extension</strong> to let it control web pages, or the{" "}
                  <strong className="text-white/70">Desktop Companion</strong> to let it work on your computer. Connect your Gmail and Calendar in{" "}
                  <Link href="/integrations" className="text-blue-400 hover:underline">Integrations</Link>
                  . Each connection makes Dopl more capable.
                </p>
              </Step>
            </div>

            <InfoBox label="Tip" variant="success">
              <p>You don&apos;t need to set up everything at once. Start with chat, and add more capabilities as you need them. Dopl works great right out of the box.</p>
            </InfoBox>
          </div>
        ),
      },
    ],
  },
  {
    id: "core-features",
    label: "Core Features",
    description: "Chat, Brain, and how Dopl learns",
    articles: [
      {
        id: "chat",
        title: "Chat",
        subtitle: "Your main way to talk to Dopl",
        icon: <MessageSquare className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Chat is where you interact with Dopl. It&apos;s like texting a very smart friend who never forgets anything and can actually do things for you.
            </p>

            <div className="space-y-4">
              <Feature title="Just talk normally">
                There are no special commands. Say &ldquo;Can you help me write an email to my boss?&rdquo; or &ldquo;What&apos;s the weather in San Francisco?&rdquo; or &ldquo;Summarize this PDF for me.&rdquo; Dopl figures out what you need.
              </Feature>
              <Feature title="Attach files">
                Click the paperclip icon (or paste from your clipboard) to share images, PDFs, documents, spreadsheets, and code files. Dopl reads and understands them — you can ask questions about them, get summaries, or have Dopl extract specific information.
              </Feature>
              <Feature title="Voice input">
                Click the microphone icon to speak instead of type. Great when you&apos;re on the go or thinking out loud. Dopl transcribes your speech and responds.
              </Feature>
              <Feature title="Conversation history">
                All your conversations are saved. Use the sidebar to switch between them, or use <kbd className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.1] text-[11px] font-mono text-white/40">⌘K</kbd> to search across everything.
              </Feature>
              <Feature title="Rich responses">
                Dopl renders code with syntax highlighting, formats tables, creates lists, and shows tool results as styled cards. It&apos;s not just plain text.
              </Feature>
            </div>
          </div>
        ),
      },
      {
        id: "brain",
        title: "The Brain",
        subtitle: "How Dopl remembers you",
        icon: <Brain className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              The Brain is what makes Dopl different from every other AI chatbot. It&apos;s a persistent memory system that learns from every conversation you have.
            </p>

            <InfoBox label="How does it work?">
              <div className="space-y-3">
                <p>
                  Every time you chat with Dopl, it quietly pays attention to what matters. If you mention you prefer morning meetings, or that you&apos;re vegetarian, or that you work at a specific company — Dopl remembers.
                </p>
                <p>
                  These aren&apos;t simple keyword matches. Dopl understands <em>meaning</em>. If you said &ldquo;I can&apos;t eat shellfish&rdquo; three weeks ago, and today you ask &ldquo;what should I order at a seafood restaurant?&rdquo; — Dopl connects those dots automatically.
                </p>
              </div>
            </InfoBox>

            <div className="space-y-4 mt-2">
              <Feature title="Automatic learning">
                You don&apos;t need to tell Dopl to remember things (though you can). It extracts preferences, facts, and decisions from natural conversation. No manual tagging or organizing required.
              </Feature>
              <Feature title="Organized by topic">
                Memories are categorized into domains — work, personal, health, preferences, communication style, and more. This helps Dopl find the right context at the right time.
              </Feature>
              <Feature title="You&apos;re in control">
                Visit the <Link href="/brain" className="text-blue-400 hover:underline">Brain tab</Link> to see everything Dopl has learned. Edit any memory, delete things you don&apos;t want stored, or add facts manually. It&apos;s your data — you have full control.
              </Feature>
              <Feature title="Gets smarter over time">
                The more you interact, the better Dopl becomes. After a week of use, you&apos;ll notice it anticipating your needs, using your preferred tone, and skipping questions it already knows the answer to.
              </Feature>
            </div>

            <InfoBox label="Privacy note" variant="success">
              <p>Your Brain data is encrypted and belongs to you. Dopl never shares it with anyone or uses it to train AI models. You can delete everything at any time from Settings.</p>
            </InfoBox>
          </div>
        ),
      },
    ],
  },
  {
    id: "browser-extension",
    label: "Browser Extension",
    description: "Let Dopl control your browser tabs",
    articles: [
      {
        id: "extension-overview",
        title: "What it does",
        subtitle: "Your AI can see and interact with your browser",
        icon: <Globe className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              The Dopl Browser Extension connects your Chrome browser to your AI agent. Once installed, Dopl can see the page you&apos;re on, click buttons, fill out forms, navigate to websites, and interact with web apps — all using your logged-in accounts.
            </p>

            <InfoBox label="Why is this useful?">
              <div className="space-y-2">
                <p>Imagine saying:</p>
                <ul className="space-y-1.5 ml-1">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">&bull;</span>
                    <span>&ldquo;Go to LinkedIn and find people who work at Stripe&rdquo;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">&bull;</span>
                    <span>&ldquo;Fill out this job application for me&rdquo;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">&bull;</span>
                    <span>&ldquo;Read this article and summarize the key points&rdquo;</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">&bull;</span>
                    <span>&ldquo;Add this event to my Google Calendar&rdquo;</span>
                  </li>
                </ul>
                <p className="mt-2">Dopl does it right in your browser, using your accounts, while you watch. A purple glow appears around the page when Dopl is actively working on it.</p>
              </div>
            </InfoBox>

            <div className="space-y-4">
              <Feature title="Per-tab chat">
                Each browser tab gets its own chat panel. Ask Dopl about the page you&apos;re looking at, or give it instructions specific to that tab. Switch tabs, and the chat switches too.
              </Feature>
              <Feature title="Page awareness">
                Dopl can read the content of the current page. Ask &ldquo;what is this page about?&rdquo; or &ldquo;find the pricing on this page&rdquo; and it understands the context.
              </Feature>
              <Feature title="Ephemeral chats">
                Extension chats are private to your browser — they&apos;re not saved to the cloud or visible in the web app. Close the tab, and the chat is gone. This keeps your browsing activity separate from your main Dopl conversations.
              </Feature>
            </div>
          </div>
        ),
      },
      {
        id: "extension-install",
        title: "Installation",
        subtitle: "Step-by-step setup guide",
        icon: <Download className="w-4 h-4" />,
        content: (
          <div className="space-y-6">
            <p>The extension works in Chrome (and Chromium-based browsers like Edge, Brave, and Arc). Installation takes about a minute.</p>

            <div className="space-y-6">
              <Step n={1} title="Download the extension">
                <p>
                  Go to{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">Settings</Link>
                  {" "}and look for the &ldquo;Browser Relay&rdquo; section. Click the download button to get the extension files as a .zip.
                </p>
              </Step>

              <Step n={2} title="Open Chrome Extensions">
                <p>
                  Type <code className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] text-[12px] font-mono text-white/60">chrome://extensions</code> in your address bar and press Enter. In the top-right corner, turn on <strong className="text-white/70">Developer mode</strong>.
                </p>
              </Step>

              <Step n={3} title="Load the extension">
                <p>
                  Unzip the downloaded file. Back in Chrome Extensions, click <strong className="text-white/70">&ldquo;Load unpacked&rdquo;</strong> and select the unzipped folder. The Dopl Browser Relay icon will appear in your toolbar.
                </p>
              </Step>

              <Step n={4} title="Enter your connection key">
                <p>
                  Click the extension icon, then go to Options (or right-click the icon → &ldquo;Options&rdquo;). Copy the <strong className="text-white/70">Connection Key</strong> from your{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">Settings page</Link>
                  {" "}and paste it. Click <strong className="text-white/70">Connect</strong>.
                </p>
              </Step>

              <Step n={5} title="Start using it">
                <p>
                  A chat panel will automatically open on your current tab. The extension auto-connects to all your open tabs. Just type a message in the panel and Dopl will respond — and it can control the tab you&apos;re chatting from.
                </p>
              </Step>
            </div>

            <InfoBox label="Tip" variant="success">
              <p>Pin the extension to your toolbar for easy access: click the puzzle piece icon in Chrome&apos;s toolbar, find &ldquo;Dopl Browser Relay,&rdquo; and click the pin icon.</p>
            </InfoBox>
          </div>
        ),
      },
      {
        id: "extension-how-it-works",
        title: "How it works",
        subtitle: "The technology behind the scenes",
        icon: <Cpu className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Understanding how the extension works can help you feel comfortable with what it can and can&apos;t do.
            </p>

            <div className="space-y-4">
              <Feature title="Secure relay connection">
                The extension connects to your Dopl agent through an encrypted WebSocket tunnel. Your connection key is cryptographically derived — even if someone intercepts the connection, they can&apos;t impersonate you. The connection is authenticated and encrypted end-to-end via TLS.
              </Feature>
              <Feature title="Chrome DevTools Protocol">
                When Dopl interacts with a page (clicking buttons, reading content, filling forms), it uses the same protocol that Chrome&apos;s built-in developer tools use. This means it can do exactly what a developer could do with Chrome DevTools — no more, no less.
              </Feature>
              <Feature title="You see everything">
                Dopl controls your actual browser tab, not a hidden one. You can see every action in real time. A purple border appears around the page when Dopl is actively working. Nothing happens in the background without your knowledge.
              </Feature>
              <Feature title="Per-tab isolation">
                Each tab has its own independent session. Dopl only accesses the tabs you&apos;re chatting from — it doesn&apos;t snoop on other tabs. Chat history is stored locally in your browser and never sent to the cloud.
              </Feature>
            </div>

            <InfoBox label="What about my passwords?">
              <p>
                Dopl never sees your passwords. When it fills in a login form, it uses your browser&apos;s already-saved credentials or asks you to type them. The extension cannot read saved passwords from Chrome&apos;s password manager.
              </p>
            </InfoBox>
          </div>
        ),
      },
    ],
  },
  {
    id: "desktop-companion",
    label: "Desktop Companion",
    description: "Give Dopl access to your computer",
    articles: [
      {
        id: "companion-overview",
        title: "What it does",
        subtitle: "Your AI assistant, running locally on your Mac",
        icon: <Monitor className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Dopl Connect is a lightweight desktop app for macOS that bridges your AI agent to your computer. With it installed, Dopl can run terminal commands, manage files, take screenshots, and execute complex tasks — all on your local machine.
            </p>

            <InfoBox label="What can it do?">
              <ul className="space-y-2 mt-1">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Run commands</strong> — &ldquo;Check if my server is running&rdquo; or &ldquo;Install Python 3.12&rdquo; — Dopl executes terminal commands with your approval.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Manage files</strong> — &ldquo;Organize my Downloads folder&rdquo; or &ldquo;Find all PDFs from last month&rdquo; — it can read, move, and organize your files.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">See your screen</strong> — Dopl can take screenshots to understand what you&apos;re looking at. &ldquo;What app is open right now?&rdquo; or &ldquo;Help me with this error message.&rdquo;</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5 flex-shrink-0">→</span>
                  <span><strong className="text-white/70">Coding assistance</strong> — Dopl can read your codebase, make edits, run tests, and commit changes. It&apos;s like having a pair programmer.</span>
                </li>
              </ul>
            </InfoBox>

            <InfoBox label="How it&apos;s different from the web app" variant="default">
              <p>
                The web app runs entirely in the cloud — great for chat and brain features, but it can&apos;t touch your local files. The Desktop Companion is the bridge that gives Dopl hands on your machine. Think of the web app as Dopl&apos;s voice, and the Companion as its hands.
              </p>
            </InfoBox>
          </div>
        ),
      },
      {
        id: "companion-install",
        title: "Installation",
        subtitle: "Download, install, and pair with your agent",
        icon: <Download className="w-4 h-4" />,
        content: (
          <div className="space-y-6">
            <p>Dopl Connect is available for macOS (Apple Silicon and Intel). The app is signed, notarized, and approved by Apple.</p>

            <div className="space-y-6">
              <Step n={1} title="Download the DMG">
                <p>
                  Go to{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">Settings → Connected Devices</Link>
                  {" "}and click the download button. The file is about 93 MB.
                </p>
              </Step>

              <Step n={2} title="Install the app">
                <p>
                  Open the downloaded <code className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.08] text-[12px] font-mono text-white/60">DoplConnect.dmg</code> file. Drag <strong className="text-white/70">Dopl Connect</strong> to your Applications folder. Launch it from Applications or Spotlight.
                </p>
              </Step>

              <Step n={3} title="Pair with your agent">
                <p>
                  On first launch, the app shows a pairing screen. Copy the <strong className="text-white/70">Connection Token</strong> from your{" "}
                  <Link href="/settings" className="text-blue-400 hover:underline">Settings page</Link>
                  {" "}and paste it into the app. It will connect automatically. You&apos;ll see a green status indicator when paired.
                </p>
              </Step>

              <Step n={4} title="Grant permissions">
                <p>
                  macOS will ask for certain permissions. Each one unlocks different capabilities (see the <strong className="text-white/70">Permissions</strong> section below for details on what each one does and why it&apos;s needed).
                </p>
              </Step>
            </div>

            <InfoBox label="macOS only (for now)" variant="warning">
              <p>Dopl Connect is currently macOS-only. Windows and Linux versions are planned. The web app and browser extension work on all platforms.</p>
            </InfoBox>
          </div>
        ),
      },
      {
        id: "companion-permissions",
        title: "Permissions explained",
        subtitle: "What each permission does and why it&apos;s needed",
        icon: <Lock className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              macOS requires apps to request permission before accessing sensitive capabilities. Here&apos;s exactly what Dopl Connect asks for and why:
            </p>

            <div className="space-y-5">
              <div className="p-4 border border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4 text-white/50" />
                  <p className="text-[13px] font-medium text-white/80">Accessibility</p>
                </div>
                <p className="text-[13px] text-white/45 leading-relaxed mb-2">
                  <strong className="text-white/60">What it does:</strong> Allows Dopl to interact with UI elements on your screen — clicking buttons, typing text, and reading what&apos;s displayed in other applications.
                </p>
                <p className="text-[13px] text-white/45 leading-relaxed">
                  <strong className="text-white/60">Why it&apos;s needed:</strong> Without this, Dopl can only run terminal commands. With Accessibility, it can also interact with graphical apps — like clicking &ldquo;Save&rdquo; in a dialog or reading text from a window.
                </p>
              </div>

              <div className="p-4 border border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-white/50" />
                  <p className="text-[13px] font-medium text-white/80">Screen Recording</p>
                </div>
                <p className="text-[13px] text-white/45 leading-relaxed mb-2">
                  <strong className="text-white/60">What it does:</strong> Allows Dopl to capture screenshots of your screen.
                </p>
                <p className="text-[13px] text-white/45 leading-relaxed">
                  <strong className="text-white/60">Why it&apos;s needed:</strong> When you say &ldquo;help me with this error&rdquo; or &ldquo;what am I looking at?&rdquo;, Dopl needs to see your screen. This permission lets it take a screenshot so it can understand the visual context. It only captures screenshots when actively performing a task — it does not continuously record your screen.
                </p>
              </div>

              <div className="p-4 border border-white/[0.08] bg-white/[0.02]">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-white/50" />
                  <p className="text-[13px] font-medium text-white/80">Full Disk Access</p>
                </div>
                <p className="text-[13px] text-white/45 leading-relaxed mb-2">
                  <strong className="text-white/60">What it does:</strong> Allows Dopl to read and write files anywhere on your computer.
                </p>
                <p className="text-[13px] text-white/45 leading-relaxed">
                  <strong className="text-white/60">Why it&apos;s needed:</strong> If you ask Dopl to &ldquo;find all invoices in my Documents folder&rdquo; or &ldquo;organize my Downloads,&rdquo; it needs permission to access those folders. Without this, it can only access its own application folder. You can skip this permission if you only want command-line capabilities.
                </p>
              </div>
            </div>

            <InfoBox label="You can be selective" variant="success">
              <p>
                You don&apos;t need to grant all permissions. Dopl Connect works with any combination — you just get fewer capabilities. For example, grant only Accessibility for basic automation, or only Full Disk Access for file management without screen capture.
              </p>
            </InfoBox>
          </div>
        ),
      },
      {
        id: "companion-how-it-works",
        title: "How it works",
        subtitle: "The architecture under the hood",
        icon: <Cpu className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Dopl Connect runs a lightweight agent on your Mac that maintains a persistent connection to your Dopl instance in the cloud.
            </p>

            <div className="space-y-4">
              <Feature title="Always connected">
                The app runs in the background (visible in your menu bar) and maintains a live connection to your Dopl instance. When your agent needs to do something on your computer, the command is sent through this encrypted tunnel.
              </Feature>
              <Feature title="Encrypted communication">
                All communication between the desktop app and the cloud uses TLS encryption. Your connection token is stored securely in macOS Keychain (the same system that stores your passwords).
              </Feature>
              <Feature title="Lightweight">
                The app uses minimal resources — typically under 50 MB of RAM and near-zero CPU when idle. It only becomes active when your agent needs to perform a local task.
              </Feature>
              <Feature title="Chat input bar">
                A small floating input bar (activated with <kbd className="px-1.5 py-0.5 bg-white/[0.06] border border-white/[0.1] text-[11px] font-mono text-white/40">⌘⇧Space</kbd>) lets you talk to Dopl from anywhere on your Mac without opening a browser. It&apos;s like Spotlight, but for your AI.
              </Feature>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "portable-brain",
    label: "Portable Brain",
    description: "Use your Brain across AI platforms",
    articles: [
      {
        id: "mcp-overview",
        title: "Connect AI Tools",
        subtitle: "Your Brain works everywhere, not just Dopl",
        icon: <Link2 className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Most AI tools are walled gardens — what you teach ChatGPT stays in ChatGPT, and what you teach Claude stays in Claude. Dopl is different. Your Brain is <strong className="text-white/80">portable</strong>.
            </p>
            <p>
              Using an open standard called MCP (Model Context Protocol), you can connect your Dopl Brain to other AI tools. Your preferences, memories, and context travel with you — no matter which AI you&apos;re using.
            </p>

            <InfoBox label="What is MCP?">
              <p>
                Think of MCP like a USB-C cable for AI. Just like USB-C lets any device connect to any computer with one standard plug, MCP lets any AI tool connect to any data source with one standard protocol. It was created by Anthropic and is supported by a growing number of AI tools.
              </p>
            </InfoBox>

            <InfoBox label="Supported platforms" variant="success">
              <div className="grid grid-cols-2 gap-2 mt-2">
                {["OpenClaw", "Claude Desktop", "Claude Cowork", "Cursor", "VS Code (Copilot)", "Windsurf"].map((p) => (
                  <div key={p} className="flex items-center gap-2 text-[12px]">
                    <span className="w-1.5 h-1.5 bg-emerald-400 flex-shrink-0" />
                    <span className="text-white/60">{p}</span>
                  </div>
                ))}
              </div>
            </InfoBox>
          </div>
        ),
      },
      {
        id: "mcp-setup",
        title: "Setup guide",
        subtitle: "Connect your Brain to another AI tool",
        icon: <Settings className="w-4 h-4" />,
        content: (
          <div className="space-y-6">
            <p>Connecting your Brain to another AI tool takes about 30 seconds.</p>

            <div className="space-y-6">
              <Step n={1} title="Generate an API key">
                <p>
                  Go to{" "}
                  <Link href="/brain" className="text-blue-400 hover:underline">Brain → Connect tab</Link>
                  {" "}and click &ldquo;Generate API Key.&rdquo; Copy the key — it&apos;s only shown once. Keep it safe like a password.
                </p>
              </Step>

              <Step n={2} title="Download the setup file">
                <p>
                  Choose your AI platform (OpenClaw, Claude Desktop, etc.) and download the setup file. This is a small text file that contains your credentials and step-by-step instructions that your AI can read.
                </p>
              </Step>

              <Step n={3} title="Drop it into your AI tool">
                <p>
                  Open your other AI tool and share the setup file. In Claude Desktop, drag it into the chat. In OpenClaw, place it in your workspace. Then just say: <strong className="text-white/70">&ldquo;Set this up.&rdquo;</strong>
                </p>
                <p className="mt-2">
                  The AI reads the instructions, configures the MCP connection, and starts using your Brain automatically. No coding required.
                </p>
              </Step>

              <Step n={4} title="Import existing memories (optional)">
                <p>
                  If you already have memories in another tool (like an OpenClaw MEMORY.md file), tell your AI: <strong className="text-white/70">&ldquo;Import my memories into Dopl Brain.&rdquo;</strong> It extracts your existing knowledge, deduplicates it, and syncs to your Brain.
                </p>
              </Step>
            </div>
          </div>
        ),
      },
    ],
  },
  {
    id: "account-security",
    label: "Account & Security",
    description: "Privacy, API keys, and your data",
    articles: [
      {
        id: "privacy-security",
        title: "Privacy & Security",
        subtitle: "How we protect your data",
        icon: <Shield className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              Your data belongs to you. Full stop. Here&apos;s exactly how we handle it:
            </p>

            <div className="space-y-4">
              <Feature title="No training on your data">
                Dopl never uses your conversations, memories, or files to train AI models. Your data is used solely to serve you. Period.
              </Feature>
              <Feature title="Encrypted everywhere">
                All data is encrypted at rest (AES-256 via Supabase) and in transit (TLS). API keys are stored as SHA-256 hashes — even a database breach wouldn&apos;t expose them. Desktop app tokens use macOS Keychain.
              </Feature>
              <Feature title="Minimal permissions">
                When you connect third-party accounts (Gmail, Calendar), Dopl requests only the minimum permissions needed. You can revoke access at any time from Integrations.
              </Feature>
              <Feature title="Delete everything">
                Go to <Link href="/settings" className="text-blue-400 hover:underline">Settings → Danger Zone → Delete Account</Link>. This permanently removes all your data — conversations, memories, Brain, files, everything. No &ldquo;we keep it for 30 days&rdquo; nonsense.
              </Feature>
            </div>

            <div className="mt-4">
              <Link href="/privacy" className="text-blue-400 hover:underline text-[13px] flex items-center gap-1">
                Read the full Privacy Policy <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ),
      },
      {
        id: "api-keys",
        title: "API Keys",
        subtitle: "Manage external access to your Brain",
        icon: <Key className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              API keys let external AI tools access your Dopl Brain. They&apos;re like passwords that grant specific, limited access.
            </p>

            <div className="space-y-4">
              <Feature title="Scoped access">
                Each API key can access your Brain (search memories, add new ones, update or delete). It cannot access your chat history, billing, or account settings.
              </Feature>
              <Feature title="Instant revocation">
                Revoke a key from the Brain → Connect tab at any time. All connected tools lose access immediately — no waiting period.
              </Feature>
              <Feature title="Secure storage">
                Keys are hashed with SHA-256 before storage. Even if our database were compromised, your keys would be safe. Keys start with <code className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] text-[11px] font-mono text-white/50">dpb_sk_</code> so you can identify them.
              </Feature>
              <Feature title="Rate limited">
                All API endpoints are rate-limited to prevent abuse: search at 60 requests/min, writes at 30/min, imports at 5/min.
              </Feature>
            </div>
          </div>
        ),
      },
      {
        id: "brain-api",
        title: "Brain API Reference",
        subtitle: "Technical documentation for developers",
        icon: <Terminal className="w-4 h-4" />,
        content: (
          <div className="space-y-5">
            <p>
              The Brain API provides programmatic access to your Dopl Brain via REST endpoints. All endpoints require a <code className="px-1 py-0.5 bg-white/[0.06] border border-white/[0.08] text-[11px] font-mono text-white/50">dpb_sk_</code> API key.
            </p>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-2">Base URL</p>
              <code className="block p-3 bg-white/[0.03] border border-white/[0.08] text-emerald-400 text-[12px] font-mono">
                https://usedopl.com/api/brain
              </code>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-2">Authentication</p>
              <code className="block p-3 bg-white/[0.03] border border-white/[0.08] text-white/60 text-[12px] font-mono">
                Authorization: Bearer dpb_sk_your_key_here
              </code>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-3">Endpoints</p>
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

            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold mb-3">Rate Limits</p>
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
                  <div key={r.endpoint} className="flex items-center justify-between text-[12px] py-1.5 px-2.5 bg-white/[0.02] border border-white/[0.06]">
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
  {
    id: "faq",
    label: "FAQ",
    description: "Common questions answered",
    articles: [
      {
        id: "faq-general",
        title: "Frequently Asked Questions",
        subtitle: "Quick answers to common questions",
        icon: <HelpCircle className="w-4 h-4" />,
        content: (
          <div className="space-y-6">
            <div className="space-y-5">
              <FaqItem q="Is Dopl free?">
                Dopl uses a pay-as-you-go model. New accounts receive a $5 welcome credit. After that, you only pay for what you use — there are no monthly subscriptions. Add funds anytime from Settings.
              </FaqItem>

              <FaqItem q="What AI model does Dopl use?">
                Dopl uses Claude by Anthropic (Sonnet for chat, Haiku for background tasks). The specific model can be selected per conversation — Haiku for fast/cheap, Sonnet for balanced, Opus for maximum intelligence.
              </FaqItem>

              <FaqItem q="Can Dopl access my email and calendar?">
                Only if you explicitly connect them in Integrations. Dopl requests read-only access by default and only takes actions (like sending emails) when you ask. You can revoke access at any time.
              </FaqItem>

              <FaqItem q="Is my data used to train AI?">
                No. Your conversations, memories, and files are never used for AI training. They exist solely to serve you.
              </FaqItem>

              <FaqItem q="Can I use Dopl on my phone?">
                The web app works on mobile browsers. A dedicated mobile app is planned but not yet available.
              </FaqItem>

              <FaqItem q="What happens if I delete my account?">
                Everything is permanently deleted — conversations, Brain memories, files, API keys, connected integrations. This cannot be undone.
              </FaqItem>

              <FaqItem q="Do I need the Desktop Companion or Browser Extension?">
                No — they&apos;re optional. The web app is fully functional on its own. The Companion and Extension add extra capabilities (local computer access and browser control) but Dopl works great without them.
              </FaqItem>

              <FaqItem q="Can other people see my Dopl conversations?">
                No. Your data is private to your account. There is no sharing, no social features, and no way for anyone (including Dopl&apos;s creators) to see your conversations without database-level access, which is restricted and audited.
              </FaqItem>
            </div>
          </div>
        ),
      },
    ],
  },
];

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border border-white/[0.08] bg-white/[0.02]">
      <p className="text-[14px] font-medium text-white/80 mb-2">{q}</p>
      <p className="text-[13px] text-white/45 leading-relaxed">{children}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   Main Docs Client
───────────────────────────────────────────────────────── */

export default function DocsPageClient() {
  const [activeArticle, setActiveArticle] = useState("what-is-dopl");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(SECTIONS.map((s) => s.id))
  );

  const currentArticle = SECTIONS.flatMap((s) => s.articles).find((a) => a.id === activeArticle);
  const currentSection = SECTIONS.find((s) => s.articles.some((a) => a.id === activeArticle));

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <div className="mb-6">
        <h1
          className="text-2xl sm:text-3xl text-white/90 mb-1"
          style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
        >
          Documentation
        </h1>
        <p className="text-[13px] text-white/40">
          Everything you need to know about Dopl
        </p>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row" style={{ gap: "7px" }}>
        {/* Sidebar — glass panel */}
        <aside
          className="lg:w-64 flex-shrink-0 bg-black/[0.07] backdrop-blur-[10px] border border-white/[0.08] p-4 lg:self-start lg:sticky lg:top-20"
          style={{ borderRadius: "3px" }}
        >
          <nav className="space-y-1">
            {SECTIONS.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const hasActiveArticle = section.articles.some((a) => a.id === activeArticle);
              return (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full text-left flex items-center gap-2 py-2 px-2 hover:bg-white/[0.04] transition-colors group"
                    style={{ borderRadius: "2px" }}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] font-semibold ${hasActiveArticle ? "text-white/80" : "text-white/50"} group-hover:text-white/70 transition-colors`}>
                        {section.label}
                      </p>
                      {!isExpanded && (
                        <p className="text-[10px] text-white/25 truncate mt-0.5">{section.description}</p>
                      )}
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="ml-3 pl-3 border-l border-white/[0.06] space-y-0.5 pb-2">
                      {section.articles.map((article) => (
                        <button
                          key={article.id}
                          onClick={() => setActiveArticle(article.id)}
                          className={`w-full text-left py-1.5 px-2 transition-colors flex items-start gap-2 ${
                            activeArticle === article.id
                              ? "bg-white/[0.06] text-white/85"
                              : "text-white/40 hover:text-white/60 hover:bg-white/[0.03]"
                          }`}
                          style={{ borderRadius: "2px" }}
                        >
                          <span className="flex-shrink-0 mt-0.5 opacity-50">{article.icon}</span>
                          <div className="min-w-0">
                            <p className="text-[12px] leading-tight">{article.title}</p>
                            <p className="text-[10px] text-white/25 truncate mt-0.5">{article.subtitle}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </aside>

        {/* Article content — glass panel */}
        <article
          className="flex-1 min-w-0 bg-black/[0.07] backdrop-blur-[10px] border border-white/[0.08]"
          style={{ borderRadius: "3px" }}
        >
          {currentArticle && (
            <div className="p-6 sm:p-8">
              {/* Breadcrumb */}
              {currentSection && (
                <p className="text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold mb-4">
                  {currentSection.label}
                </p>
              )}

              {/* Title */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-white/40">{currentArticle.icon}</span>
                  <h2
                    className="text-xl sm:text-2xl text-white/90"
                    style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
                  >
                    {currentArticle.title}
                  </h2>
                </div>
                <p className="text-[13px] text-white/40 ml-7">{currentArticle.subtitle}</p>
              </div>

              {/* Content */}
              <div className="text-[14px] leading-relaxed text-white/55">
                {currentArticle.content}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
