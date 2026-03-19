"use client";

import { X, Zap } from "lucide-react";

interface UsageLimitModalProps {
  reason: string;           // "Daily usage limit reached"
  nextResetLabel: string;   // "Resets tomorrow at midnight UTC"
  currentPlan: string;      // "free"
  onUpgrade: () => void;    // opens pricing modal
  onClose: () => void;
}

export function UsageLimitModal({
  reason,
  nextResetLabel,
  currentPlan,
  onUpgrade,
  onClose,
}: UsageLimitModalProps) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-sm rounded-[3px] border border-white/10 bg-black/[0.07] backdrop-blur-[20px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400/80" />
            <span className="text-[13px] font-semibold text-white/90">Usage Limit Reached</span>
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
            <p className="text-[14px] text-white/80 font-medium">{reason}</p>
            <p className="text-[12px] text-white/50 font-mono">{nextResetLabel}</p>
          </div>

          {currentPlan === "free" ? (
            <p className="text-[12px] text-white/50 leading-relaxed">
              You&apos;re on the Trial plan. Upgrade for significantly more daily usage.
            </p>
          ) : (
            <p className="text-[12px] text-white/50 leading-relaxed">
              Upgrade your plan for more daily and weekly usage.
            </p>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={onUpgrade}
              className="w-full py-2.5 font-mono text-[12px] bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors rounded-[2px]"
            >
              Upgrade Plan →
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 font-mono text-[11px] text-white/40 hover:text-white/70 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
