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
  Brain,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
} from "lucide-react";
import { GlassNavbar } from "@/components/layout/glass-navbar";
import { PricingModal } from "@/components/settings/pricing-modal";
import { AddFundsModal } from "@/components/billing/add-funds-modal";

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

function CompanionTokenDisplay() {
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

  if (tokenLoading) return <div className="h-10 bg-white/[0.05] animate-pulse" />;
  if (!token) return <p className="text-[12px] text-red-400">Failed to load token — refresh and try again.</p>;

  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 text-[11px] text-white/75 bg-white/[0.05] border border-white/10 px-3 py-2.5 truncate">
        {token}
      </code>
      <button
        onClick={copyToken}
        className="flex-shrink-0 p-2.5 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 transition-colors"
        title="Copy token"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
      </button>
    </div>
  );
}

function CompanionSetupInline() {
  return (
    <div className="mt-4 space-y-4">
      <p className="text-[13px] text-white/70 leading-relaxed">
        The companion app runs on your Mac and gives your AI access to local apps, files, and your browser.
      </p>

      <a
        href="/api/download/companion"
        className="flex items-center gap-2 w-full px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/80 text-[13px] transition-colors"
      >
        <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Download Dopl Connect (.dmg)</span>
        <ArrowRight className="w-3 h-3 ml-auto text-white/60" />
      </a>

      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">Setup</p>
        {[
          { n: "1", title: "Install the app", desc: "Open the downloaded .dmg and drag Dopl Connect to Applications." },
          { n: "2", title: "Grant permissions", desc: "Accessibility, Screen Recording, and Full Disk Access are optional — grant them later for full automation." },
          { n: "3", title: "Paste your connection token", desc: "Open Dopl Connect and paste the token below into the input bar on first launch." },
        ].map(step => (
          <div key={step.n} className="flex gap-3">
            <span className="text-[13px] text-emerald-400 font-bold w-5 flex-shrink-0 pt-0.5">{step.n}.</span>
            <div>
              <p className="text-[13px] text-white/80 font-medium">{step.title}</p>
              <p className="text-[12px] text-white/60 mt-0.5 leading-relaxed">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-white/50">Connection Token</p>
        <CompanionTokenDisplay />
      </div>
    </div>
  );
}

function CompanionPermissionsSection({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="mt-5 space-y-3">
      <div className="h-px w-full bg-white/[0.08]" />
      <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">Companion Permissions</p>
      <p className="text-[12px] text-white/60 leading-relaxed">
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
              <p className="text-[12px] text-white/60 mt-0.5 leading-relaxed">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
      {isConnected ? (
        <p className="text-[11px] text-emerald-400/70">
          ✅ Companion is connected. Permissions should be active.
        </p>
      ) : (
        <p className="text-[11px] text-white/50 leading-relaxed">
          If you missed a prompt, open <strong className="text-white/70">System Settings → Privacy &amp; Security</strong> and grant the permissions manually.
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
          <Smartphone className="w-4 h-4 text-white/70" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-white/80 font-medium">Companion App</p>
          <p className="text-[12px] text-white/60 mt-0.5">
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
              <Monitor className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
              <span className="text-[13px] text-white/70 truncate flex-1">{d.name}</span>
              <span className="text-[10px] uppercase tracking-wider text-white/50 ml-auto">Offline</span>
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

      {loaded && hasConnected && (
        <div className="mt-4 space-y-2">
          <div className="h-px w-full bg-white/[0.08]" />
          <p className="text-[11px] uppercase tracking-widest text-white/50">Connection Token</p>
          <p className="text-[11px] text-white/40 leading-relaxed">Use this to re-pair or connect a second device.</p>
          <CompanionTokenDisplay />
        </div>
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
      className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/70 text-[11px] transition-colors"
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

  const hasInstance = !!instanceUrl;

  const [relayPort, setRelayPort] = useState<number | null>(null);

  useEffect(() => {
    if (!hasInstance) return;
    fetch("/api/instance/relay-port")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.relayPort === "number") setRelayPort(d.relayPort);
      })
      .catch(() => {/* ignore */});
  }, [hasInstance]);

  const connectionKey = (() => {
    if (!instanceUrl || !authToken) return null;
    const payload: Record<string, unknown> = { h: instanceUrl, t: authToken };
    if (relayPort !== null) payload.p = relayPort;
    try {
      return `dopl_${btoa(JSON.stringify(payload))
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")}`;
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-4">
      {!hasInstance ? (
        <p className="text-[12px] text-white/60 leading-relaxed">
          No instance provisioned yet. Upgrade to a paid plan to get a dedicated OpenClaw instance with browser relay support.
        </p>
      ) : (
        <>
          {/* Connection Key */}
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">Connection Key</p>
            {connectionKey ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[11px] text-white/75 bg-white/[0.05] border border-white/10 px-3 py-2.5 truncate font-mono">
                  {connectionKey}
                </code>
                <CopyButton value={connectionKey} label="Copy" />
              </div>
            ) : (
              <p className="text-[12px] text-white/50">Generating key…</p>
            )}
            <p className="text-[11px] text-white/40 leading-relaxed">
              Copy this key and paste it into the extension options page to connect.
            </p>
          </div>

          {/* Download extension */}
          <a
            href="/api/download/browser-relay"
            className="flex items-center gap-2 w-full px-4 py-3 bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white/80 text-[13px] transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Download Dopl Browser Relay Extension</span>
            <ArrowRight className="w-3 h-3 ml-auto text-white/60" />
          </a>

          {/* Setup steps */}
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">Setup</p>
            {[
              { n: "1", title: "Download & install", desc: "Download the extension above and load it as an unpacked extension in Chrome (chrome://extensions → Load unpacked)." },
              { n: "2", title: "Open extension options", desc: "Right-click the extension icon in your toolbar and choose Options." },
              { n: "3", title: "Paste your Connection Key", desc: "Copy the Connection Key above, paste it into the options page, and click Save." },
              { n: "4", title: "Attach a tab", desc: "Navigate to any tab and click the extension icon to attach it to Dopl." },
            ].map(step => (
              <div key={step.n} className="flex gap-3">
                <span className="text-[13px] text-emerald-400 font-bold w-5 flex-shrink-0 pt-0.5">{step.n}.</span>
                <div>
                  <p className="text-[13px] text-white/80 font-medium">{step.title}</p>
                  <p className="text-[12px] text-white/60 mt-0.5 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── Brain Settings Section ── */
function BrainSettingsSection() {
  const [brainEnabled, setBrainEnabled] = useState(true);
  const [unifiedMemory, setUnifiedMemory] = useState(true);
  const [autoMemoryExtract, setAutoMemoryExtract] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // key of the toggle being saved

  useEffect(() => {
    fetch("/api/settings/brain")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setBrainEnabled(d.brain_enabled ?? true);
          setUnifiedMemory(d.unified_memory ?? true);
          setAutoMemoryExtract(d.auto_memory_extract ?? true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: "brain_enabled" | "unified_memory" | "auto_memory_extract", current: boolean) {
    const next = !current;
    setSaving(key);
    try {
      const res = await fetch("/api/settings/brain", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next }),
      });
      if (res.ok) {
        if (key === "brain_enabled") setBrainEnabled(next);
        else if (key === "unified_memory") setUnifiedMemory(next);
        else if (key === "auto_memory_extract") setAutoMemoryExtract(next);
      }
    } catch {
      // revert on failure — state stays unchanged
    } finally {
      setSaving(null);
    }
  }

  const toggleItems = [
    {
      key: "brain_enabled" as const,
      label: "Adaptive Learning",
      description: "When enabled, Dopl learns your preferences and decision patterns from conversations to provide more personalized assistance.",
      value: brainEnabled,
    },
    {
      key: "unified_memory" as const,
      label: "Unified Memory",
      description: "Combines explicit memories and learned preferences into a single context for more natural, coherent responses.",
      value: unifiedMemory,
    },
    {
      key: "auto_memory_extract" as const,
      label: "Auto Memory Extraction",
      description: "Automatically extracts and saves important facts from conversations. Turn off if you prefer to manage memories manually.",
      value: autoMemoryExtract,
    },
  ];

  return (
    <div className="space-y-4">
      {toggleItems.map((item, idx) => (
        <div key={item.key}>
          {idx > 0 && <div className="h-px w-full bg-white/[0.06] mb-4" />}
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <p className="text-[13px] text-white/80 font-medium">{item.label}</p>
              <p className="text-[12px] text-white/60 mt-1 leading-relaxed">
                {item.description}
              </p>
            </div>
            {loading ? (
              <div className="w-10 h-5 bg-white/[0.05] animate-pulse rounded-full flex-shrink-0" />
            ) : (
              <button
                onClick={() => toggle(item.key, item.value)}
                disabled={saving === item.key}
                className={`relative w-10 h-5 rounded-full flex-shrink-0 transition-colors duration-200 ${
                  item.value ? "bg-emerald-500/60" : "bg-white/[0.12]"
                } ${saving === item.key ? "opacity-50" : ""}`}
                aria-label={`${item.value ? "Disable" : "Enable"} ${item.label.toLowerCase()}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
                    item.value ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            )}
          </div>
        </div>
      ))}
      {brainEnabled && (
        <p className="text-[11px] text-emerald-400/70">
          ✨ Brain is active — Dopl will learn from your interactions.
        </p>
      )}
    </div>
  );
}

/* removed — ConnectAIToolsSection moved to Brain → Connect tab */

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
              <p className="text-[12px] text-white/60">Loading account info…</p>
            </div>
          ) : error && !deletionInfo ? (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
              {error}
            </div>
          ) : deletionInfo ? (
            <div className="space-y-4">
              <p className="text-[13px] text-white/75 leading-relaxed">
                This action is permanent and cannot be undone. The following data will be permanently deleted:
              </p>
              <ul className="space-y-1.5">
                {deletionInfo.dataToDelete.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-[12px] text-white/70">
                    <span className="w-1 h-1 rounded-full bg-red-400/60 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">
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
            className="px-4 py-2 text-[13px] text-white/75 hover:text-white/80 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors disabled:opacity-50"
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

/* ── Wallet Panel ── */
interface WalletHistoryEntry {
  id: string;
  created_at: string;
  type: "deposit" | "stipend" | "refund" | "auto_reload" | "chat_spend";
  amount_usd: number;
  description: string;
  input_tokens?: number;
  output_tokens?: number;
}

function balanceColor(balance: number): string {
  if (balance > 5) return "#34d399";
  if (balance > 1) return "#fbbf24";
  return "#f87171";
}

function WalletPanel() {
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<WalletHistoryEntry[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [addAmount, setAddAmount] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAmount, setModalAmount] = useState(0);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  function loadBalance() {
    fetch("/api/usage/status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setBalance(d.wallet?.balance_usd ?? 0); })
      .catch(() => {})
      .finally(() => setWalletLoading(false));
  }

  function loadHistory() {
    fetch("/api/billing/history?limit=20")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setHistory(d.entries || []); })
      .catch(() => {})
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    loadBalance();
    loadHistory();
  }, []);

  function handleAddFunds() {
    const amt = parseFloat(addAmount);
    if (!amt || amt < 5) {
      setAddError("Minimum $5");
      return;
    }
    if (amt > 500) {
      setAddError("Maximum $500");
      return;
    }
    setAddError(null);
    setModalAmount(amt);
    setModalOpen(true);
  }

  function handleModalSuccess() {
    setModalOpen(false);
    setAddAmount("");
    setSuccessMsg(`$${modalAmount.toFixed(2)} added to your wallet!`);
    setTimeout(() => setSuccessMsg(null), 4000);
    // Refresh balance and history
    setWalletLoading(true);
    setHistoryLoading(true);
    loadBalance();
    loadHistory();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  const bal = balance ?? 0;

  return (
    <div className="space-y-5">
      {/* Big Balance */}
      <div className="flex flex-col items-center py-4 gap-1">
        {walletLoading ? (
          <div className="h-16 w-40 bg-white/[0.05] animate-pulse" />
        ) : (
          <>
            <span
              className="text-7xl font-mono font-bold leading-none tracking-tight"
              style={{ color: balanceColor(bal) }}
            >
              ${bal.toFixed(2)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-white/40 mt-1">Current Balance</span>
          </>
        )}
      </div>

      <div className="h-px w-full bg-white/[0.08]" />

      {/* Add Funds */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">Add Funds</p>
        {successMsg && (
          <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-[2px]">
            <p className="text-[12px] text-emerald-400">{successMsg}</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-white/40 font-mono">$</span>
            <input
              type="number"
              min="5"
              max="500"
              placeholder="Enter amount"
              value={addAmount}
              onChange={(e) => { setAddAmount(e.target.value); setAddError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddFunds()}
              className="w-full bg-white/[0.05] border border-white/10 text-white/80 text-[13px] pl-7 pr-3 py-2.5 outline-none focus:border-white/20 placeholder:text-white/20 font-mono"
            />
          </div>
          <button
            onClick={handleAddFunds}
            disabled={!addAmount}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500/[0.12] hover:bg-emerald-500/[0.2] border border-emerald-500/30 text-emerald-400 text-[13px] transition-colors disabled:opacity-40"
          >
            <Zap className="w-3.5 h-3.5" />
            Add Funds
          </button>
        </div>
        {addError && <p className="text-[11px] text-red-400">{addError}</p>}
        <p className="text-[10px] text-white/30">$5 minimum · $500 maximum</p>
      </div>

      {/* Add Funds Modal */}
      <AddFundsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        amount={modalAmount}
        onSuccess={handleModalSuccess}
      />

      <div className="h-px w-full bg-white/[0.08]" />

      {/* Billing History */}
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-white/50 font-medium">Recent Transactions</p>
        {historyLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-8 bg-white/[0.04] animate-pulse" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <p className="text-[12px] text-white/30 py-3 text-center">No transactions yet</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-0.5 pr-1">
            {history.map((entry) => {
              const isDeposit = entry.type !== "chat_spend";
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 px-3 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isDeposit ? (
                      <ArrowDownLeft className="w-3 h-3 text-emerald-400/60 flex-shrink-0" />
                    ) : (
                      <ArrowUpRight className="w-3 h-3 text-white/20 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-[11px] text-white/60 truncate">{entry.description}</p>
                      <p className="text-[9px] text-white/30">{formatDate(entry.created_at)}</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-mono flex-shrink-0 ml-2 ${isDeposit ? "text-emerald-400" : "text-white/40"}`}>
                    {isDeposit ? "+" : "-"}${Math.abs(entry.amount_usd).toFixed(entry.amount_usd < 0.01 ? 4 : 2)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function SettingsPageClient({
  initialTokenUsage,
  initialProfile,
}: SettingsPageClientProps) {
  // pct kept for backward compat with initialTokenUsage prop (not displayed, kept for future use)
  const _pct = Math.min(Math.round((initialTokenUsage.used / initialTokenUsage.limit) * 100), 100); void _pct;

  const [billingPlan, setBillingPlan] = useState<string>(initialProfile?.plan || "free");
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(
    initialProfile?.current_period_end || null
  );
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingUpgrading, setBillingUpgrading] = useState(false);
  const [usageStatus, setUsageStatus] = useState<any | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);

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

  async function handleUpgradePlan(planSlug: string) {
    // Paid plan upgrades are now handled in-app by CheckoutModal inside PricingModal.
    // This function is only reached for downgrades to 'free' — open the billing portal.
    if (planSlug !== "free") return;
    await handleManageBilling();
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

  // dailyPct is no longer used in the simplified UI (bars only, no numbers)

  return (
    <>
      <div
        className="fixed inset-0 z-[100] flex flex-col p-1 gap-1 md:p-[7px] md:gap-[7px]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url('/img/landing_background.jpg')",
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
              <span className="text-[11px] uppercase tracking-widest text-white/60 font-medium">Account &amp; Plan</span>

              <div className="mt-4 space-y-4">
                {initialProfile?.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-white/60">Email</span>
                    <span className="text-[13px] text-white/80 font-medium truncate max-w-[65%] text-right">
                      {initialProfile.email}
                    </span>
                  </div>
                )}

                {initialProfile?.created_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-white/60">Member since</span>
                    <span className="text-[13px] text-white/75">
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
                    <span className="text-[12px] text-white/60">Plan</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 border border-white/10 text-white/75 bg-white/[0.04]">
                        {billingPlan.charAt(0).toUpperCase() + billingPlan.slice(1)}
                      </span>
                      {billingPlan !== "free" && billingPeriodEnd && (
                        <span className="text-[11px] text-white/50">
                          Renews {new Date(billingPeriodEnd).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                )}


              </div>
            </div>

            {/* Wallet */}
            <div className={glassPanel}>
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-white/60" />
                <span className="text-[11px] uppercase tracking-widest text-white/60 font-medium">Wallet</span>
              </div>

              <div className="mt-4">
                <WalletPanel />
              </div>
            </div>
          </div>

          {/* Row 2+3: Connected Devices + Browser Relay side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[7px]">
            <div className={glassPanel}>
              <span className="text-[11px] uppercase tracking-widest text-white/60 font-medium">Connected Devices</span>
              <div className="mt-4">
                <ConnectedDevicesSection />
              </div>
            </div>

            <div className={glassPanel}>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-white/60" />
                <span className="text-[11px] uppercase tracking-widest text-white/60 font-medium">Browser Relay</span>
              </div>
              <BrowserRelaySection profile={initialProfile} />
            </div>
          </div>

          {/* Row 3: Brain / Adaptive Learning */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-[7px]">
            <div className={glassPanel}>
              <div className="flex items-center gap-2 mb-4">
                <Brain className="w-4 h-4 text-white/60" />
                <span className="text-[11px] uppercase tracking-widest text-white/60 font-medium">AI Brain</span>
              </div>
              <BrainSettingsSection />
            </div>
          </div>

          {/* Danger Zone */}
          <div className="px-4 md:px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-white/50">Danger Zone</p>
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

      {/* Pricing Modal */}
      {showPricingModal && (
        <PricingModal
          onClose={() => setShowPricingModal(false)}
          currentPlan={billingPlan}
          creditStatus={usageStatus}
          onUpgrade={async (slug) => { await handleUpgradePlan(slug); }}
          onManageBilling={async () => { await handleManageBilling(); }}
        />
      )}
    </>
  );
}
