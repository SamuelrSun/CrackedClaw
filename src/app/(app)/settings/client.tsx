"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TeamSection, TeamMember, TeamInvitation } from "@/components/settings/team-section";
import type { Organization } from "@/lib/supabase/data";
import { Sparkles, Radio, ArrowRight, Monitor, Brain, Clock, Zap, Smartphone, Wrench } from "lucide-react";


interface SettingsPageClientProps {
  initialTokenUsage: {
    used: number;
    limit: number;
    resetDate: string;
  };
  initialTeamMembers: TeamMember[];
  initialInvitations: TeamInvitation[];
  currentUserRole: "owner" | "admin" | "member";
  initialOrganization: Organization | null;
}

interface SystemStatus {
  runtime: "connected" | "error";
  toolServer: "connected" | "error" | "unknown";
  companion: boolean;
  memoryCount: number;
  integrationsCount: number;
  loaded: boolean;
}

function StatusDot({ status }: { status: "green" | "gray" | "red" }) {
  const colors = {
    green: "bg-mint",
    gray: "bg-grid/30",
    red: "bg-coral",
  };
  return (
    <span className={`w-2.5 h-2.5 rounded-none inline-block flex-shrink-0 ${colors[status]}`} />
  );
}

function SystemStatusSection() {
  const [status, setStatus] = useState<SystemStatus>({
    runtime: "connected",
    toolServer: "unknown",
    companion: false,
    memoryCount: 0,
    integrationsCount: 0,
    loaded: false,
  });

  useEffect(() => {
    async function fetchStatus() {
      try {
        const [gatewayRes, memoryRes, intRes] = await Promise.allSettled([
          fetch("/api/gateway/status"),
          fetch("/api/memory?limit=1"),
          fetch("/api/integrations"),
        ]);

        let toolServer: "connected" | "error" | "unknown" = "unknown";
        let companion = false;
        if (gatewayRes.status === "fulfilled" && gatewayRes.value.ok) {
          const data = await gatewayRes.value.json();
          toolServer = data.tools?.length > 0 ? "connected" : "unknown";
          companion = data.companion === true;
        }

        let memoryCount = 0;
        if (memoryRes.status === "fulfilled" && memoryRes.value.ok) {
          const data = await memoryRes.value.json();
          memoryCount = data.total ?? data.count ?? 0;
        }

        let integrationsCount = 0;
        if (intRes.status === "fulfilled" && intRes.value.ok) {
          const data = await intRes.value.json();
          integrationsCount = Array.isArray(data.integrations)
            ? data.integrations.filter((i: { connected?: boolean }) => i.connected).length
            : 0;
        }

        setStatus({
          runtime: "connected",
          toolServer,
          companion,
          memoryCount,
          integrationsCount,
          loaded: true,
        });
      } catch {
        setStatus(prev => ({ ...prev, runtime: "error", loaded: true }));
      }
    }
    fetchStatus();
  }, []);

  const rows: { icon: React.ReactNode; label: string; dot: "green" | "gray" | "red"; text: string }[] = [
    {
      icon: <Zap className="w-4 h-4 text-mint" />,
      label: "AI Runtime",
      dot: status.runtime === "connected" ? "green" : "red",
      text: status.runtime === "connected" ? "Connected (Serverless)" : "Error",
    },
    {
      icon: <Wrench className="w-4 h-4 text-mint" />,
      label: "Tool Server",
      dot: status.toolServer === "connected" ? "green" : status.toolServer === "unknown" ? "gray" : "red",
      text: status.toolServer === "connected" ? "Connected" : status.toolServer === "unknown" ? "Checking..." : "Unavailable",
    },
    {
      icon: <Smartphone className="w-4 h-4 text-grid/40" />,
      label: "Companion App",
      dot: status.companion ? "green" : "gray",
      text: status.companion ? "Connected" : "Not connected",
    },
    {
      icon: <Brain className="w-4 h-4 text-mint" />,
      label: "Memory System",
      dot: "green",
      text: status.loaded ? `Active (${status.memoryCount} memories)` : "Loading...",
    },
    {
      icon: <Radio className="w-4 h-4 text-mint" />,
      label: "Integrations",
      dot: status.integrationsCount > 0 ? "green" : "gray",
      text: status.loaded ? `${status.integrationsCount} connected` : "Loading...",
    },
  ];

  return (
    <div className="mt-2 space-y-3">
      {!status.loaded ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-6 bg-forest/5 animate-pulse rounded" />
          ))}
        </div>
      ) : (
        <div className="space-y-2.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              {row.icon}
              <span className="font-mono text-[11px] text-grid/60 w-32 flex-shrink-0">{row.label}</span>
              <StatusDot status={row.dot} />
              <span className="font-mono text-[11px] text-forest">{row.text}</span>
            </div>
          ))}
        </div>
      )}
      {!status.companion && status.loaded && (
        <Link href="/settings/connect">
          <Button variant="ghost" size="sm" className="w-full justify-between mt-2">
            Set up Companion App
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function DevicesInlineSection() {
  const [devices, setDevices] = useState<{ id: string; name: string; status: string; lastSeen: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/nodes/status")
      .then(r => r.ok ? r.json() : { nodes: [] })
      .then(d => setDevices(d.nodes || []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-2">
        <div className="h-8 bg-grid/10 animate-pulse rounded" />
      </div>
    );
  }

  const connected = devices.filter(d => d.status === "connected");

  return (
    <div className="mt-2 space-y-3">
      {connected.length > 0 ? (
        <div className="space-y-2">
          {connected.map(d => (
            <div key={d.id} className="flex items-center gap-2">
              <Monitor className="w-4 h-4 text-mint flex-shrink-0" />
              <span className="font-mono text-[11px] text-forest flex-1 truncate">{d.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-wide text-mint bg-mint/10 px-2 py-0.5 border border-mint/30">
                Connected
              </span>
            </div>
          ))}
          {devices.filter(d => d.status !== "connected").map(d => (
            <div key={d.id} className="flex items-center gap-2 opacity-50">
              <Monitor className="w-4 h-4 text-grid/40 flex-shrink-0" />
              <span className="font-mono text-[11px] text-grid/60 flex-1 truncate">{d.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">Offline</span>
            </div>
          ))}
        </div>
      ) : devices.length > 0 ? (
        <div className="space-y-2">
          {devices.map(d => (
            <div key={d.id} className="flex items-center gap-2 opacity-50">
              <Monitor className="w-4 h-4 text-grid/40 flex-shrink-0" />
              <span className="font-mono text-[11px] text-grid/60 flex-1 truncate">{d.name}</span>
              <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">Offline</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-grid/40" />
          <span className="font-mono text-[11px] text-grid/40">No devices connected</span>
        </div>
      )}
      <Link href="/settings/nodes">
        <Button variant="ghost" size="sm" className="w-full justify-between">
          {devices.length === 0 ? "Add a device" : "Manage devices"}
          <ArrowRight className="w-3 h-3" />
        </Button>
      </Link>
    </div>
  );
}

export default function SettingsPageClient({ 
  initialTokenUsage, 
  initialTeamMembers,
  initialInvitations,
  currentUserRole,
  initialOrganization,
}: SettingsPageClientProps) {
  const pct = Math.round((initialTokenUsage.used / initialTokenUsage.limit) * 100);

  const [organization] = useState<Organization | null>(initialOrganization);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>(initialInvitations);

  // Billing state
  const [billingPlan, setBillingPlan] = useState<string>('free');
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingUpgrading, setBillingUpgrading] = useState(false);
  const [upgradedBanner, setUpgradedBanner] = useState(false);

  useEffect(() => {
    fetchBilling();
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      setUpgradedBanner(true);
      setTimeout(() => setUpgradedBanner(false), 5000);
    }
  }, []);

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing/status');
      if (res.ok) {
        const data = await res.json();
        setBillingPlan(data.plan || 'free');
        setBillingPeriodEnd(data.periodEnd || null);
      }
    } catch (err) {
      console.error('Failed to fetch billing:', err);
    } finally {
      setBillingLoading(false);
    }
  }

  async function handleUpgrade() {
    setBillingUpgrading(true);
    try {
      const res = await fetch('/api/billing/checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Failed to start checkout:', err);
    } finally {
      setBillingUpgrading(false);
    }
  }

  async function handleManageBilling() {
    setBillingUpgrading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Failed to open portal:', err);
    } finally {
      setBillingUpgrading(false);
    }
  }

  // Team management handlers
  const handleInvite = useCallback(async (email: string, role: string) => {
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to send invitation");
    }
    const data = await res.json();
    setPendingInvitations(prev => [...prev, data.invitation]);
  }, []);

  const handleUpdateRole = useCallback(async (memberId: string, role: string) => {
    const res = await fetch(`/api/team/${memberId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to update role");
    }
    setTeamMembers(prev => prev.map(m => 
      m.id === memberId ? { ...m, role: role as "owner" | "admin" | "member" } : m
    ));
  }, []);

  const handleRemove = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/team/${memberId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to remove member");
    }
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
  }, []);

  const handleCancelInvitation = useCallback(async (invitationId: string) => {
    const res = await fetch(`/api/team/${invitationId}?type=invitation`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to cancel invitation");
    }
    setPendingInvitations(prev => prev.filter(i => i.id !== invitationId));
  }, []);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          Settings
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Configuration and account
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[rgba(58,58,56,0.2)]">
        {/* Organization Card */}
        {organization && (
          <Card label="Organization" accentColor="#9EFFBF" bordered={false} className="lg:col-span-2">
            <div className="mt-2 space-y-2">
              <div>
                <h3 className="font-header text-xl font-bold text-forest">{organization.name}</h3>
                <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                  {organization.plan} plan
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* System Status Card */}
        <Card label="⚡ System Status" accentColor="#9EFFBF" bordered={false} className="lg:col-span-2">
          <SystemStatusSection />
        </Card>

        {/* AI Provider */}
        <Card label="AI Provider" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                Model selection and API key configuration
              </span>
            </div>
            <Link href="/settings/ai">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Configure AI Provider
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Channels */}
        <Card label="Channels" accentColor="#F4D35E" bordered={false}>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-gold" />
              <span className="font-mono text-[11px] text-grid/60">
                Connect Slack, Discord, Telegram, WhatsApp
              </span>
            </div>
            <Link href="/settings/channels">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Manage Channels
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Memory */}
        <Card label="Memory" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                View and manage what your AI remembers about you
              </span>
            </div>
            <Link href="/settings/memory">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Manage Memory
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Devices */}
        <Card label="Devices" accentColor="#9EFFBF" bordered={false}>
          <DevicesInlineSection />
        </Card>

        {/* Billing */}
        {upgradedBanner && (
          <div className="p-3 border border-mint bg-mint/10 lg:col-span-2">
            <span className="font-mono text-[11px] text-forest font-bold">🎉 You&apos;re now on Pro! Enjoy unlimited access.</span>
          </div>
        )}
        <Card label="Plan & Billing" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            {billingLoading ? (
              <p className="font-mono text-[11px] text-grid/40">Loading...</p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge status={billingPlan === 'pro' ? 'active' : 'pending'}>
                    {billingPlan === 'pro' ? 'Pro' : 'Free'}
                  </Badge>
                  {billingPlan === 'pro' && billingPeriodEnd && (
                    <span className="font-mono text-[10px] text-grid/40">
                      Renews {new Date(billingPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <ul className="space-y-1">
                  {(billingPlan === 'pro'
                    ? ['1 agent instance', 'Unlimited messages', 'Unlimited memories', 'Google + integrations', 'Priority support']
                    : ['1 agent instance', '100 messages/month', '10 memories']
                  ).map((f) => (
                    <li key={f} className="font-mono text-[10px] text-grid/60 flex items-center gap-1">
                      <span className="text-mint">✓</span> {f}
                    </li>
                  ))}
                </ul>
                {billingPlan === 'pro' ? (
                  <Button variant="ghost" size="sm" onClick={handleManageBilling} disabled={billingUpgrading}>
                    {billingUpgrading ? 'Opening...' : 'Manage Billing'}
                  </Button>
                ) : (
                  <Button variant="solid" size="sm" onClick={handleUpgrade} disabled={billingUpgrading}>
                    {billingUpgrading ? 'Redirecting...' : 'Upgrade to Pro — $29/month'}
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>

        {/* Token Usage */}
        <Card label="Token Usage" accentColor="#F4D35E" bordered={false}>
          <div className="mt-2 space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="font-header text-3xl font-bold">{pct}%</span>
              <span className="font-mono text-[10px] text-grid/50">
                {(initialTokenUsage.used / 1000).toFixed(0)}K / {(initialTokenUsage.limit / 1000).toFixed(0)}K tokens
              </span>
            </div>
            <div className="w-full h-2 bg-[rgba(58,58,56,0.1)] rounded-none">
              <div className="h-full bg-forest rounded-none" style={{ width: `${pct}%` }} />
            </div>
            <p className="font-mono text-[10px] text-grid/40">
              Resets {initialTokenUsage.resetDate}
            </p>
          </div>
        </Card>

        {/* Usage & Billing */}
        <Card label="Usage & Billing" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            <p className="font-mono text-[11px] text-grid/60">
              View detailed usage statistics and manage your billing.
            </p>
            <Link href="/settings/usage">
              <Button variant="ghost" size="sm" className="w-full">
                View Usage Details
              </Button>
            </Link>
          </div>
        </Card>

        {/* Workflows */}
        <Card label="Workflows" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                Schedule recurring cron jobs
              </span>
            </div>
            <Link href="/settings/workflows">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Manage Workflows
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Export Data */}
        <Card label="Export Data" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            <p className="font-mono text-[11px] text-grid/60">
              Download your conversations, memory, and workflows for backup or analysis.
            </p>
            <Link href="/settings/export">
              <Button variant="ghost" size="sm" className="w-full">
                Export Your Data
              </Button>
            </Link>
          </div>
        </Card>

        {/* API Key */}
        <Card label="API Key" accentColor="#FF8C69" bordered={false}>
          <div className="mt-2 space-y-3">
            <Input
              label="Your API Key"
              value="sk-oc-****************************3f7a"
              readOnly
            />
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">Copy</Button>
              <Button variant="ghost" size="sm">Regenerate</Button>
            </div>
          </div>
        </Card>

        {/* Team Section */}
        <TeamSection
          members={teamMembers}
          pendingInvitations={pendingInvitations}
          currentUserRole={currentUserRole}
          onInvite={handleInvite}
          onUpdateRole={handleUpdateRole}
          onRemove={handleRemove}
          onCancelInvitation={handleCancelInvitation}
        />

        {/* Account Settings */}
        <Card label="Account" accentColor="#FF8C69" bordered={false}>
          <div className="mt-2 space-y-3">
            <p className="font-mono text-[11px] text-grid/60">
              Manage your account settings, security, and delete your account.
            </p>
            <Link href="/settings/account">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Account Settings
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
