"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

/* ── Shared panel style ── */
const panel = "bg-white/[0.04] border border-white/[0.1] p-5";

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

      <a
        href="/downloads/dopl-connect.dmg"
        className="flex items-center gap-2 w-full px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/80 text-[13px] transition-colors"
      >
        <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Download Dopl Connect (.dmg)</span>
        <ArrowRight className="w-3 h-3 ml-auto text-white/40" />
      </a>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Setup</p>
        {[
          { n: "1", title: "Install the app", desc: "Open the downloaded .dmg and drag Dopl Connect to Applications." },
          { n: "2", title: "Grant permissions", desc: "Enable Accessibility, Screen Recording, and Full Disk Access in System Settings → Privacy & Security." },
          { n: "3", title: "Paste your connection token", desc: "Open Dopl Connect and paste the token below." },
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

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-white/30">Connection Token</p>
        {tokenLoading ? (
          <div className="h-10 bg-white/[0.05] animate-pulse" />
        ) : token ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] text-white/60 bg-white/[0.05] border border-white/[0.1] px-3 py-2.5 truncate">
              {token}
            </code>
            <button
              onClick={copyToken}
              className="flex-shrink-0 p-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] transition-colors"
              title="Copy token"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/50" />}
            </button>
          </div>
        ) : (
          <p className="text-[12px] text-red-400">Failed to load token — refresh and try again.</p>
        )}
      </div>
    </div>
  );
}

function CompanionPermissionsSection({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="mt-5 space-y-3">
      <div className="h-px w-full bg-white/[0.08]" />
      <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Companion Permissions</p>
      <p className="text-[12px] text-white/40 leading-relaxed">
        Dopl Connect needs these macOS permissions to operate on your behalf. The app will prompt you on first launch — just click Allow.
      </p>
      <div className="space-y-2">
        {[
          { icon: "🔐", label: "Accessibility", desc: "Lets Dopl click, type, and interact with apps on your Mac." },
          { icon: "🖥️", label: "Screen Recording", desc: "Lets Dopl see what's on your screen to assist you." },
          { icon: "🤖", label: "Automation", desc: "Lets Dopl control apps like Safari, Mail, and Finder for you." },
        ].map(p => (
          <div key={p.label} className="flex gap-3 p-3 bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[16px] flex-shrink-0">{p.icon}</span>
            <div>
              <p className="text-[13px] text-white/80 font-medium">{p.label}</p>
              <p className="text-[12px] text-white/40 mt-0.5 leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
      {isConnected ? (
        <p className="text-[11px] text-emerald-400/70">
          ✅ Companion is connected. Permissions should be active.
        </p>
      ) : (
        <p className="text-[11px] text-white/30 leading-relaxed">
          If you missed a prompt, open <strong className="text-white/50">System Settings → Privacy &amp; Security</strong> and grant the permissions manually.
        </p>
      )}
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
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-white/[0.06] flex items-center justify-center flex-shrink-0">
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

      {loaded && connectedDevices.length > 0 && (
        <div className="space-y-1.5 ml-11">
          {connectedDevices.map(d => (
            <div key={d.id} className="flex items-center gap-2.5 py-1.5 px-3 bg-white/[0.04]">
              <Monitor className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-[13px] text-white/70 truncate flex-1">{d.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400">Online</span>
            </div>
          ))}
          {offlineDevices.map(d => (
            <div key={d.id} className="flex items-center gap-2.5 py-1.5 px-3 bg-white/[0.03] opacity-40">
              <Monitor className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <span className="text-[13px] text-white/50 truncate flex-1">{d.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/30 ml-auto">Offline</span>
            </div>
          ))}
        </div>
      )}

      {loaded && !hasConnected && (
        <>
          <div className="h-px w-full bg-white/[0.08] my-3" />
          <CompanionSetupInline />
        </>
      )}

      {loaded && <CompanionPermissionsSection isConnected={hasConnected} />}
    </div>
  );
}

export default function SettingsPageClient({
  initialTokenUsage,
  initialProfile,
}: SettingsPageClientProps) {
  const pct = Math.min(Math.round((initialTokenUsage.used / initialTokenUsage.limit) * 100), 100);

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
    } catch { /* non-critical */ }
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

  const featuredUsage = usageStatus?.monthly ?? null;
  const featuredPct = usageStatus?.percentMonthly ?? pct;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Upgraded banner */}
      {upgradedBanner && (
        <div className="px-4 py-3 mb-4 bg-[#9EFFBF]/10 border border-[#9EFFBF]/30 text-[13px] text-[#9EFFBF] font-medium">
          🎉 You&apos;re now on Pro! Enjoy unlimited access.
        </div>
      )}

      {/* ── Bento Grid ── */}
      <div className="grid grid-cols-2 gap-px bg-white/[0.1]">

        {/* ── Usage (top-left) ── */}
        <div className={panel}>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-white/40" />
            <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Token Usage</span>
            <span className="text-[12px] text-white/30 ml-auto">
              Resets {featuredUsage?.resetDate ?? initialTokenUsage.resetDate}
            </span>
          </div>

          <div className="flex items-baseline gap-3 mb-3">
            <span className="text-4xl font-bold text-white/90 tracking-tight">{featuredPct}%</span>
            <span className="text-[13px] text-white/40">
              {featuredUsage
                ? `${Math.round(featuredUsage.used / 1000)}k / ${Math.round(featuredUsage.limit / 1000)}k`
                : `${Math.round(initialTokenUsage.used / 1000)}k / ${Math.round(initialTokenUsage.limit / 1000)}k`}
              {" "}tokens
            </span>
          </div>

          <div className="w-full h-2 bg-white/[0.08] overflow-hidden">
            <div
              className="h-full transition-all duration-700"
              style={{
                width: `${Math.min(featuredPct, 100)}%`,
                background: featuredPct >= 100 ? "#f87171" : featuredPct >= 80 ? "#fbbf24" : "#9EFFBF",
              }}
            />
          </div>

          {usageStatus && (
            <div className="mt-3 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[11px] text-white/30 uppercase tracking-wider">Weekly</span>
                <span className="text-[11px] text-white/30">
                  {Math.round(usageStatus.weekly.used / 1000)}k / {Math.round(usageStatus.weekly.limit / 1000)}k
                </span>
              </div>
              <div className="w-full h-1 bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(usageStatus.percentWeekly, 100)}%`,
                    background: usageStatus.percentWeekly >= 100 ? "#f87171" : usageStatus.percentWeekly >= 80 ? "#fbbf24" : "#9EFFBF",
                    opacity: 0.6,
                  }}
                />
              </div>
            </div>
          )}

          <Link href="/settings/billing" className="block mt-5">
            <button
              className="w-full py-3 font-semibold text-[14px] text-black/80 transition-all hover:brightness-110 active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #9EFFBF 0%, #6ee7a0 100%)" }}
            >
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Get More Usage
              </span>
            </button>
          </Link>
        </div>

        {/* ── Account (top-right) ── */}
        <div className={panel}>
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Account</span>

          <div className="mt-4 space-y-4">
            {initialProfile?.email && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-white/40">Email</span>
                <span className="text-[13px] text-white/80 font-medium truncate max-w-[65%] text-right">
                  {initialProfile.email}
                </span>
              </div>
            )}

            <div className="h-px w-full bg-white/[0.08]" />

            {billingLoading ? (
              <div className="h-5 bg-white/[0.05] animate-pulse" />
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

            {!billingLoading && billingPlan !== "free" && (
              <button
                onClick={handleManageBilling}
                disabled={billingUpgrading}
                className="w-full py-2 px-4 bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.1] text-white/70 text-[13px] transition-colors disabled:opacity-50"
              >
                {billingUpgrading ? "Opening…" : "Manage Billing"}
              </button>
            )}
          </div>

          {/* Danger zone — bottom of account panel */}
          <div className="mt-auto pt-6">
            <div className="h-px w-full bg-white/[0.08] mb-4" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/50">Delete Account</p>
                <p className="text-[11px] text-white/25 mt-0.5">Permanently remove all data</p>
              </div>
              <Link href="/settings/account">
                <button className="flex items-center gap-1.5 py-1.5 px-3 bg-red-500/[0.06] hover:bg-red-500/[0.12] border border-red-500/[0.15] text-red-400/70 text-[12px] transition-colors">
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── Connected Devices (bottom, full width) ── */}
        <div className={`${panel} col-span-2`}>
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Connected Devices</span>
          <div className="mt-4">
            <ConnectedDevicesSection />
          </div>
        </div>

      </div>
    </div>
  );
}
