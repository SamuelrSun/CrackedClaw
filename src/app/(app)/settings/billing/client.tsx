"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, RefreshCw, ChevronDown, ChevronUp, Zap, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface WalletStatus {
  balance_usd: number;
  total_deposited_usd: number;
  total_spent_usd: number;
  today_spent_usd: number;
  allowed: boolean;
  reason?: string;
  auto_reload: {
    enabled: boolean;
    amount: number | null;
    threshold: number | null;
  };
  breakdown: Record<string, number>;
}

interface HistoryEntry {
  id: string;
  created_at: string;
  type: "deposit" | "stipend" | "refund" | "auto_reload" | "chat_spend";
  amount_usd: number;
  description: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
}

interface BillingPageClientProps {
  currentPlan: string;
  isSubscribed: boolean;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export function BillingPageClient({ currentPlan: _currentPlan, isSubscribed: _isSubscribed }: BillingPageClientProps) {
  const [wallet, setWallet] = useState<WalletStatus | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "deposits" | "spend">("all");
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [addFundsLoading, setAddFundsLoading] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");

  // Auto-reload state
  const [autoReloadEnabled, setAutoReloadEnabled] = useState(false);
  const [autoReloadAmount, setAutoReloadAmount] = useState("10");
  const [autoReloadThreshold, setAutoReloadThreshold] = useState("2");
  const [autoReloadSaving, setAutoReloadSaving] = useState(false);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch("/api/usage/status");
      if (res.ok) {
        const data = await res.json();
        setWallet(data);
        setAutoReloadEnabled(data.auto_reload?.enabled ?? false);
        if (data.auto_reload?.amount) setAutoReloadAmount(String(data.auto_reload.amount));
        if (data.auto_reload?.threshold) setAutoReloadThreshold(String(data.auto_reload.threshold));
      }
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`/api/billing/history?filter=${historyFilter}&limit=30`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.entries || []);
      }
    } catch { /* ignore */ }
  }, [historyFilter]);

  useEffect(() => {
    Promise.all([fetchWallet(), fetchHistory()]).finally(() => setLoading(false));
  }, [fetchWallet, fetchHistory]);

  useEffect(() => {
    fetchHistory();
  }, [historyFilter, fetchHistory]);

  async function handleAddFunds(amount: number) {
    if (amount < 5) return;
    setAddFundsLoading(amount);
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
      alert("Failed to start checkout");
    } finally {
      setAddFundsLoading(null);
    }
  }

  async function handleAutoReloadToggle() {
    setAutoReloadSaving(true);
    try {
      const res = await fetch("/api/billing/auto-reload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          autoReloadEnabled
            ? { enabled: false }
            : {
                enabled: true,
                amount: parseFloat(autoReloadAmount) || 10,
                threshold: parseFloat(autoReloadThreshold) || 2,
              }
        ),
      });
      const data = await res.json();
      if (data.success) {
        setAutoReloadEnabled(data.enabled);
        await fetchWallet();
      } else {
        alert(data.error || "Failed to update auto-reload");
      }
    } catch {
      alert("Failed to update auto-reload");
    } finally {
      setAutoReloadSaving(false);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function balanceColor(balance: number) {
    if (balance > 5) return "#34d399";
    if (balance > 1) return "#fbbf24";
    return "#f87171";
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
        <div className="font-mono text-[12px] text-white/30">Loading billing...</div>
      </div>
    );
  }

  const balance = wallet?.balance_usd ?? 0;

  return (
    <div className="min-h-screen bg-[#0d0d12] p-6 md:p-10">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link
              href="/settings"
              className="font-mono text-[11px] uppercase tracking-wide text-white/30 hover:text-white/80 transition-colors"
            >
              &larr; Settings
            </Link>
          </div>
          <h1 className="font-mono text-3xl font-bold text-white/80 tracking-tight">
            Billing
          </h1>
          <p className="font-mono text-[12px] text-white/30 mt-1">
            Pay only for what you use. No subscriptions.
          </p>
        </div>

        {/* Balance Card */}
        <div className="border border-white/[0.1] bg-black/[0.07] backdrop-blur-[20px] p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-2">
                Balance
              </p>
              <div className="flex items-baseline gap-1">
                <span
                  className="font-mono text-5xl font-bold"
                  style={{ color: balanceColor(balance) }}
                >
                  ${balance.toFixed(2)}
                </span>
              </div>
              {wallet && wallet.today_spent_usd > 0 && (
                <p className="font-mono text-[11px] text-white/30 mt-2">
                  ${wallet.today_spent_usd.toFixed(2)} spent today
                </p>
              )}
            </div>
            <Zap className="w-5 h-5 text-white/10" />
          </div>

          {/* Low balance warning */}
          {balance <= 0 && (
            <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 mb-4">
              <p className="font-mono text-[11px] text-red-400">
                Your balance is empty. Add funds to continue chatting.
              </p>
            </div>
          )}
          {balance > 0 && balance <= 1 && (
            <div className="px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 mb-4">
              <p className="font-mono text-[11px] text-yellow-400">
                Low balance — consider adding funds soon.
              </p>
            </div>
          )}

          {/* Add Funds */}
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-3">
              Add Funds
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PRESET_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => handleAddFunds(amt)}
                  disabled={addFundsLoading !== null}
                  className="font-mono text-[12px] px-4 py-2 bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-white/70 transition-colors disabled:opacity-50"
                >
                  {addFundsLoading === amt ? "..." : `$${amt}`}
                </button>
              ))}
            </div>
            {/* Custom amount */}
            <div className="flex gap-2">
              <input
                type="number"
                min="5"
                max="500"
                placeholder="Custom amount"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="font-mono text-[12px] px-3 py-2 bg-white/[0.04] border border-white/[0.1] text-white/80 placeholder-white/20 w-40 outline-none focus:border-white/20"
              />
              <button
                onClick={() => {
                  const amt = parseFloat(customAmount);
                  if (amt >= 5) handleAddFunds(amt);
                }}
                disabled={addFundsLoading !== null || !customAmount || parseFloat(customAmount) < 5}
                className="font-mono text-[11px] px-4 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
            <p className="font-mono text-[10px] text-white/20 mt-2">$5 minimum</p>
          </div>
        </div>

        {/* Auto-Reload */}
        <div className="border border-white/[0.1] bg-black/[0.07] backdrop-blur-[20px] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-mono text-[12px] text-white/70 font-medium">
                Auto-Reload
              </p>
              <p className="font-mono text-[10px] text-white/30 mt-0.5">
                Automatically add funds when balance is low
              </p>
            </div>
            <button
              onClick={handleAutoReloadToggle}
              disabled={autoReloadSaving}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                autoReloadEnabled ? "bg-emerald-500/40" : "bg-white/[0.1]"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full transition-all ${
                  autoReloadEnabled
                    ? "left-[22px] bg-emerald-400"
                    : "left-0.5 bg-white/30"
                }`}
              />
            </button>
          </div>

          {/* Auto-reload config (shown when toggle area is visible) */}
          <div className={`grid grid-cols-2 gap-3 mt-3 ${autoReloadEnabled ? "" : "opacity-40 pointer-events-none"}`}>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wide text-white/30 block mb-1">
                Reload Amount
              </label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[12px] text-white/40">$</span>
                <input
                  type="number"
                  min="5"
                  value={autoReloadAmount}
                  onChange={(e) => setAutoReloadAmount(e.target.value)}
                  className="font-mono text-[12px] px-2 py-1.5 bg-white/[0.04] border border-white/[0.1] text-white/80 w-20 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-wide text-white/30 block mb-1">
                When Below
              </label>
              <div className="flex items-center gap-1">
                <span className="font-mono text-[12px] text-white/40">$</span>
                <input
                  type="number"
                  min="1"
                  value={autoReloadThreshold}
                  onChange={(e) => setAutoReloadThreshold(e.target.value)}
                  className="font-mono text-[12px] px-2 py-1.5 bg-white/[0.04] border border-white/[0.1] text-white/80 w-20 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Spend Breakdown */}
        {wallet && Object.keys(wallet.breakdown).length > 0 && (
          <div className="border border-white/[0.1] bg-black/[0.07] backdrop-blur-[20px] p-5 mb-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30 mb-3">
              Spend Breakdown (30 days)
            </p>
            <div className="space-y-2">
              {Object.entries(wallet.breakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([source, cost]) => (
                  <div key={source} className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-white/50 capitalize">
                      {source.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-[11px] text-white/70">
                      ${cost.toFixed(4)}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
              <span className="font-mono text-[11px] text-white/40">Total</span>
              <span className="font-mono text-[12px] text-white/80 font-medium">
                ${wallet.total_spent_usd.toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Billing History */}
        <div className="border border-white/[0.1] bg-black/[0.07] backdrop-blur-[20px] p-5">
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setHistoryExpanded(!historyExpanded)}
          >
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/30">
              Billing History
            </p>
            {historyExpanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-white/30" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-white/30" />
            )}
          </div>

          {historyExpanded && (
            <>
              {/* Filters */}
              <div className="flex gap-2 mt-3 mb-4">
                {(["all", "deposits", "spend"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={`font-mono text-[10px] uppercase tracking-wide px-3 py-1 border transition-colors ${
                      historyFilter === f
                        ? "border-white/20 text-white/70 bg-white/[0.06]"
                        : "border-white/[0.06] text-white/30 hover:text-white/50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Entries */}
              <div className="space-y-1">
                {history.length === 0 ? (
                  <p className="font-mono text-[11px] text-white/20 py-4 text-center">
                    No history yet
                  </p>
                ) : (
                  history.map((entry) => {
                    const isDeposit = entry.type !== "chat_spend";
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          {isDeposit ? (
                            <ArrowDownLeft className="w-3 h-3 text-emerald-400/60" />
                          ) : (
                            <ArrowUpRight className="w-3 h-3 text-white/20" />
                          )}
                          <div>
                            <p className="font-mono text-[11px] text-white/60">
                              {entry.description}
                            </p>
                            <p className="font-mono text-[9px] text-white/20">
                              {formatDate(entry.created_at)}
                              {entry.input_tokens
                                ? ` · ${entry.input_tokens.toLocaleString()} in / ${(entry.output_tokens || 0).toLocaleString()} out`
                                : ""}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`font-mono text-[11px] ${
                            isDeposit ? "text-emerald-400" : "text-white/40"
                          }`}
                        >
                          {isDeposit ? "+" : "-"}${Math.abs(entry.amount_usd).toFixed(
                            entry.amount_usd < 0.01 ? 4 : 2
                          )}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Lifetime stats */}
        {wallet && (
          <div className="flex gap-6 mt-6 px-1">
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/20">
                Total Deposited
              </p>
              <p className="font-mono text-[13px] text-white/50">
                ${wallet.total_deposited_usd.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase tracking-widest text-white/20">
                Total Spent
              </p>
              <p className="font-mono text-[13px] text-white/50">
                ${wallet.total_spent_usd.toFixed(2)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
