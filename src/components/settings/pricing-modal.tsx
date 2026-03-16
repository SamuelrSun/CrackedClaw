"use client";

import { useState } from "react";
import { Check, X, Zap } from "lucide-react";
import { PLANS } from "@/lib/plans";
import type { PlanSlug } from "@/lib/plans";

interface PricingModalProps {
  onClose: () => void;
  currentPlan: string;
  onUpgrade: (plan: PlanSlug) => Promise<void>;
  onManageBilling: () => Promise<void>;
}

export function PricingModal({ onClose, currentPlan, onUpgrade, onManageBilling }: PricingModalProps) {
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
        className="relative z-10 w-full max-w-[860px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.08]">
          <div>
            <h2 className="text-[15px] font-semibold text-white">Plans & Usage</h2>
            <p className="text-[11px] text-white/40 mt-0.5">
              You&apos;re currently on the <span className="text-white/70 capitalize">{currentPlan}</span> plan
            </p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
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
                  <p className="text-[11px] uppercase tracking-widest text-white/40 font-medium mb-2">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-white">${plan.price}</span>
                    <span className="text-[11px] text-white/40">/mo</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Zap className="w-3 h-3 text-white/30" />
                    <span className="text-[11px] text-white/50">
                      {slug === "free"
                        ? "10k tokens / week"
                        : `${(plan.monthlyTokens / 1_000_000).toFixed(1).replace(".0", "")}M tokens / mo`}
                    </span>
                  </div>
                </div>

                {/* Features */}
                <ul className="flex flex-col gap-1.5 flex-1 mb-5">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3 h-3 text-emerald-400/70 mt-0.5 flex-shrink-0" />
                      <span className="text-[11px] text-white/60 leading-snug">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <div className="w-full py-2 text-center text-[11px] text-white/30 border border-white/[0.08] rounded-[2px]">
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelect(slug)}
                    disabled={!!loading}
                    className={`w-full py-2 text-[11px] transition-colors rounded-[2px] disabled:opacity-50 ${
                      isPopular
                        ? "bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400"
                        : "bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70"
                    }`}
                  >
                    {isLoading ? "Opening…" : slug === "free" ? "Downgrade" : "Upgrade"}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
          <p className="text-[11px] text-white/30">
            Billed monthly. Cancel anytime.
          </p>
          {currentPlan !== "free" && (
            <button
              onClick={async () => { setLoading("billing"); await onManageBilling(); setLoading(null); }}
              disabled={!!loading}
              className="text-[11px] text-white/40 hover:text-white/70 transition-colors underline underline-offset-2 disabled:opacity-50"
            >
              {loading === "billing" ? "Opening…" : "Manage billing & invoices →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
