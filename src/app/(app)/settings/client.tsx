"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserProfile } from "@/lib/supabase/data";
import {
  ArrowRight,
  Monitor,
  Zap,
  Smartphone,
  Download,
  Copy,
  Check,
  Trash2,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { GlassNavbar } from "@/components/layout/glass-navbar";

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

interface DeletionInfo {
  requiresConfirmation: boolean;
  dataToDelete: string[];
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

const glassPanel = "bg-black/[0.07] backdrop-blur-[10px] rounded-[3px] border border-white/10 p-4 md:p-5";

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
        className="flex items-center gap-2 w-full px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/80 text-[13px] transition-colors"
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
            <code className="flex-1 text-[11px] text-white/60 bg-white/[0.05] border border-white/10 px-3 py-2.5 truncate">
              {token}
            </code>
            <button
              onClick={copyToken}
              className="flex-shrink-0 p-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 transition-colors"
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

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/50 text-[11px] transition-colors"
      title={label ? `Copy ${label}` : "Copy"}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      {label && <span className="hidden sm:inline">{copied ? "Copied" : label}</span>}
    </button>
  );
}

function BrowserRelaySection({ profile }: { profile: UserProfile | null }) {
  const instanceUrl = profile?.gateway_url
    ? profile.gateway_url.replace(/^https?:\/\//, "")
    : null;
  const authToken = profile?.auth_token ?? null;
  const relayWssUrl = instanceUrl ? `wss://${instanceUrl}/relay/` : null;

  const hasInstance = !!instanceUrl;

  return (
    <div className="space-y-4">
      {!hasInstance ? (
        <p className="text-[12px] text-white/40 leading-relaxed">
          No instance provisioned yet. Upgrade to a paid plan to get a dedicated OpenClaw instance with browser relay support.
        </p>
      ) : (
        <>
          {/* Instance URL */}
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Instance URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-white/70 bg-white/[0.05] border border-white/10 px-3 py-2.5 truncate font-mono">
                {instanceUrl}
              </code>
              <CopyButton value={instanceUrl!} label="Copy" />
            </div>
          </div>

          {/* Relay URL */}
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Relay URL</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-white/60 bg-white/[0.05] border border-white/10 px-3 py-2.5 truncate font-mono">
                {relayWssUrl}
              </code>
              <CopyButton value={relayWssUrl!} label="Copy" />
            </div>
          </div>

          {/* Gateway Token */}
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Gateway Token</p>
            {authToken ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-white/60 bg-white/[0.05] border border-white/10 px-3 py-2.5 truncate font-mono">
                  {authToken.slice(0, 8)}••••••••••••••••{authToken.slice(-4)}
                </code>
                <CopyButton value={authToken} label="Copy" />
              </div>
            ) : (
              <p className="text-[12px] text-white/30">No token available</p>
            )}
          </div>

          {/* Download extension */}
          <a
            href="/extension/dopl-browser-relay/"
            className="flex items-center gap-2 w-full px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/80 text-[13px] transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Download Dopl Browser Relay Extension</span>
            <ArrowRight className="w-3 h-3 ml-auto text-white/40" />
          </a>

          {/* Setup steps */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">Setup</p>
            {[
              { n: "1", title: "Download & install", desc: "Download the Dopl Browser Relay extension and load it in Chrome." },
              { n: "2", title: "Open extension options", desc: "Click the extension icon in your toolbar → Options." },
              { n: "3", title: "Paste your credentials", desc: "Enter your Instance URL and Gateway Token, then click Save." },
              { n: "4", title: "Verify connection", desc: "You should see a green checkmark confirming the connection." },
              { n: "5", title: "Attach a tab", desc: "Navigate to any tab and click the extension icon to attach it." },
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
        </>
      )}
    </div>
  );
}

/* ── Delete Account Modal ── */
function DeleteAccountModal({ onClose }: { onClose: () => void }) {
  const [deletionInfo, setDeletionInfo] = useState<DeletionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDeletionInfo() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/account/delete");
        if (!res.ok) throw new Error("Failed to fetch account info");
        const data = await res.json();
        setDeletionInfo(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load deletion info");
      } finally {
        setLoading(false);
      }
    }
    fetchDeletionInfo();
  }, []);

  async function handleDelete() {
    if (confirmText !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete account");

      const supabase = createClient();
      await supabase.auth.signOut();
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center">
      <div className="bg-black/[0.07] backdrop-blur-[10px] border border-white/10 rounded-[3px] w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-[13px] font-medium text-white/80">Delete Account</span>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-[12px] text-white/40">Loading account info…</p>
            </div>
          ) : error && !deletionInfo ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              {error}
            </div>
          ) : deletionInfo ? (
            <div className="space-y-4">
              <p className="text-[13px] text-white/60 leading-relaxed">
                This action is permanent and cannot be undone. The following data will be permanently deleted:
              </p>
              <ul className="space-y-1.5">
                {deletionInfo.dataToDelete.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-white/50">
                    <span className="w-1 h-1 rounded-full bg-red-400/60 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-widest text-white/30 font-medium">
                  Type <span className="text-red-400">DELETE</span> to confirm
                </p>
                <input
                  value={confirmText}
                  onChange={(e) => {
                    setConfirmText(e.target.value.toUpperCase());
                    setError(null);
                  }}
                  placeholder="DELETE"
                  className="w-full bg-white/[0.05] border border-white/10 text-white/80 text-[13px] px-3 py-2.5 outline-none focus:border-white/20 placeholder:text-white/20"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
                  {error}
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={deleting}
            className="px-4 py-2 text-[13px] text-white/60 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmText !== "DELETE" || loading}
            className="px-4 py-2 text-[13px] text-red-400 hover:text-red-300 bg-red-500/[0.06] hover:bg-red-500/[0.12] border border-red-500/20 transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {deleting ? (
              <>
                <div className="w-3 h-3 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                Delete Forever
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
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
  const [usageStatus, setUsageStatus] = useState<{
    weekly: { used: number; limit: number; resetDate: string };
    monthly: { used: number; limit: number; resetDate: string };
    percentWeekly: number;
    percentMonthly: number;
  } | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchBilling();
    fetchUsage();
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
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px]"
        style={{
          backgroundImage: "url('/img/landing_background.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <GlassNavbar />

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 md:gap-[7px] min-h-0">

          {/* Row 1: Account & Plan + Token Usage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-[7px]">

            {/* Account & Plan */}
            <div className={glassPanel}>
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Account &amp; Plan</span>

              <div className="mt-4 space-y-4">
                {initialProfile?.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-white/40">Email</span>
                    <span className="text-[13px] text-white/80 font-medium truncate max-w-[65%] text-right">
                      {initialProfile.email}
                    </span>
                  </div>
                )}

                {initialProfile?.created_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-white/40">Member since</span>
                    <span className="text-[13px] text-white/60">
                      {new Date(initialProfile.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
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
                      <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 border border-white/10 text-white/60 bg-white/[0.04]">
                        {billingPlan.charAt(0).toUpperCase() + billingPlan.slice(1)}
                      </span>
                      {billingPlan !== "free" && billingPeriodEnd && (
                        <span className="text-[11px] text-white/30">
                          Renews {new Date(billingPeriodEnd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {!billingLoading && (
                  <button
                    onClick={handleManageBilling}
                    disabled={billingUpgrading}
                    className="w-full py-2 px-4 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 text-[13px] transition-colors disabled:opacity-50"
                  >
                    {billingUpgrading ? "Opening…" : "Manage Billing"}
                  </button>
                )}
              </div>
            </div>

            {/* Token Usage */}
            <div className={glassPanel}>
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

              <div className="w-full h-2 bg-white/[0.08] overflow-hidden rounded-[1px]">
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
                  <div className="w-full h-1 bg-white/[0.06] overflow-hidden rounded-[1px]">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(usageStatus.percentWeekly, 100)}%`,
                        background: usageStatus.percentWeekly >= 100 ? "#f87171" : usageStatus.percentWeekly >= 80 ? "#fbbf24" : "#9EFFBF",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[11px] text-white/30 uppercase tracking-wider">Monthly</span>
                    <span className="text-[11px] text-white/30">
                      {Math.round(usageStatus.monthly.used / 1000)}k / {Math.round(usageStatus.monthly.limit / 1000)}k
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.06] overflow-hidden rounded-[1px]">
                    <div
                      className="h-full"
                      style={{
                        width: `${Math.min(usageStatus.percentMonthly, 100)}%`,
                        background: usageStatus.percentMonthly >= 100 ? "#f87171" : usageStatus.percentMonthly >= 80 ? "#fbbf24" : "#9EFFBF",
                        opacity: 0.6,
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleManageBilling}
                disabled={billingUpgrading}
                className="w-full mt-5 py-2.5 px-4 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 text-[13px] transition-colors disabled:opacity-50"
              >
                Get More Usage
              </button>
            </div>
          </div>

          {/* Row 2: Connected Devices */}
          <div className={glassPanel}>
            <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Connected Devices</span>
            <div className="mt-4">
              <ConnectedDevicesSection />
            </div>
          </div>

          {/* Row 3: Browser Relay */}
          <div className={glassPanel}>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-white/40" />
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-medium">Browser Relay</span>
            </div>
            <BrowserRelaySection profile={initialProfile} />
          </div>

          {/* Danger Zone */}
          <div className="px-4 md:px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-white/30">Danger Zone</p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 bg-red-500/[0.06] hover:bg-red-500/[0.12] border border-red-500/[0.15] text-red-400/70 text-[12px] transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Delete Account
            </button>
          </div>

          {/* Bottom padding */}
          <div className="h-2 shrink-0" />
        </div>
      </div>

      {/* Delete Account Modal */}
      {showDeleteModal && (
        <DeleteAccountModal onClose={() => setShowDeleteModal(false)} />
      )}
    </>
  );
}
