"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding, OnboardingStep } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GatewayTestResult } from "@/types/gateway";

// Progress indicator component
function ProgressIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-12">
      {Array.from({ length: totalSteps }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-none transition-all duration-300 ${
            i <= currentStep ? "bg-forest w-8" : "bg-forest/20 w-4"
          }`}
        />
      ))}
    </div>
  );
}

// Step 1: Welcome
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-forest mx-auto mb-8 flex items-center justify-center">
        <span className="text-white font-header text-3xl font-bold">OC</span>
      </div>
      
      <h1 className="font-header text-4xl font-bold text-forest mb-4">
        Welcome to CrackedClaw
      </h1>
      
      <p className="font-body text-lg text-grid/70 max-w-md mx-auto mb-8">
        Your AI agent command center. Control and monitor your OpenClaw instances 
        from anywhere, with powerful integrations and real-time insights.
      </p>

      <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-12">
        <div className="p-4 border border-forest/20 bg-white/50">
          <div className="w-10 h-10 bg-mint/30 mx-auto mb-2 flex items-center justify-center">
            <span className="text-forest">🔗</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            Connect
          </p>
        </div>
        <div className="p-4 border border-forest/20 bg-white/50">
          <div className="w-10 h-10 bg-gold/30 mx-auto mb-2 flex items-center justify-center">
            <span className="text-forest">⚡</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            Integrate
          </p>
        </div>
        <div className="p-4 border border-forest/20 bg-white/50">
          <div className="w-10 h-10 bg-coral/30 mx-auto mb-2 flex items-center justify-center">
            <span className="text-forest">🚀</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            Deploy
          </p>
        </div>
      </div>
      
      <Button variant="solid" onClick={onNext} className="px-8 py-3">
        Get Started
      </Button>
    </div>
  );
}

// Step 2: Connect Gateway (with Create My Agent option)
function ConnectStep({
  onNext,
  onSkip,
  onConnected,
}: {
  onNext: () => void;
  onSkip: () => void;
  onConnected: (connected: boolean) => void;
}) {
  const [mode, setMode] = useState<"choose" | "create" | "connect">("choose");
  const router = useRouter();
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [testResult, setTestResult] = useState<GatewayTestResult | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    
    try {
      const res = await fetch("/api/gateway/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gateway_url: gatewayUrl, auth_token: authToken }),
      });
      
      const result: GatewayTestResult = await res.json();
      setTestResult(result);
    } catch {
      setTestResult({ success: false, error: "Failed to test connection" });
    } finally {
      setTesting(false);
    }
  }

  async function saveConnection() {
    if (!testResult?.success) {
      await testConnection();
      return;
    }
    
    setSaving(true);
    
    try {
      const res = await fetch("/api/gateway/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gateway_url: gatewayUrl,
          auth_token: authToken,
          name: "My OpenClaw",
        }),
      });
      
      if (res.ok) {
        // Redirect to chat for AI-guided onboarding
        router.push("/chat");
      }
    } catch (err) {
      console.error("Failed to save gateway:", err);
    } finally {
      setSaving(false);
    }
  }

  async function provisionCloudAgent() {
    if (!organizationName.trim()) {
      setProvisionError("Please enter a name for your workspace");
      return;
    }

    setProvisioning(true);
    setProvisionError(null);

    try {
      const res = await fetch("/api/organizations/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_name: organizationName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Already provisioned — just go to chat
        if (data.organization?.openclaw_gateway_url || (data.error && data.error.includes("already has a provisioned"))) {
          router.push("/chat");
          return;
        }
        setProvisionError(data.error || "Failed to create agent");
        return;
      }

      // Success! Agent is provisioned - redirect to onboarding chat
      // Redirect to chat for AI-guided onboarding
      router.push("/chat");
    } catch (err) {
      console.error("Provisioning error:", err);
      setProvisionError("Failed to create agent. Please try again.");
    } finally {
      setProvisioning(false);
    }
  }

  // Initial choice screen
  if (mode === "choose") {
    return (
      <div className="text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-mint/30 mx-auto mb-6 flex items-center justify-center">
          <span className="text-3xl">🤖</span>
        </div>
        
        <h2 className="font-header text-3xl font-bold text-forest mb-4">
          Set Up Your Agent
        </h2>
        
        <p className="font-body text-base text-grid/70 max-w-md mx-auto mb-8">
          Create a cloud-hosted AI agent instantly, or connect to your existing self-hosted OpenClaw.
        </p>
        
        <div className="space-y-3 max-w-sm mx-auto">
          {/* Primary option: Create My Agent */}
          <button
            onClick={() => setMode("create")}
            className="w-full p-5 border-2 border-forest bg-forest text-white hover:bg-forest/90 transition-colors text-left group"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">✨</span>
              <span className="font-mono text-[12px] uppercase tracking-wide font-bold">
                Create My Agent
              </span>
              <span className="ml-auto font-mono text-[10px] uppercase bg-mint text-forest px-2 py-0.5">
                Recommended
              </span>
            </div>
            <span className="font-mono text-[11px] text-white/70 block pl-9">
              Instant cloud setup. No installation needed.
            </span>
          </button>
          
          {/* Secondary option: Connect Existing */}
          <button
            onClick={() => setMode("connect")}
            className="w-full p-4 border border-forest/30 bg-white hover:border-forest transition-colors text-left"
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl">🔌</span>
              <span className="font-mono text-[11px] uppercase tracking-wide font-semibold text-forest">
                Connect Existing OpenClaw
              </span>
            </div>
            <span className="font-mono text-[10px] text-grid/60 block pl-8">
              Link your self-hosted instance
            </span>
          </button>
        </div>
        
        <button
          onClick={onSkip}
          className="mt-8 font-mono text-[10px] text-grid/50 uppercase tracking-wide hover:text-forest transition-colors"
        >
          Skip for now
        </button>
      </div>
    );
  }

  // Create My Agent flow
  if (mode === "create") {
    return (
      <div className="animate-in fade-in duration-500 max-w-md mx-auto">
        <button
          onClick={() => setMode("choose")}
          className="mb-6 font-mono text-[10px] text-grid/50 uppercase tracking-wide hover:text-forest transition-colors"
        >
          ← Back
        </button>
        
        <div className="w-16 h-16 bg-mint/30 mx-auto mb-6 flex items-center justify-center">
          <span className="text-3xl">✨</span>
        </div>
        
        <h2 className="font-header text-2xl font-bold text-forest mb-2 text-center">
          Create Your Cloud Agent
        </h2>
        <p className="font-mono text-[11px] text-grid/60 mb-6 text-center">
          We&apos;ll set up a dedicated AI agent for you in seconds.
        </p>
        
        <div className="space-y-4">
          <Input
            label="Workspace Name"
            placeholder="My Workspace"
            value={organizationName}
            onChange={(e) => {
              setOrganizationName(e.target.value);
              setProvisionError(null);
            }}
          />
          
          {provisionError && (
            <div className="p-3 border border-coral bg-coral/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-coral block" />
                <span className="font-mono text-[11px] text-coral">{provisionError}</span>
              </div>
            </div>
          )}

          {provisioning && (
            <div className="p-4 border border-mint bg-mint/10">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-forest border-t-transparent rounded-full animate-spin" />
                <div>
                  <span className="font-mono text-[11px] font-bold text-forest block">
                    Creating your agent...
                  </span>
                  <span className="font-mono text-[10px] text-grid/60">
                    This usually takes 10-30 seconds
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <Button
            variant="solid"
            onClick={provisionCloudAgent}
            disabled={provisioning || !organizationName.trim()}
            className="w-full"
          >
            {provisioning ? "Creating..." : "Create My Agent"}
          </Button>
        </div>
        
        <div className="mt-8 p-4 border border-forest/10 bg-forest/5">
          <p className="font-mono text-[10px] text-grid/60 text-center">
            🔒 Your agent runs in a secure, isolated environment.
            <br />
            You can customize it after setup.
          </p>
        </div>
      </div>
    );
  }

  // Connect Existing flow (original form)
  return (
    <div className="animate-in fade-in duration-500 max-w-md mx-auto">
      <button
        onClick={() => setMode("choose")}
        className="mb-6 font-mono text-[10px] text-grid/50 uppercase tracking-wide hover:text-forest transition-colors"
      >
        ← Back
      </button>
      
      <h2 className="font-header text-2xl font-bold text-forest mb-2">
        Connect Your Gateway
      </h2>
      <p className="font-mono text-[11px] text-grid/60 mb-6">
        Enter your OpenClaw gateway URL and authentication token.
      </p>
      
      <div className="space-y-4">
        <Input
          label="Gateway URL"
          placeholder="https://your-tunnel.ngrok.io"
          value={gatewayUrl}
          onChange={(e) => {
            setGatewayUrl(e.target.value);
            setTestResult(null);
          }}
        />
        
        <Input
          label="Auth Token"
          type="password"
          placeholder="Your gateway auth token"
          value={authToken}
          onChange={(e) => {
            setAuthToken(e.target.value);
            setTestResult(null);
          }}
        />
        
        {testResult && (
          <div className={`p-3 border ${testResult.success ? "border-mint bg-mint/10" : "border-coral/50 bg-coral/10"}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-2 h-2 block ${testResult.success ? "bg-mint" : "bg-coral"}`} />
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
        
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={testConnection}
            disabled={testing || !gatewayUrl || !authToken}
          >
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            variant="solid"
            onClick={saveConnection}
            disabled={saving || !gatewayUrl || !authToken}
          >
            {saving ? "Connecting..." : "Connect & Continue"}
          </Button>
        </div>
      </div>
      
      <button
        onClick={onSkip}
        className="mt-6 font-mono text-[10px] text-grid/50 uppercase tracking-wide hover:text-forest transition-colors block"
      >
        Skip for now
      </button>
    </div>
  );
}

// Step 3: Sync Integrations
interface IntegrationItem {
  id: string;
  name: string;
  slug: string;
  icon: string;
  status: string;
}

function IntegrationsStep({
  onNext,
  onSkip,
  selectedIntegrations,
  onToggleIntegration,
}: {
  onNext: () => void;
  onSkip: () => void;
  selectedIntegrations: string[];
  onToggleIntegration: (id: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchIntegrations() {
      try {
        // First sync from gateway
        const syncRes = // sync not needed in serverless mode
        if (!syncRes.ok) {
          const data = await syncRes.json();
          setError(data.error || "Failed to sync");
          setLoading(false);
          return;
        }

        // Then fetch all integrations
        const res = await fetch("/api/integrations");
        if (res.ok) {
          const data = await res.json();
          setIntegrations(data.integrations || []);
          // Select all by default
          if (data.integrations?.length > 0 && selectedIntegrations.length === 0) {
            data.integrations.forEach((i: IntegrationItem) => onToggleIntegration(i.id));
          }
        }
      } catch {
        setError("Failed to load integrations");
      } finally {
        setLoading(false);
      }
    }
    
    fetchIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      // sync not needed in serverless mode
      router.push("/chat");
    } catch {
      setError("Failed to sync integrations");
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-gold/30 mx-auto mb-6 flex items-center justify-center animate-pulse">
          <span className="text-3xl">⚡</span>
        </div>
        <h2 className="font-header text-2xl font-bold text-forest mb-4">
          Finding Your Integrations...
        </h2>
        <p className="font-mono text-[11px] text-grid/60">
          Syncing with your OpenClaw gateway
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-coral/30 mx-auto mb-6 flex items-center justify-center">
          <span className="text-3xl">⚠️</span>
        </div>
        <h2 className="font-header text-2xl font-bold text-forest mb-4">
          Could Not Sync Integrations
        </h2>
        <p className="font-mono text-[11px] text-grid/60 mb-6">{error}</p>
        <div className="flex gap-3 justify-center">
          <Button variant="ghost" onClick={onSkip}>
            Skip
          </Button>
          <Button variant="solid" onClick={onNext}>
            Continue Anyway
          </Button>
        </div>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <div className="text-center animate-in fade-in duration-500">
        <div className="w-16 h-16 bg-forest/10 mx-auto mb-6 flex items-center justify-center">
          <span className="text-3xl">📦</span>
        </div>
        <h2 className="font-header text-2xl font-bold text-forest mb-4">
          No Integrations Found
        </h2>
        <p className="font-mono text-[11px] text-grid/60 mb-6">
          Your OpenClaw doesn&apos;t have any integrations configured yet.
          <br />
          You can add them later from the Integrations page.
        </p>
        <Button variant="solid" onClick={onNext}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-lg mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gold/30 mx-auto mb-6 flex items-center justify-center">
          <span className="text-3xl">⚡</span>
        </div>
        <h2 className="font-header text-2xl font-bold text-forest mb-2">
          We Found {integrations.length} Integration{integrations.length !== 1 ? "s" : ""}
        </h2>
        <p className="font-mono text-[11px] text-grid/60">
          Select which integrations to sync to your dashboard
        </p>
      </div>

      <div className="space-y-2 mb-8">
        {integrations.map((integration) => {
          const isSelected = selectedIntegrations.includes(integration.id);
          return (
            <button
              key={integration.id}
              onClick={() => onToggleIntegration(integration.id)}
              className={`w-full p-4 border text-left flex items-center gap-4 transition-colors ${
                isSelected 
                  ? "border-forest bg-forest/5" 
                  : "border-forest/20 bg-white hover:border-forest/40"
              }`}
            >
              <div className="w-10 h-10 bg-paper flex items-center justify-center text-xl">
                {integration.icon}
              </div>
              <div className="flex-1">
                <span className="font-mono text-[12px] font-semibold text-forest block">
                  {integration.name}
                </span>
                <span className="font-mono text-[10px] text-grid/50 uppercase tracking-wide">
                  {integration.status}
                </span>
              </div>
              <div
                className={`w-5 h-5 border-2 flex items-center justify-center transition-colors ${
                  isSelected ? "border-forest bg-forest" : "border-forest/30"
                }`}
              >
                {isSelected && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex gap-3 justify-center">
        <Button variant="ghost" onClick={onSkip}>
          Skip
        </Button>
        <Button
          variant="solid"
          onClick={handleSync}
          disabled={syncing || selectedIntegrations.length === 0}
        >
          {syncing ? "Syncing..." : `Sync ${selectedIntegrations.length} Integration${selectedIntegrations.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}

// Step 4: Complete
function CompleteStep({
  gatewayConnected,
  integrationCount,
  onFinish,
}: {
  gatewayConnected: boolean;
  integrationCount: number;
  onFinish: () => void;
}) {
  return (
    <div className="text-center animate-in fade-in duration-500">
      <div className="w-20 h-20 bg-mint/30 mx-auto mb-8 flex items-center justify-center">
        <span className="text-4xl">✨</span>
      </div>
      
      <h2 className="font-header text-3xl font-bold text-forest mb-4">
        You&apos;re All Set!
      </h2>
      
      <p className="font-body text-base text-grid/70 max-w-md mx-auto mb-8">
        Your OpenClaw Cloud dashboard is ready. Here&apos;s what we set up for you:
      </p>
      
      <div className="max-w-sm mx-auto mb-10 space-y-3">
        <div className="flex items-center gap-3 p-3 border border-forest/20 bg-white/50">
          <div className={`w-4 h-4 flex items-center justify-center ${gatewayConnected ? "bg-mint" : "bg-grid/20"}`}>
            {gatewayConnected ? (
              <svg className="w-3 h-3 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-[10px] text-grid/50">—</span>
            )}
          </div>
          <span className="font-mono text-[11px] text-forest">
            {gatewayConnected ? "Agent Connected" : "Agent not connected (connect later in Settings)"}
          </span>
        </div>
        
        <div className="flex items-center gap-3 p-3 border border-forest/20 bg-white/50">
          <div className={`w-4 h-4 flex items-center justify-center ${integrationCount > 0 ? "bg-mint" : "bg-grid/20"}`}>
            {integrationCount > 0 ? (
              <svg className="w-3 h-3 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-[10px] text-grid/50">—</span>
            )}
          </div>
          <span className="font-mono text-[11px] text-forest">
            {integrationCount > 0 
              ? `${integrationCount} Integration${integrationCount !== 1 ? "s" : ""} Synced`
              : "No integrations synced (add later)"
            }
          </span>
        </div>
        
        <div className="flex items-center gap-3 p-3 border border-forest/20 bg-white/50">
          <div className="w-4 h-4 bg-mint flex items-center justify-center">
            <svg className="w-3 h-3 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <span className="font-mono text-[11px] text-forest">
            Dashboard Ready
          </span>
        </div>
      </div>
      
      <Button variant="solid" onClick={onFinish} className="px-8 py-3">
        Go to Dashboard
      </Button>
    </div>
  );
}

// Main Onboarding Page
export default function OnboardingPage() {
  const router = useRouter();
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    gatewayConnected,
    selectedIntegrations,
    isLoaded,
    nextStep,
    setGatewayConnected,
    toggleIntegration,
    completeOnboarding,
    goToStep,
  } = useOnboarding();

  // Handle skip - go to complete step
  const handleSkip = () => {
    goToStep("complete");
  };

  // Handle finish
  const handleFinish = async () => {
    completeOnboarding();
    
    // Also try to save to Supabase
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch {
      // Ignore - localStorage is enough
    }
    
    router.push("/");
  };

  // Check if already provisioned on mount — redirect to chat if so
  useEffect(() => {
    async function checkExistingOrg() {
      try {
        const res = await fetch("/api/organizations/provision");
        if (res.ok) {
          const data = await res.json();
          if (data.organization?.openclaw_status === "running" && data.organization?.openclaw_gateway_url) {
            router.replace("/chat");
          }
        }
      } catch {
        // ignore, let onboarding proceed
      }
    }
    checkExistingOrg();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't render until state is loaded
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-paper flex items-center justify-center">
        <div className="w-12 h-12 bg-forest flex items-center justify-center">
          <span className="text-white font-header text-lg font-bold">OC</span>
        </div>
      </div>
    );
  }

  // Render current step
  const renderStep = () => {
    switch (currentStep) {
      case "welcome":
        return <WelcomeStep onNext={nextStep} />;
      case "connect":
        return (
          <ConnectStep
            onNext={nextStep}
            onSkip={handleSkip}
            onConnected={setGatewayConnected}
          />
        );
      case "integrations":
        return (
          <IntegrationsStep
            onNext={nextStep}
            onSkip={handleSkip}
            selectedIntegrations={selectedIntegrations}
            onToggleIntegration={toggleIntegration}
          />
        );
      case "complete":
        return (
          <CompleteStep
            gatewayConnected={gatewayConnected}
            integrationCount={selectedIntegrations.length}
            onFinish={handleFinish}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <ProgressIndicator currentStep={currentStepIndex} totalSteps={totalSteps} />
        {renderStep()}
      </div>
    </div>
  );
}
