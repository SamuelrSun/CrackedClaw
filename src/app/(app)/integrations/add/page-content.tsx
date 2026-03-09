"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthConfig } from "@/components/integrations/oauth-config";
import { ApiKeyConfig } from "@/components/integrations/api-key-config";
import { BrowserConfig } from "@/components/integrations/browser-config";
import { HybridConfig } from "@/components/integrations/hybrid-config";

type IntegrationType = "oauth" | "api-key" | "browser" | "file" | "webhook" | "hybrid";

interface IntegrationTypeOption {
  id: IntegrationType;
  name: string;
  description: string;
  icon: string;
}

const INTEGRATION_TYPES: IntegrationTypeOption[] = [
  {
    id: "oauth",
    name: "OAuth",
    description: "Connect via OAuth 2.0 authorization flow",
    icon: "🔐",
  },
  {
    id: "api-key",
    name: "API Key",
    description: "Authenticate with a static API key",
    icon: "🔑",
  },
  {
    id: "browser",
    name: "Browser",
    description: "Automate web interactions via browser",
    icon: "🌐",
  },
  {
    id: "file",
    name: "File",
    description: "Import data from local or cloud files",
    icon: "📁",
  },
  {
    id: "webhook",
    name: "Webhook",
    description: "Receive data via incoming webhooks",
    icon: "🪝",
  },
  {
    id: "hybrid",
    name: "Hybrid",
    description: "Combine multiple integration types",
    icon: "⚡",
  },
];

const ICONS = ["🔌", "📊", "💼", "🛠️", "📡", "🔗", "⚙️", "🎯", "📈", "🤖"];

export default function AddIntegrationPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [typeConfig, setTypeConfig] = useState<Record<string, unknown>>({});
  const [integrationName, setIntegrationName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [saving, setSaving] = useState(false);

  const totalSteps = 4;

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return selectedType !== null;
      case 2:
        return Object.keys(typeConfig).length > 0;
      case 3:
        return integrationName.trim().length > 0;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    router.push("/integrations");
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <p className="font-mono text-[11px] text-grid/60">
              Choose how you want to connect to your data source.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {INTEGRATION_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={`p-4 text-left border transition-all ${
                    selectedType === type.id
                      ? "border-forest bg-forest/5"
                      : "border-[rgba(58,58,56,0.2)] hover:border-forest/50"
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <h3 className="font-header text-sm font-bold mt-2">
                    {type.name}
                  </h3>
                  <p className="font-mono text-[10px] text-grid/50 mt-1">
                    {type.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="font-mono text-[11px] text-grid/60">
              Configure your {selectedType === "oauth" ? "OAuth" : selectedType} integration settings.
            </p>
            {selectedType === "oauth" && (
              <OAuthConfig
                config={typeConfig}
                onChange={setTypeConfig}
              />
            )}
            {selectedType === "api-key" && (
              <ApiKeyConfig
                config={typeConfig}
                onChange={setTypeConfig}
              />
            )}
            {selectedType === "browser" && (
              <BrowserConfig
                config={typeConfig}
                onChange={setTypeConfig}
              />
            )}
            {selectedType === "hybrid" && (
              <HybridConfig
                config={typeConfig}
                onChange={setTypeConfig}
              />
            )}
            {selectedType === "file" && (
              <div className="space-y-4">
                <Input
                  label="File Source"
                  placeholder="Path, URL, or cloud storage location"
                  value={(typeConfig.source as string) || ""}
                  onChange={(e) =>
                    setTypeConfig({ ...typeConfig, source: e.target.value })
                  }
                />
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2 block">
                    File Type
                  </span>
                  <div className="flex gap-2">
                    {["CSV", "JSON", "XML", "Excel"].map((ft) => (
                      <button
                        key={ft}
                        type="button"
                        onClick={() =>
                          setTypeConfig({ ...typeConfig, fileType: ft })
                        }
                        className={`px-3 py-1.5 font-mono text-[10px] border ${
                          typeConfig.fileType === ft
                            ? "border-forest bg-forest/5 text-forest"
                            : "border-[rgba(58,58,56,0.2)] text-grid/60"
                        }`}
                      >
                        {ft}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {selectedType === "webhook" && (
              <div className="space-y-4">
                <div className="p-4 bg-cream border border-[rgba(58,58,56,0.2)]">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
                    Your Webhook URL
                  </span>
                  <code className="block mt-2 font-mono text-xs text-forest break-all">
                    https://api.openclaw.ai/webhooks/incoming/{Date.now().toString(36)}
                  </code>
                </div>
                <Input
                  label="Secret Key (optional)"
                  type="password"
                  placeholder="Webhook signing secret"
                  value={(typeConfig.secret as string) || ""}
                  onChange={(e) =>
                    setTypeConfig({ ...typeConfig, secret: e.target.value })
                  }
                />
              </div>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <p className="font-mono text-[11px] text-grid/60">
              Give your integration a name and choose an icon.
            </p>
            <Input
              label="Integration Name"
              placeholder="e.g., Production CRM"
              value={integrationName}
              onChange={(e) => setIntegrationName(e.target.value)}
            />
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2 block">
                Choose Icon
              </span>
              <div className="flex flex-wrap gap-2">
                {ICONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setSelectedIcon(icon)}
                    className={`w-10 h-10 text-xl flex items-center justify-center border transition-colors ${
                      selectedIcon === icon
                        ? "border-forest bg-forest/5"
                        : "border-[rgba(58,58,56,0.2)] hover:border-forest/50"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <p className="font-mono text-[11px] text-grid/60">
              Review your integration configuration before saving.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 border border-[rgba(58,58,56,0.2)]">
                <span className="text-3xl">{selectedIcon}</span>
                <div>
                  <h3 className="font-header text-lg font-bold">
                    {integrationName || "Unnamed Integration"}
                  </h3>
                  <span className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
                    {INTEGRATION_TYPES.find((t) => t.id === selectedType)?.name} Integration
                  </span>
                </div>
              </div>
              <div className="p-4 bg-cream border border-[rgba(58,58,56,0.2)]">
                <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2 block">
                  Configuration
                </span>
                <pre className="font-mono text-[11px] text-grid/80 whitespace-pre-wrap">
                  {JSON.stringify(typeConfig, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link
          href="/integrations"
          className="font-mono text-[10px] uppercase tracking-wide text-grid/50 hover:text-forest transition-colors"
        >
          ← Back to Integrations
        </Link>
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight mt-2">
          Add Integration
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Connect a new data source
        </p>
      </div>

      {/* Step Indicator */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 flex items-center justify-center font-mono text-[11px] border ${
                  currentStep === step
                    ? "border-forest bg-forest text-white"
                    : currentStep > step
                    ? "border-forest bg-forest/10 text-forest"
                    : "border-[rgba(58,58,56,0.2)] text-grid/40"
                }`}
              >
                {currentStep > step ? "✓" : step}
              </div>
              {step < 4 && (
                <div
                  className={`w-16 md:w-24 h-px mx-2 ${
                    currentStep > step ? "bg-forest" : "bg-[rgba(58,58,56,0.2)]"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">
            Type
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">
            Configure
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">
            Details
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40">
            Review
          </span>
        </div>
      </div>

      {/* Step Content */}
      <Card label={`Step ${currentStep} of ${totalSteps}`}>
        {renderStepContent()}

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8 pt-6 border-t border-[rgba(58,58,56,0.1)]">
          <Button
            type="button"
            onClick={handleBack}
            disabled={currentStep === 1}
            className={currentStep === 1 ? "opacity-30 cursor-not-allowed" : ""}
          >
            ← Back
          </Button>
          {currentStep < totalSteps ? (
            <Button
              type="button"
              onClick={handleNext}
              disabled={!canProceed()}
              variant="solid"
              className={!canProceed() ? "opacity-30 cursor-not-allowed" : ""}
            >
              Continue →
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              variant="solid"
            >
              {saving ? "Saving..." : "Save Integration"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
