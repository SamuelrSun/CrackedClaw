"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";

interface UsageLimitModalProps {
  reason: string;
  nextResetLabel?: string;
  currentPlan?: string;
  balance?: number;
  onUpgrade: () => void;
  onClose: () => void;
}

const QUICK_AMOUNTS = [5, 10, 25];

export function UsageLimitModal({
  reason,
  balance,
  onUpgrade: _onUpgrade,
  onClose,
}: UsageLimitModalProps) {
  const [loading, setLoading] = useState<number | null>(null);

  async function handleAddFunds(amount: number) {
    setLoading(amount);
    try {
      const res = await fetch("/api/billing/add-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch { /* ignore */ }
    finally { setLoading(null); }
  }

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-sm rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400/80" />
            <span className="text-[13px] font-semibold text-white/90">
              {balance !== undefined && balance <= 0 ? "Balance Empty" : "Add Funds"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">
          <div className="space-y-1">
            <p className="text-[14px] text-white/80 font-medium">
              {reason || "Your balance is $0.00"}
            </p>
            {balance !== undefined && (
              <p className="font-mono text-[22px] font-bold text-red-400">
                ${balance.toFixed(2)}
              </p>
            )}
          </div>

          <p className="text-[12px] text-white/50 leading-relaxed">
            Add funds to continue chatting. You only pay for what you use.
          </p>

          <div className="flex gap-2 pt-1">
            {QUICK_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => handleAddFunds(amt)}
                disabled={loading !== null}
                className="flex-1 py-2.5 font-mono text-[13px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50"
              >
                {loading === amt ? "..." : `$${amt}`}
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full py-2 font-mono text-[11px] text-white/40 hover:text-white/70 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
