"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Check, Zap } from "lucide-react";
import { PLANS, ALL_FEATURES, type PlanSlug } from "@/lib/plans";
import type { CreditStatus } from "@/lib/usage/types";

interface BillingPageClientProps {
  currentPlan: string;
  isSubscribed: boolean;
}

export function BillingPageClient({ currentPlan, isSubscribed }: BillingPageClientProps) {
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [creditStatus, setCreditStatus] = useState<CreditStatus | null>(null);

  useEffect(() => {
    fetch('/api/usage/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => setCreditStatus(d))
      .catch(() => {});
  }, []);

  async function handleUpgrade(plan: PlanSlug) {
    setUpgrading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || 'Failed to start checkout');
    } catch {
      alert('Failed to start checkout');
    } finally {
      setUpgrading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      alert('Failed to open billing portal');
    } finally {
      setPortalLoading(false);
    }
  }

  const planOrder: PlanSlug[] = ['free', 'starter', 'pro', 'power', 'ultra'];

  return (
    <div className="min-h-screen bg-[#0d0d12] p-6 md:p-10">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/settings"
            className="font-mono text-[11px] uppercase tracking-wide text-[rgba(58,58,56,0.5)] hover:text-white/80 transition-colors"
          >
            &larr; Settings
          </Link>
        </div>
        <h1 className="font-mono text-4xl font-bold text-white/80 tracking-tight">
          Plan & Usage
        </h1>
        <p className="font-mono text-[13px] text-[rgba(58,58,56,0.55)] mt-2 uppercase tracking-wide">
          All features on every plan. Only usage limits differ.
        </p>

        {/* Credit status hero */}
        {creditStatus && (
          <div className="mt-6 border border-white/[0.1] bg-black/[0.07] backdrop-blur-[20px] p-5 max-w-lg space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-wide text-white/40">
              Current Usage &mdash; {currentPlan.toUpperCase()} Plan
            </p>

            {creditStatus.isTrial ? (
              <div className="space-y-2">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-3xl font-bold text-white/90">
                    {Number(creditStatus.trial.remaining).toFixed(1)}
                  </span>
                  <span className="font-mono text-[12px] text-white/50">trial credits remaining</span>
                </div>
                <div className="w-full h-1.5 bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${Math.min(creditStatus.trial.usedPercent, 100)}%`,
                      background: creditStatus.trial.usedPercent >= 90 ? "#f87171" : creditStatus.trial.usedPercent >= 70 ? "#fbbf24" : "#34d399",
                    }}
                  />
                </div>
                {creditStatus.trial.exhausted && (
                  <p className="font-mono text-[11px] text-white/50">Trial complete — upgrade to continue</p>
                )}
              </div>
            ) : (
              <>
                {/* Daily */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-white/40 w-16">DAILY</span>
                    <div className="flex-1 h-1.5 bg-white/[0.08] overflow-hidden rounded-[1px]">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(creditStatus.daily.usedPercent, 100)}%`,
                          background: creditStatus.daily.usedPercent >= 90 ? "#f87171" : creditStatus.daily.usedPercent >= 70 ? "#fbbf24" : "#34d399",
                        }}
                      />
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-white/30 pl-[4.5rem]">
                    Resets at midnight UTC
                  </p>
                </div>

                {/* Weekly */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] text-white/40 w-16">WEEKLY</span>
                    <div className="flex-1 h-1.5 bg-white/[0.08] overflow-hidden rounded-[1px]">
                      <div
                        className="h-full transition-all duration-500"
                        style={{
                          width: `${Math.min(creditStatus.weekly.usedPercent, 100)}%`,
                          background: creditStatus.weekly.usedPercent >= 90 ? "#f87171" : creditStatus.weekly.usedPercent >= 70 ? "#fbbf24" : "#34d399",
                        }}
                      />
                    </div>
                  </div>
                  <p className="font-mono text-[10px] text-white/30 pl-[4.5rem]">
                    Resets Monday
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-px bg-white/[0.05]">
        {planOrder.map((slug) => {
          const plan = PLANS[slug];
          const isCurrent = currentPlan === slug;
          const isPopular = slug === 'pro';

          return (
            <div
              key={slug}
              className={`bg-[#0d0d12] p-6 flex flex-col relative ${isCurrent ? 'ring-2 ring-[#10b981] ring-inset' : ''}`}
            >
              {/* Popular badge */}
              {isPopular && (
                <div className="absolute top-0 left-0 right-0 bg-[#10b981] px-3 py-1 text-center">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={isPopular ? 'mt-7' : ''}>
                {isCurrent && (
                  <div className="mb-3">
                    <span className="font-mono text-[10px] uppercase tracking-wide bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 px-2 py-0.5">
                      Current Plan
                    </span>
                  </div>
                )}

                <h2 className="font-mono text-[11px] uppercase tracking-widest text-[rgba(58,58,56,0.5)] mb-1">
                  {plan.name}
                </h2>

                <div className="mb-4">
                  {plan.price === 0 ? (
                    <span className="font-mono text-3xl font-bold text-white/80">Free</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="font-mono text-3xl font-bold text-white/80">${plan.price}</span>
                      <span className="font-mono text-[12px] text-[rgba(58,58,56,0.5)]">/mo</span>
                    </div>
                  )}
                </div>

                {/* Plan description */}
                <div className="border-t border-[rgba(58,58,56,0.12)] pt-4 mb-4 space-y-1.5 min-h-[80px]">
                  {slug === 'free' && (
                    <p className="font-mono text-[12px] text-white/70">
                      10 free messages to try Dopl
                    </p>
                  )}
                  {slug === 'starter' && (
                    <>
                      <p className="font-mono text-[12px] text-white/70">
                        Daily & weekly usage limits
                      </p>
                      <p className="font-mono text-[11px] text-[rgba(58,58,56,0.5)]">
                        Perfect for personal use
                      </p>
                    </>
                  )}
                  {slug === 'pro' && (
                    <>
                      <p className="font-mono text-[12px] text-white/80 font-semibold">
                        {plan.multiplierLabel} the usage of Starter
                      </p>
                      <p className="font-mono text-[11px] text-[rgba(58,58,56,0.5)]">
                        Great for power users
                      </p>
                    </>
                  )}
                  {slug === 'power' && (
                    <>
                      <p className="font-mono text-[12px] text-white/80 font-semibold">
                        {plan.multiplierLabel} the usage of Starter
                      </p>
                      <p className="font-mono text-[11px] text-[rgba(58,58,56,0.5)]">
                        For heavy workflows
                      </p>
                    </>
                  )}
                  {slug === 'ultra' && (
                    <>
                      <p className="font-mono text-[12px] text-white/80 font-semibold">
                        {plan.multiplierLabel} the usage of Starter
                      </p>
                      <p className="font-mono text-[11px] text-[rgba(58,58,56,0.5)]">
                        For teams & heavy automation
                      </p>
                    </>
                  )}
                </div>

                <div className="flex-1" />

                {/* CTA */}
                {isCurrent ? (
                  <>
                    <div className="w-full font-mono text-[11px] uppercase tracking-wide px-4 py-2.5 border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-center font-semibold">
                      Current Plan
                    </div>
                    {isSubscribed && (
                      <button
                        onClick={handleManageBilling}
                        disabled={portalLoading}
                        className="w-full mt-2 font-mono text-[11px] uppercase tracking-wide px-4 py-2 border border-white/[0.1] text-[rgba(58,58,56,0.5)] hover:border-[#1A3C2B] hover:text-white/80 transition-colors disabled:opacity-50"
                      >
                        {portalLoading ? 'Loading...' : 'Manage Billing'}
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleUpgrade(slug)}
                    disabled={upgrading === slug}
                    className={`w-full font-mono text-[11px] uppercase tracking-wide px-4 py-2.5 transition-colors disabled:opacity-50 ${
                      isPopular
                        ? 'bg-[#10b981] text-white hover:bg-[#0d9668]'
                        : 'bg-white/[0.12] text-[#F7F7F5] hover:bg-[#132d20]'
                    }`}
                  >
                    {upgrading === slug ? 'Redirecting...' : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* All features */}
      <div className="max-w-6xl mx-auto mt-8 border border-white/[0.08] bg-black/[0.07] backdrop-blur-[20px] p-6">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-4">All plans include</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {ALL_FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400/60 flex-shrink-0" />
              <span className="font-mono text-[12px] text-white/60">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-6xl mx-auto mt-6">
        <p className="font-mono text-[11px] text-[rgba(58,58,56,0.4)] text-center">
          All plans renew monthly. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
