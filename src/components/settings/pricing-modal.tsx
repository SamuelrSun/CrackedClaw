"use client";

import { useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { PLANS, ALL_FEATURES } from "@/lib/plans";
import type { PlanSlug } from "@/lib/plans";
import type { CreditStatus } from "@/lib/usage/types";

interface PricingModalProps {
  onClose: () => void;
  currentPlan: string;
  creditStatus?: CreditStatus | null;
  onUpgrade: (plan: string) => Promise<void>;
  onManageBilling: () => Promise<void>;
}

export function PricingModal({ onClose, currentPlan, creditStatus, onUpgrade, onManageBilling }: PricingModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSelect(slug: PlanSlug) {
    if (slug === currentPlan) return;
    setLoading(slug);
    try {
      await onUpgrade(slug);
    } finally {
      setLoading(null);
    }
  }

  const planOrder: PlanSlug[] = ["free", "starter", "pro", "power"];

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-[900px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with credit status */}
        <div className="px-6 py-5 border-b border-white/[0.08]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[15px] font-semibold text-white">Plans & Credits</h2>
            <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {creditStatus && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-mono text-[12px] text-white/70">
                  <span className="text-white font-semibold">{creditStatus.daily.remaining}</span> credits remaining today
                  {creditStatus.monthly.poolLimit > 0 && (
                    <span className="text-white/40">
                      {" "}&middot; <span className="text-white/60">{creditStatus.monthly.poolBalance}</span> monthly pool
                    </span>
                  )}
                </span>
              </div>
              {/* Daily progress bar */}
              <div className="w-full h-1.5 bg-white/[0.08] overflow-hidden rounded-[1px]">
                {(() => {
                  const pct = creditStatus.daily.limit > 0
                    ? Math.round((creditStatus.daily.used / creditStatus.daily.limit) * 100)
                    : 0;
                  return (
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${Math.min(pct, 100)}%`,
                        background: pct >= 90 ? "#f87171" : pct >= 70 ? "#fbbf24" : "#34d399",
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-[1px] bg-white/[0.06] p-[1px]">
          {planOrder.map((slug) => {
            const plan = PLANS[slug];
            const isCurrent = slug === currentPlan;
            const isPopular = slug === "pro";
            const isLoading = loading === slug;

            return (
              <div
                key={slug}
                className={`relative flex flex-col bg-black/[0.35] backdrop-blur-sm p-5 ${isPopular ? "bg-white/[0.06]" : ""}`}
              >
                {/* Popular badge */}
                {isPopular && (
                  <div className="absolute top-3 right-3">
                    <span className="text-[9px] uppercase tracking-widest font-medium px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                      Popular
                    </span>
                  </div>
                )}

                {/* Plan name & price */}
                <div className="mb-4">
                  <p className="text-[11px] uppercase tracking-widest text-white/40 font-medium font-mono mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">
                      {plan.price === 0 ? "Free" : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && <span className="text-[11px] text-white/40">/mo</span>}
                  </div>
                </div>

                {/* Credit details */}
                <div className="space-y-1.5 mb-5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-emerald-400/60" />
                    <span className="font-mono text-[11px] text-white/60">
                      {plan.dailyCredits} daily credits
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 flex items-center justify-center text-[10px] text-white/30">+</span>
                    <span className="font-mono text-[11px] text-white/50">
                      {plan.monthlyPool > 0 ? `${plan.monthlyPool} monthly pool` : "No monthly pool"}
                    </span>
                  </div>
                  <div className="pt-1 border-t border-white/[0.06]">
                    <span className="font-mono text-[10px] text-white/35 uppercase tracking-wider">
                      Up to {plan.maxMonthly}/mo
                    </span>
                  </div>
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-2 text-center font-mono text-[11px] text-white/30 border border-white/[0.08] rounded-[2px]">
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelect(slug)}
                    disabled={!!loading}
                    className={`w-full py-2 font-mono text-[11px] transition-colors rounded-[2px] disabled:opacity-50 ${
                      isPopular
                        ? "bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400"
                        : "bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70"
                    }`}
                  >
                    {isLoading ? "Opening..." : slug === "free" ? "Downgrade" : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* All features */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-3">All plans include</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {ALL_FEATURES.map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-400/60 flex-shrink-0" />
                <span className="font-mono text-[11px] text-white/50">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-white/30 font-mono">
            Top-ups: $1 per 10 credits. Billed monthly.
          </p>
          {currentPlan !== "free" && (
            <button
              onClick={async () => { setLoading("billing"); await onManageBilling(); setLoading(null); }}
              disabled={!!loading}
              className="font-mono text-[11px] text-white/40 hover:text-white/70 transition-colors underline underline-offset-2 disabled:opacity-50"
            >
              {loading === "billing" ? "Opening..." : "Manage billing & invoices"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
