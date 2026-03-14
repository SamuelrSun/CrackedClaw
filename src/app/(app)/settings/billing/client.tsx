"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PLANS, type PlanSlug } from "@/lib/plans";

interface UsageStatus {
  plan: string;
  weekly: { used: number; limit: number; resetDate: string };
  monthly: { used: number; limit: number; resetDate: string };
  percentWeekly: number;
  percentMonthly: number;
}

interface BillingPageClientProps {
  currentPlan: string;
  isSubscribed: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

function UsageBar({ label, used, limit, percent, resetDate }: {
  label: string;
  used: number;
  limit: number;
  percent: number;
  resetDate: string;
}) {
  const color = percent >= 100 ? 'bg-red-500' : percent >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="font-mono text-[11px] uppercase tracking-wide text-[rgba(58,58,56,0.5)]">{label}</span>
        <span className="font-mono text-[11px] text-[rgba(58,58,56,0.6)]">
          {formatTokens(used)} / {formatTokens(limit)}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[rgba(58,58,56,0.08)]">
        <div
          className={`h-full ${color} transition-all`}
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <p className="font-mono text-[10px] text-[rgba(58,58,56,0.4)]">Resets {resetDate}</p>
    </div>
  );
}

export function BillingPageClient({ currentPlan, isSubscribed }: BillingPageClientProps) {
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<UsageStatus | null>(null);

  useEffect(() => {
    fetch('/api/usage/status')
      .then(r => r.ok ? r.json() : null)
      .then(d => setUsage(d))
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

  const planOrder: PlanSlug[] = ['free', 'starter', 'pro', 'power'];

  return (
    <div className="min-h-screen bg-[#0d0d12] p-6 md:p-10">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-10">
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/settings"
            className="font-mono text-[11px] uppercase tracking-wide text-[rgba(58,58,56,0.5)] hover:text-white/80 transition-colors"
          >
            ← Settings
          </Link>
        </div>
        <h1 className="font-mono text-4xl font-bold text-white/80 tracking-tight">
          Plan & Billing
        </h1>
        <p className="font-mono text-[13px] text-[rgba(58,58,56,0.55)] mt-2 uppercase tracking-wide">
          Choose the plan that fits your workflow
        </p>

        {/* Current usage */}
        {usage && (
          <div className="mt-6 border border-white/[0.1] bg-white p-5 max-w-lg space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-wide text-[rgba(58,58,56,0.5)]">
              Current Usage — {currentPlan.toUpperCase()} Plan
            </p>
            <UsageBar
              label="This week"
              used={usage.weekly.used}
              limit={usage.weekly.limit}
              percent={usage.percentWeekly}
              resetDate={usage.weekly.resetDate}
            />
            <UsageBar
              label="This month"
              used={usage.monthly.used}
              limit={usage.monthly.limit}
              percent={usage.percentMonthly}
              resetDate={usage.monthly.resetDate}
            />
          </div>
        )}
      </div>

      {/* Plan cards */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-white/[0.05]">
        {planOrder.map((slug) => {
          const plan = PLANS[slug];
          const isCurrent = currentPlan === slug;
          const isPaid = slug !== 'free';
          const isPopular = 'popular' in plan && plan.popular;

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
                {/* Current plan badge */}
                {isCurrent && (
                  <div className="mb-3">
                    <span className="font-mono text-[10px] uppercase tracking-wide bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/30 px-2 py-0.5">
                      Current Plan
                    </span>
                  </div>
                )}

                {/* Plan name */}
                <h2 className="font-mono text-[11px] uppercase tracking-widest text-[rgba(58,58,56,0.5)] mb-1">
                  {plan.name}
                </h2>

                {/* Price */}
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

                {/* Token info */}
                <div className="border-t border-[rgba(58,58,56,0.12)] pt-4 mb-4 space-y-1">
                  <p className="font-mono text-[12px] text-white/80 font-semibold">
                    {formatTokens(plan.monthlyTokens)} tokens/month
                  </p>
                  <p className="font-mono text-[11px] text-[rgba(58,58,56,0.5)]">
                    {formatTokens(plan.weeklyTokens)} tokens/week
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-[#10b981] font-mono text-[12px] mt-0.5 flex-shrink-0">✓</span>
                      <span className="font-mono text-[12px] text-[rgba(58,58,56,0.7)]">{f}</span>
                    </li>
                  ))}
                </ul>

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

      {/* Footer note */}
      <div className="max-w-5xl mx-auto mt-8">
        <p className="font-mono text-[11px] text-[rgba(58,58,56,0.4)] text-center">
          All plans include a 14-day free trial. Cancel anytime. Prices in USD.
        </p>
      </div>
    </div>
  );
}
