import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Dopl",
  description: "Dopl AI Companion pricing plans and services.",
};

const plans = [
  {
    name: "Starter",
    price: "$10",
    period: "/month",
    description: "For individuals getting started with AI automation.",
    features: [
      "AI companion agent",
      "Connect email, calendar & messaging",
      "Task delegation & reminders",
      "Basic automation workflows",
      "Web app access",
    ],
  },
  {
    name: "Pro",
    price: "$25",
    period: "/month",
    highlight: true,
    description: "For professionals who want to automate their daily workflow.",
    features: [
      "Everything in Starter",
      "Higher AI compute limits",
      "Chrome extension + desktop app",
      "Advanced integrations (Slack, Notion, etc.)",
      "Priority response times",
      "Brain — portable AI memory",
    ],
  },
  {
    name: "Power",
    price: "$50",
    period: "/month",
    description: "For power users and teams running AI at scale.",
    features: [
      "Everything in Pro",
      "Maximum AI compute allocation",
      "Autonomous multi-step workflows",
      "Bring your own API keys (BYOK)",
      "Custom integrations via Maton",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "$100",
    period: "/month",
    description: "Full platform access with unlimited potential.",
    features: [
      "Everything in Power",
      "Dedicated compute resources",
      "Custom agent configurations",
      "Team collaboration features",
      "SSO & compliance controls",
      "Direct support channel",
    ],
  },
];

export default function PricingPage() {
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
      <div className="fixed inset-0 z-0" style={{ background: "rgba(0,0,0,0.55)" }} />

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
          <Link href="/login" className="font-mono text-[10px] text-white/50 hover:text-white uppercase tracking-wide transition-colors">
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-16">
          <h1
            className="text-3xl font-bold mb-3 text-white"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
          >
            Pricing
          </h1>
          <p className="font-mono text-[11px] text-white/40 uppercase tracking-wide mb-8">
            Simple, transparent pricing
          </p>
          <p className="text-white/60 text-sm max-w-2xl mx-auto leading-relaxed">
            Dopl is an AI-powered personal assistant platform. Connect your accounts — email, calendar,
            messaging, and 80+ integrations — and let your always-on AI companion manage tasks, automate
            workflows, and operate on your behalf. Available via web app, Chrome extension, and macOS desktop app.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-[3px] border p-6 flex flex-col ${
                plan.highlight
                  ? "bg-white/[0.08] border-white/20 backdrop-blur-[10px]"
                  : "bg-black/[0.07] border-white/10 backdrop-blur-[10px]"
              }`}
            >
              <div className="mb-4">
                <h3 className="font-mono text-[11px] uppercase tracking-widest text-white/50 mb-2">
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-white">{plan.price}</span>
                  <span className="font-mono text-[10px] text-white/40">{plan.period}</span>
                </div>
              </div>
              <p className="text-[12px] text-white/50 mb-5 leading-relaxed">
                {plan.description}
              </p>
              <ul className="space-y-2.5 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="font-mono text-[10px] text-emerald-400/60 mt-0.5">✓</span>
                    <span className="font-mono text-[11px] text-white/60">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/welcome"
                className={`mt-6 block text-center font-mono text-[10px] uppercase tracking-wider py-2.5 rounded-[2px] transition-colors ${
                  plan.highlight
                    ? "bg-white/15 text-white hover:bg-white/20 border border-white/20"
                    : "bg-white/[0.05] text-white/60 hover:text-white/80 hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>

        {/* Pay As You Go */}
        <div className="bg-black/[0.07] backdrop-blur-[10px] border border-white/10 rounded-[3px] p-8 mb-16">
          <h2
            className="text-xl font-bold mb-3 text-white"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
          >
            Pay As You Go
          </h2>
          <p className="text-[12px] text-white/50 leading-relaxed max-w-2xl mb-4">
            Need more flexibility? Add funds to your wallet and pay only for the AI compute you use.
            No commitment, no expiration. Minimum deposit of $5.
          </p>
          <div className="flex flex-wrap gap-4 font-mono text-[11px] text-white/40">
            <span>$5 minimum deposit</span>
            <span className="text-white/15">|</span>
            <span>Per-message billing</span>
            <span className="text-white/15">|</span>
            <span>Auto-reload available</span>
            <span className="text-white/15">|</span>
            <span>No expiration</span>
          </div>
        </div>

        {/* What is Dopl */}
        <div className="max-w-3xl mx-auto mb-16">
          <h2
            className="text-xl font-bold mb-6 text-white"
            style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}
          >
            What is Dopl?
          </h2>
          <div className="space-y-4 text-[13px] text-white/50 leading-relaxed">
            <p>
              Dopl is a SaaS platform that provides AI-powered personal assistant agents. Each user receives
              a dedicated AI companion that learns their preferences, connects to their digital accounts,
              and autonomously manages tasks on their behalf.
            </p>
            <p>
              The platform supports 80+ integrations including email (Gmail, Outlook), calendar (Google Calendar),
              messaging (Slack, WhatsApp, Telegram), productivity tools (Notion, Airtable, Linear), and
              developer platforms (GitHub, Jira) — all connected through secure OAuth or managed API gateways.
            </p>
            <p>
              Key capabilities include: intelligent task delegation, automated workflow execution, persistent
              AI memory (Brain) that learns user preferences over time, real-time browser automation via
              Chrome extension, and cross-platform access through web, desktop, and mobile interfaces.
            </p>
            <p>
              Dopl processes payments through Stripe for both recurring subscriptions and one-time wallet
              deposits. Users select a plan or add pay-as-you-go credits, and are billed based on AI compute
              usage with transparent per-message cost tracking.
            </p>
          </div>
        </div>

        {/* Footer links */}
        <div className="border-t border-white/[0.06] pt-8 flex justify-center gap-8">
          <Link href="/terms" className="font-mono text-[10px] text-white/30 hover:text-white/60 transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="font-mono text-[10px] text-white/30 hover:text-white/60 transition-colors">
            Privacy Policy
          </Link>
          <Link href="/" className="font-mono text-[10px] text-white/30 hover:text-white/60 transition-colors">
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
