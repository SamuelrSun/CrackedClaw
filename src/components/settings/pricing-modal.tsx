"use client";

import { useState } from "react";
import { X, Zap } from "lucide-react";

interface PricingModalProps {
  onClose: () => void;
  currentPlan: string;
  creditStatus?: unknown;
  onUpgrade: (plan: string) => Promise<void>;
  onManageBilling: () => Promise<void>;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function PricingModal({ onClose }: PricingModalProps) {
  const [loading, setLoading] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  // Fetch balance on mount
  useState(() => {
    fetch("/api/usage/status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBalance(d.balance_usd); })
      .catch(() => {});
  });

  async function handleAddFunds(amount: number) {
    if (amount < 5) return;
    setLoading(amount);
    try {
      const res = await fetch("/api/billing/add-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert(data.error || "Failed to start checkout");
    } catch {
      alert("Failed to connect to payment service");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-[440px] rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400/60" />
              <h2 className="text-[15px] font-semibold text-white">Add Funds</h2>
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white/80 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {balance !== null && (
            <p className="font-mono text-[12px] text-white/40 mt-2">
              Current balance: <span className="text-white/70">${balance.toFixed(2)}</span>
            </p>
          )}
        </div>

        {/* Amount selection */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-5 gap-2">
            {PRESET_AMOUNTS.map((amt) => (
              <button
                key={amt}
                onClick={() => handleAddFunds(amt)}
                disabled={loading !== null}
                className="font-mono text-[13px] py-3 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 transition-colors disabled:opacity-50"
              >
                {loading === amt ? "..." : `$${amt}`}
              </button>
            ))}
          </div>

          {/* Custom */}
          <div className="flex gap-2">
            <input
              type="number"
              min="5"
              max="500"
              placeholder="Custom amount ($5 min)"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="flex-1 font-mono text-[12px] px-3 py-2.5 bg-white/[0.04] border border-white/[0.1] text-white/80 placeholder-white/20 outline-none focus:border-white/20"
            />
            <button
              onClick={() => {
                const amt = parseFloat(customAmount);
                if (amt >= 5) handleAddFunds(amt);
              }}
              disabled={loading !== null || !customAmount || parseFloat(customAmount) < 5}
              className="font-mono text-[12px] px-5 py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <p className="font-mono text-[10px] text-white/20 text-center">
            Pay only for what you use. Your balance never expires.
          </p>
        </div>
      </div>
    </div>
  );
}
