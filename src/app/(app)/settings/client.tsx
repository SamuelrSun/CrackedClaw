"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormErrorSummary } from "@/components/ui/form-error-summary";
import { TeamSection, TeamMember, TeamInvitation } from "@/components/settings/team-section";
import { validateUrl, validateRequired, composeValidators } from "@/lib/validation";
import type { GatewayConnection, GatewayTestResult } from "@/types/gateway";
import { useGateway } from "@/hooks/use-gateway";
import type { Organization } from "@/lib/supabase/data";
import { Sparkles, Radio, ArrowRight, Monitor } from "lucide-react";


interface SyncResult {
  message: string;
  count: number;
  error?: string;
}

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

// Validation functions for gateway form
const validateGatewayUrl = (value: string) => validateUrl(value);
const validateAuthToken = composeValidators(
  (v) => validateRequired(v, "Auth Token"),
  (v) => v && v.length < 8 ? "Auth Token must be at least 8 characters" : null
);
const validateGatewayName = (value: string) => {
  if (value && value.length > 50) {
    return "Name must be at most 50 characters";
  }
  return null;
};

// Helper to mask auth token
function maskToken(token: string | null): string {
  if (!token) return "—";
  if (token.length <= 8) return "••••••••";
  return token.slice(0, 4) + "••••••••" + token.slice(-4);
}

// Helper to get status color
function getStatusColor(status: string): "active" | "pending" | "error" {
  switch (status) {
    case "running":
    case "connected":
      return "active";
    case "provisioning":
    case "starting":
      return "pending";
    case "failed":
    case "stopped":
    case "error":
      return "error";
    default:
      return "pending";
  }
}

export default function SettingsPageClient({ 
  initialTokenUsage, 
  initialTeamMembers,
  initialInvitations,
  currentUserRole,
  initialOrganization,
}: SettingsPageClientProps) {
    const pct = Math.round((initialTokenUsage.used / initialTokenUsage.limit) * 100);

  // Organization state
  const [organization, setOrganization] = useState<Organization | null>(initialOrganization);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [deletingInstance, setDeletingInstance] = useState(false);

  // Team state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialTeamMembers);
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>(initialInvitations);

  // Gateway connection state
  const [gateway, setGateway] = useState<GatewayConnection | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  
  // Bug 3 fix: live gateway status from hook for reconnect button
  const { 
    status: liveGatewayStatus, 
    isConnected: isGatewayConnected,
    forceReconnect: reconnectGateway,
    isReconnecting: isGatewayReconnecting,
  } = useGateway();
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [gatewayName, setGatewayName] = useState("");
  const [testResult, setTestResult] = useState<GatewayTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Form validation state
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showFormErrors, setShowFormErrors] = useState(false);
  
  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

  // Billing state
  const [billingPlan, setBillingPlan] = useState<string>('free');
  const [billingStatus, setBillingStatus] = useState<string>('active');
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingUpgrading, setBillingUpgrading] = useState(false);
  const [upgradedBanner, setUpgradedBanner] = useState(false);

  // Fetch existing gateway connection on mount
  useEffect(() => {
    fetchGateway();
    fetchBilling();
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      setUpgradedBanner(true);
      setTimeout(() => setUpgradedBanner(false), 5000);
    }
  }, []);

  // Validate a single field
  const validateField = useCallback((field: string, value: string): string | null => {
    switch (field) {
      case "gatewayUrl":
        return validateGatewayUrl(value);
      case "authToken":
        return validateAuthToken(value);
      case "gatewayName":
        return validateGatewayName(value);
      default:
        return null;
    }
  }, []);

  // Handle field blur (validate on blur)
  const handleBlur = useCallback((field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    const value = field === "gatewayUrl" ? gatewayUrl : field === "authToken" ? authToken : gatewayName;
    const error = validateField(field, value);
    setErrors(prev => ({ ...prev, [field]: error }));
  }, [gatewayUrl, authToken, gatewayName, validateField]);

  // Handle field change (clear errors on type)
  const handleFieldChange = useCallback((field: string, value: string, setter: (v: string) => void) => {
    setter(value);
    setTestResult(null);
    if (touched[field]) {
      const error = validateField(field, value);
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  }, [touched, validateField]);

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const urlError = validateField("gatewayUrl", gatewayUrl);
    const tokenError = validateField("authToken", authToken);
    const nameError = validateField("gatewayName", gatewayName);
    
    setErrors({
      gatewayUrl: urlError,
      authToken: tokenError,
      gatewayName: nameError,
    });
    setTouched({
      gatewayUrl: true,
      authToken: true,
      gatewayName: true,
    });
    
    return !urlError && !tokenError && !nameError;
  }, [gatewayUrl, authToken, gatewayName, validateField]);

  // Get form error messages for summary
  const formErrors = Object.values(errors).filter(Boolean) as string[];

  async function fetchBilling() {
    try {
      const res = await fetch('/api/billing/status');
      if (res.ok) {
        const data = await res.json();
        setBillingPlan(data.plan || 'free');
        setBillingStatus(data.status || 'active');
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

  async function fetchGateway() {
    try {
      const res = await fetch("/api/gateway/connect");
      if (res.ok) {
        const data = await res.json();
        setGateway(data.gateway);
        if (data.gateway) {
          setGatewayUrl(data.gateway.gateway_url);
          setGatewayName(data.gateway.name);
        }
      }
    } catch (err) {
      console.error("Failed to fetch gateway:", err);
    } finally {
      setGatewayLoading(false);
    }
  }

  async function refreshInstanceStatus() {
    setRefreshingStatus(true);
    try {
      const res = await fetch("/api/organizations/provision");
      if (res.ok) {
        const data = await res.json();
        if (data.organization) {
          setOrganization(data.organization);
        }
      }
    } catch (err) {
      console.error("Failed to refresh status:", err);
    } finally {
      setRefreshingStatus(false);
    }
  }

  async function deleteCloudInstance() {
    if (!window.confirm("Are you sure you want to delete your instance? This cannot be undone.")) {
      return;
    }

    setDeletingInstance(true);
    try {
      const res = await fetch("/api/organizations/provision", { method: "DELETE" });
      if (res.ok) {
        window.location.href = "/settings";
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data?.error || `Server error (${res.status})`;
        alert(`Failed to delete instance: ${msg}`);
        setDeletingInstance(false);
      }
    } catch (err) {
      console.error("Failed to delete instance:", err);
      alert("Failed to delete instance: network error. Please try again.");
      setDeletingInstance(false);
    } finally {
      setDeletingInstance(false);
    }
  }

  async function testConnection() {
    // Validate first
    if (!validateAll()) {
      setShowFormErrors(true);
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    setShowFormErrors(false);
    
    try {
      const res = await fetch("/api/gateway/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway_url: gatewayUrl,
          auth_token: authToken,
        }),
      });
      
      const result: GatewayTestResult = await res.json();
      setTestResult(result);
    } catch {
      setTestResult({
        success: false,
        error: "Failed to test connection",
      });
    } finally {
      setTesting(false);
    }
  }

  async function syncIntegrations() {
    setSyncing(true);
    setSyncResult(null);
    
    try {
      const res = await fetch("/api/gateway/sync", {
        method: "POST",
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setSyncResult({
          message: data.error || "Sync failed",
          count: 0,
          error: data.error,
        });
      } else {
        setSyncResult({
          message: data.message,
          count: data.count,
        });
      }
    } catch {
      setSyncResult({
        message: "Failed to sync integrations",
        count: 0,
        error: "Network error",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function saveConnection() {
    // Validate first
    if (!validateAll()) {
      setShowFormErrors(true);
      return;
    }
    
    if (!testResult?.success) {
      await testConnection();
      return;
    }
    
    setSaving(true);
    setShowFormErrors(false);
    
    try {
      const res = await fetch("/api/gateway/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway_url: gatewayUrl,
          auth_token: authToken,
          name: gatewayName || "My OpenClaw",
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        setGateway(data.gateway);
        setAuthToken("");
        setTestResult(null);
        setErrors({});
        setTouched({});
        
        // Auto-sync integrations after connecting
        setSyncing(true);
        setSyncResult(null);
        
        try {
          const syncRes = await fetch("/api/gateway/sync", {
            method: "POST",
          });
          
          const syncData = await syncRes.json();
          
          if (syncRes.ok) {
            setSyncResult({
              message: syncData.message,
              count: syncData.count,
            });
          } else {
            setSyncResult({
              message: syncData.error || "Sync completed with warnings",
              count: 0,
              error: syncData.error,
            });
          }
        } catch {
          console.error("Failed to auto-sync integrations");
        } finally {
          setSyncing(false);
        }
      }
    } catch (err) {
      console.error("Failed to save gateway:", err);
    } finally {
      setSaving(false);
    }
  }

  async function disconnectGateway() {
    setDisconnecting(true);
    
    try {
      const res = await fetch("/api/gateway/connect", {
        method: "DELETE",
      });
      
      if (res.ok) {
        setGateway(null);
        setGatewayUrl("");
        setAuthToken("");
        setGatewayName("");
        setTestResult(null);
        setSyncResult(null);
        setErrors({});
        setTouched({});
      }
    } catch (err) {
      console.error("Failed to disconnect gateway:", err);
    } finally {
      setDisconnecting(false);
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
    const res = await fetch(`/api/team/${memberId}`, {
      method: "DELETE",
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to remove member");
    }
    
    setTeamMembers(prev => prev.filter(m => m.id !== memberId));
  }, []);

  const handleCancelInvitation = useCallback(async (invitationId: string) => {
    const res = await fetch(`/api/team/${invitationId}?type=invitation`, {
      method: "DELETE",
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to cancel invitation");
    }
    
    setPendingInvitations(prev => prev.filter(i => i.id !== invitationId));
  }, []);

  // Check if user has a cloud-provisioned instance
  const hasCloudInstance = organization?.openclaw_instance_id && organization?.openclaw_status !== "not_provisioned";

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
        {/* Organization / Cloud Instance Card */}
        {organization && (
          <Card label="Organization" accentColor="#9EFFBF" bordered={false} className="lg:col-span-2">
            <div className="mt-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-header text-xl font-bold text-forest">{organization.name}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                    {organization.plan} plan
                  </p>
                </div>
                {hasCloudInstance && (
                  <Badge status={getStatusColor(organization.openclaw_status)}>
                    {organization.openclaw_status}
                  </Badge>
                )}
              </div>

              {hasCloudInstance ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border border-[rgba(58,58,56,0.1)] bg-forest/5">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                        Instance ID
                      </span>
                      <span className="font-mono text-xs text-forest">
                        {organization.openclaw_instance_id}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                        Gateway URL
                      </span>
                      <span className="font-mono text-xs text-forest break-all">
                        {organization.openclaw_gateway_url || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                        Auth Token
                      </span>
                      <span className="font-mono text-xs text-forest">
                        {maskToken(organization.openclaw_auth_token)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshInstanceStatus}
                      disabled={refreshingStatus}
                    >
                      {refreshingStatus ? "Refreshing..." : "Refresh Status"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={syncIntegrations}
                      disabled={syncing}
                    >
                      {syncing ? "Syncing..." : "Sync Integrations"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={deleteCloudInstance}
                      disabled={deletingInstance}
                      className="text-coral hover:text-coral"
                    >
                      {deletingInstance ? "Deleting..." : "Delete Instance"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-4 border border-forest/20 bg-forest/5">
                  <p className="font-mono text-[11px] text-grid/60 mb-4">
                    You don&apos;t have a cloud agent yet. Create one to get started instantly.
                  </p>
                  <Link href="/onboarding">
                    <Button variant="solid" size="sm">
                      Create Cloud Agent
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Gateway Connection - Only show if no cloud instance or for self-hosted */}
        {(!hasCloudInstance || !organization) && (
          <Card label="Connect Your OpenClaw" accentColor="#9EFFBF" bordered={false} className="lg:col-span-2">
            {gatewayLoading ? (
              <div className="mt-2">
                <div className="h-20 bg-forest/5 animate-pulse" />
              </div>
            ) : gateway ? (
              <div className="mt-2 space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-none block ${isGatewayConnected ? 'bg-mint animate-pulse' : isGatewayReconnecting ? 'bg-[#F4D35E] animate-pulse' : 'bg-red-400'}`} />
                  <span className="font-mono text-sm text-forest">
                    Connected: <span className="font-bold">{gateway.name}</span>
                  </span>
                  <span className={`font-mono text-[10px] uppercase tracking-wide ${isGatewayConnected ? 'text-forest' : isGatewayReconnecting ? 'text-[#B8860B]' : 'text-red-500'}`}>
                    ({isGatewayConnected ? 'live' : isGatewayReconnecting ? 'reconnecting...' : liveGatewayStatus})
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-[rgba(58,58,56,0.1)] bg-forest/5">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                      Gateway URL
                    </span>
                    <span className="font-mono text-xs text-forest break-all">
                      {gateway.gateway_url}
                    </span>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50 block mb-1">
                      Status
                    </span>
                    <Badge status={gateway.status === "connected" ? "active" : "error"}>
                      {gateway.status}
                    </Badge>
                  </div>
                </div>
                
                {syncResult && (
                  <div className={`p-3 border ${syncResult.error ? "border-amber-400 bg-amber-50" : "border-mint bg-mint/10"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-none block ${syncResult.error ? "bg-amber-400" : "bg-mint"}`} />
                      <span className="font-mono text-[11px]">
                        {syncResult.message}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  {!isGatewayConnected && (
                    <Button
                      variant="solid"
                      size="sm"
                      onClick={reconnectGateway}
                      disabled={isGatewayReconnecting}
                    >
                      {isGatewayReconnecting ? "Reconnecting..." : "Reconnect"}
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={syncIntegrations}
                    disabled={syncing}
                  >
                    {syncing ? "Syncing..." : "Sync Integrations"}
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={disconnectGateway}
                    disabled={disconnecting}
                  >
                    {disconnecting ? "Disconnecting..." : "Disconnect"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-2 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="font-mono text-[11px] text-grid/60">
                    Connect your local OpenClaw agent to enable remote control from this dashboard.
                  </p>
                  <Link 
                    href="/settings/tunnel-setup"
                    className="font-mono text-[10px] uppercase tracking-wide text-forest hover:text-mint transition-colors underline underline-offset-2 whitespace-nowrap ml-4"
                  >
                    Need help exposing your OpenClaw?
                  </Link>
                </div>
                
                {/* Form Error Summary */}
                {showFormErrors && formErrors.length > 0 && (
                  <FormErrorSummary errors={formErrors} />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Gateway URL"
                    placeholder="https://your-tunnel.ngrok.io"
                    value={gatewayUrl}
                    onChange={(e) => handleFieldChange("gatewayUrl", e.target.value, setGatewayUrl)}
                    onBlur={() => handleBlur("gatewayUrl")}
                    error={errors.gatewayUrl || undefined}
                    touched={touched.gatewayUrl}
                  />
                  <Input
                    label="Auth Token"
                    type="password"
                    placeholder="Your gateway auth token"
                    value={authToken}
                    onChange={(e) => handleFieldChange("authToken", e.target.value, setAuthToken)}
                    onBlur={() => handleBlur("authToken")}
                    error={errors.authToken || undefined}
                    touched={touched.authToken}
                  />
                </div>
                
                <Input
                  label="Name (optional)"
                  placeholder="My OpenClaw"
                  value={gatewayName}
                  onChange={(e) => handleFieldChange("gatewayName", e.target.value, setGatewayName)}
                  onBlur={() => handleBlur("gatewayName")}
                  error={errors.gatewayName || undefined}
                  touched={touched.gatewayName}
                />
                
                {testResult && (
                  <div className={`p-3 border ${testResult.success ? "border-mint bg-mint/10" : "border-coral bg-coral/10"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-none block ${testResult.success ? "bg-mint" : "bg-coral"}`} />
                      <span className="font-mono text-[11px] font-bold">
                        {testResult.success ? "Connection Successful" : "Connection Failed"}
                      </span>
                    </div>
                    
                    {testResult.success ? (
                      <div className="font-mono text-[10px] text-grid/60 space-y-0.5">
                        {testResult.latencyMs && <p>Latency: {testResult.latencyMs}ms</p>}
                        {testResult.agentName && <p>Agent: {testResult.agentName}</p>}
                        {testResult.model && <p>Model: {testResult.model}</p>}
                      </div>
                    ) : (
                      <p className="font-mono text-[10px] text-coral">
                        {testResult.error}
                      </p>
                    )}
                  </div>
                )}
                
                {syncing && (
                  <div className="p-3 border border-blue-400 bg-blue-50">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-none block bg-blue-400 animate-pulse" />
                      <span className="font-mono text-[11px] text-blue-600">
                        Syncing integrations...
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={testConnection}
                    disabled={testing || !gatewayUrl || !authToken}
                  >
                    {testing ? "Testing..." : "Test Connection"}
                  </Button>
                  <Button 
                    variant="solid" 
                    size="sm" 
                    onClick={saveConnection}
                    disabled={saving || !gatewayUrl || !authToken || (testResult !== null && !testResult.success)}
                  >
                    {saving ? "Saving..." : "Save Connection"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        
        {/* Settings Navigation Cards */}
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

        {/* Nodes */}
        <Card label="Nodes" accentColor="#9EFFBF" bordered={false}>
          <div className="mt-2 space-y-3">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                Connect and manage your Mac devices
              </span>
            </div>
            <Link href="/settings/nodes">
              <Button variant="ghost" size="sm" className="w-full justify-between">
                Manage Nodes
                <ArrowRight className="w-3 h-3" />
              </Button>
            </Link>
          </div>
        </Card>

{/* Billing */}
        {upgradedBanner && (
          <div className="p-3 border border-mint bg-mint/10">
            <span className="font-mono text-[11px] text-forest font-bold">🎉 You're now on Pro! Enjoy unlimited access.</span>
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
