"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard, GlassDivider } from "@/components/ui/glass-card";
import type { UserProfile } from "@/lib/supabase/data";
import {
  Sparkles,
  ArrowRight,
  Monitor,
  Zap,
  Smartphone,
  Download,
  Copy,
  Check,
  Trash2,
} from "lucide-react";


interface SettingsPageClientProps {
  initialTokenUsage: {
    used: number;
    limit: number;
    resetDate: string;
  };
  initialProfile: UserProfile | null;
}

interface NodeDevice {
  id: string;
  name: string;
  status: string;
  lastSeen?: string;
}

function StatusDot({ status }: { status: "green" | "gray" | "red" }) {
  const colors = {
    green: "bg-emerald-400",
    gray: "bg-white/20",
    red: "bg-red-400",
  };
  return (
    <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${colors[status]}`} />
  );
}

function CompanionSetupInline() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/node/connection-token")
      .then(r => r.ok ? r.json() : null)
      .then(d => setToken(d?.token ?? null))
      .catch(() => setToken(null))
      .finally(() => setTokenLoading(false));
  }, []);

  function copyToken() {
    if (!token) return;
    navigator.clipboard.writeText(token).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-[13px] text-white/50 leading-relaxed">
        The companion app runs on your Mac and gives your AI access to local apps, files, and your browser.
      </p>

      {/* Download */}
      <a
        href="/downloads/dopl-connect.dmg"
        className="flex items-center gap-2 w-full px-4 py-3 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.15] rounded-xl text-white/80 text-[13px] transition-colors"
      >
        <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Download Dopl Connect (.dmg)</span>
        <ArrowRight className="w-3 h-3 ml-auto text-white/40" />
      </a>

      {/* Steps */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Setup</p>
        {[
          {
            n: "1",
            title: "Install the app",
            desc: "Open the downloaded .dmg and drag Dopl Connect to Applications.",
          },
          {
            n: "2",
            title: "Grant permissions",
            desc: "Enable Accessibility, Screen Recording, and Full Disk Access in System Settings → Privacy & Security.",
          },
          {
            n: "3",
            title: "Paste your connection token",
            desc: "Open Dopl Connect and paste the token below.",
          },
        ].map(step => (
          <div key={step.n} className="flex gap-3">
            <span className="text-[13px] text-emerald-400 font-bold w-5 flex-shrink-0 pt-0.5">{step.n}.</span>
            <div>
              <p className="text-[13px] text-white/80 font-medium">{step.title}</p>
              <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Token */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-white/30">Connection Token</p>
        {tokenLoading ? (
          <div className="h-10 bg-white/[0.05] animate-pulse rounded-lg" />
        ) : token ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-white/60 bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 rounded-lg truncate">
              {token}
            </code>
            <button
              onClick={copyToken}
              className="flex-shrink-0 p-2.5 bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.15] rounded-lg transition-colors"
              title="Copy token"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-white/50" />
              )}
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-red-400">Failed to load token — refresh and try again.</p>
        )}
      </div>
    </div>
  );
}

function ConnectedDevicesSection() {
  const [companion, setCompanion] = useState(false);
  const [devices, setDevices] = useState<NodeDevice[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    async function fetchAll() {
      const [gatewayRes, nodesRes] = await Promise.allSettled([
        fetch("/api/gateway/status"),
        fetch("/api/nodes/status"),
      ]);

      if (gatewayRes.status === "fulfilled" && gatewayRes.value.ok) {
        const data = await gatewayRes.value.json();
        setCompanion(data.companion === true);
      }

      if (nodesRes.status === "fulfilled" && nodesRes.value.ok) {
        const data = await nodesRes.value.json();
        setDevices(data.nodes || []);
      }

      setLoaded(true);
    }
    fetchAll().catch(() => setLoaded(true));
  }, []);

  const connectedDevices = devices.filter(d => d.status === "connected");
  const offlineDevices = devices.filter(d => d.status !== "connected");
  const hasConnected = connectedDevices.length > 0 || companion;

  return (
    <div className="space-y-4">
      {/* Companion status row */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4 text-white/50" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white/80 font-medium">Companion App</p>
          <p className="text-[12px] text-white/40 mt-0.5">
            {!loaded ? "Checking…" : hasConnected ? "Connected to your Mac" : "Not connected"}
          </p>
        </div>
        <StatusDot status={!loaded ? "gray" : hasConnected ? "green" : "gray"} />
      </div>

      {/* Connected devices list */}
      {loaded && connectedDevices.length > 0 && (
        <div className="space-y-2 ml-11">
          {connectedDevices.map(d => (
            <div key={d.id} className="flex items-center gap-2.5 py-1.5 px-3 bg-white/[0.04] rounded-lg">
              <Monitor className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[13px] text-white/70 truncate flex-1">{d.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                Online
              </span>
            </div>
          ))}
          {offlineDevices.map(d => (
            <div key={d.id} className="flex items-center gap-2.5 py-1.5 px-3 bg-white/[0.03] rounded-lg opacity-40">
              <Monitor className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <span className="text-[13px] text-white/50 truncate flex-1">{d.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/30 ml-auto">Offline</span>
            </div>
          ))}
        </div>
      )}

      {/* Setup instructions when not connected */}
      {loaded && !hasConnected && (
        <>
          <GlassDivider />
          <CompanionSetupInline />
        </>
      )}
    </div>
  );
}

export default function SettingsPageClient({
  initialTokenUsage,
  initialProfile,
}: SettingsPageClientProps) {
  const pct = Math.min(Math.round((initialTokenUsage.used / initialTokenUsage.limit) * 100), 100);

  // Billing state
  const [billingPlan, setBillingPlan] = useState<string>(initialProfile?.plan || "free");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(
    initialProfile?.current_period_end || null
  );
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingUpgrading, setBillingUpgrading] = useState(false);
  const [upgradedBanner, setUpgradedBanner] = useState(false);
  const [usageStatus, setUsageStatus] = useState<{
    weekly: { used: number; limit: number; resetDate: string };
    monthly: { used: number; limit: number; resetDate: string };
    percentWeekly: number;
    percentMonthly: number;
  } | null>(null);

  useEffect(() => {
    fetchBilling();
    fetchUsage();
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "true") {
      setUpgradedBanner(true);
      setTimeout(() => setUpgradedBanner(false), 5000);
    }
  }, []);

  async function fetchBilling() {
    try {
      const res = await fetch("/api/billing/status");
      if (res.ok) {
        const data = await res.json();
        setBillingPlan(data.plan || "free");
        setBillingPeriodEnd(data.periodEnd || null);
      }
    } catch (err) {
      console.error("Failed to fetch billing:", err);
    } finally {
      setBillingLoading(false);
    }
  }

  async function fetchUsage() {
    try {
      const res = await fetch("/api/usage/status");
      if (res.ok) {
        const data = await res.json();
        setUsageStatus(data);
      }
    } catch {
      // non-critical
    }
  }

  async function handleManageBilling() {
    setBillingUpgrading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error("Failed to open portal:", err);
    } finally {
      setBillingUpgrading(false);
    }
  }

  // Decide which usage to feature (prefer monthly if available)
  const featuredUsage = usageStatus?.monthly ?? null;
  const featuredPct = usageStatus?.percentMonthly ?? pct;
  const barColor =
    featuredPct >= 100
      ? "bg-red-400"
      : featuredPct >= 80
      ? "bg-amber-400"
      : "var(--mint, #9effbf)" ;

  return (
    <div className="p-6 max-w-xl mx-auto space-y-4">

      {/* Upgraded banner */}
      {upgradedBanner && (
        <div className="px-4 py-3 rounded-xl bg-[#9EFFBF]/10 border border-[#9EFFBF]/30 text-[13px] text-[#9EFFBF] font-medium">
          🎉 You&apos;re now on Pro! Enjoy unlimited access.
        </div>
      )}

      {/* ── 1. Usage Bar ── */}
      <GlassCard variant="default">
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-white/50" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">
                Token Usage
              </span>
            </div>
            <span className="text-[12px] text-white/40">
              Resets {featuredUsage?.resetDate ?? initialTokenUsage.resetDate}
            </span>
          </div>

          {/* Big number */}
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-white/90 tracking-tight">
              {featuredPct}%
            </span>
            <span className="text-[13px] text-white/40">
              {featuredUsage
                ? `${Math.round(featuredUsage.used / 1000)}k / ${Math.round(featuredUsage.limit / 1000)}k`
                : `${Math.round(initialTokenUsage.used / 1000)}k / ${Math.round(initialTokenUsage.limit / 1000)}k`}
              {" "}tokens
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-white/[0.08] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(featuredPct, 100)}%`,
                background:
                  featuredPct >= 100
                    ? "#f87171"
                    : featuredPct >= 80
                    ? "#fbbf24"
                    : "#9EFFBF",
              }}
            />
          </div>

          {/* Weekly sub-bar (if available) */}
          {usageStatus && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between">
                <span className="text-[11px] text-white/30 uppercase tracking-wider">Weekly</span>
                <span className="text-[11px] text-white/30">
                  {Math.round(usageStatus.weekly.used / 1000)}k / {Math.round(usageStatus.weekly.limit / 1000)}k
                </span>
              </div>
              <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(usageStatus.percentWeekly, 100)}%`,
                    background:
                      usageStatus.percentWeekly >= 100
                        ? "#f87171"
                        : usageStatus.percentWeekly >= 80
                        ? "#fbbf24"
                        : "#9EFFBF",
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ── 2. Get More Usage CTA ── */}
      <Link href="/settings/billing" className="block">
        <button className="w-full py-3.5 rounded-2xl font-semibold text-[14px] text-black/80 transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #9EFFBF 0%, #6ee7a0 100%)" }}
        >
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" />
            Get More Usage
          </span>
        </button>
      </Link>

      {/* ── 3. Account ── */}
      <GlassCard variant="subtle" label="Account" accentColor="#9EFFBF">
        <div className="space-y-3">
          {/* Email */}
          {initialProfile?.email && (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white/40">Email</span>
              <span className="text-[13px] text-white/80 font-medium truncate max-w-[60%] text-right">
                {initialProfile.email}
              </span>
            </div>
          )}

          <GlassDivider className="my-2" />

          {/* Plan row */}
          {billingLoading ? (
            <div className="h-5 bg-white/[0.05] animate-pulse rounded-lg" />
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-white/40">Plan</span>
              <div className="flex items-center gap-2">
                <Badge status={billingPlan !== "free" ? "active" : "pending"}>
                  {billingPlan.charAt(0).toUpperCase() + billingPlan.slice(1)}
                </Badge>
                {billingPlan !== "free" && billingPeriodEnd && (
                  <span className="text-[11px] text-white/30">
                    Renews {new Date(billingPeriodEnd).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Manage billing button */}
          {!billingLoading && billingPlan !== "free" && (
            <button
              onClick={handleManageBilling}
              disabled={billingUpgrading}
              className="w-full py-2 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] border border-white/[0.15] text-white/70 text-[13px] transition-colors mt-1 disabled:opacity-50"
            >
              {billingUpgrading ? "Opening…" : "Manage Billing"}
            </button>
          )}
        </div>
      </GlassCard>

      {/* ── 4. Connected Devices ── */}
      <GlassCard variant="subtle" label="Connected Devices" accentColor="#9EFFBF">
        <ConnectedDevicesSection />
      </GlassCard>

      {/* ── 5. Danger Zone ── */}
      <GlassCard variant="subtle" borderless className="border border-red-500/[0.12] bg-red-500/[0.04]">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] text-white/60 font-medium">Delete Account</p>
            <p className="text-[12px] text-white/30 mt-0.5">
              Permanently remove your account and all data.
            </p>
          </div>
          <Link href="/settings/account">
            <button className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-red-500/[0.08] hover:bg-red-500/[0.15] border border-red-500/[0.2] text-red-400/80 text-[12px] transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </Link>
        </div>
      </GlassCard>

    </div>
  );
}
