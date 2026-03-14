"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Sparkles, Key, Cloud } from "lucide-react";

const MODEL_OPTIONS = [
  {
    value: "claude-sonnet-4",
    label: "Claude Sonnet 4",
    description: "Best balance of speed and intelligence (default)",
  },
  {
    value: "claude-opus-4",
    label: "Claude Opus 4",
    description: "Most capable for complex tasks",
  },
  {
    value: "claude-haiku-3-5",
    label: "Claude Haiku 3.5",
    description: "Fastest and most cost-effective",
  },
];

export default function AISettingsClient() {
  const [model, setModel] = useState("claude-sonnet-4");
  const [useOwnKey, setUseOwnKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings/ai");
      if (res.ok) {
        const data = await res.json();
        setModel(data.model || "claude-sonnet-4");
        setUseOwnKey(data.has_custom_key || false);
      }
    } catch (err) {
      console.error("Failed to fetch AI settings:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaveResult(null);

    try {
      const res = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          ai_api_key: useOwnKey ? apiKey : undefined,
          use_default_key: !useOwnKey,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setSaveResult({ success: true });
        setApiKey(""); // Clear the API key input after saving
      } else {
        setSaveResult({ success: false, error: data.error });
      }
    } catch (err) {
      setSaveResult({
        success: false,
        error: err instanceof Error ? err.message : "Failed to save",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wide text-grid/60 hover:text-forest transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Settings
        </Link>
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight">
          AI Provider
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Model selection and API configuration
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-2xl">
        {/* Model Selection */}
        <Card label="Model Selection" accentColor="#9EFFBF" bordered>
          <div className="mt-2 space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                Choose your default AI model
              </span>
            </div>

            {loading ? (
              <div className="h-20 bg-forest/5 animate-pulse" />
            ) : (
              <Select
                value={model}
                onChange={setModel}
                options={MODEL_OPTIONS}
                label="Default Model"
              />
            )}
          </div>
        </Card>

        {/* API Key Configuration */}
        <Card label="API Key" accentColor="#F4D35E" bordered>
          <div className="mt-2 space-y-4">
            {/* Current status */}
            <div className="flex items-center justify-between p-3 bg-forest/5 border border-white/[0.08]">
              <div className="flex items-center gap-3">
                {useOwnKey ? (
                  <Key className="w-5 h-5 text-gold" />
                ) : (
                  <Cloud className="w-5 h-5 text-mint" />
                )}
                <div>
                  <span className="font-mono text-[11px] text-forest block">
                    {useOwnKey ? "Using your API key" : "Using Dopl Cloud API"}
                  </span>
                  <span className="font-mono text-[10px] text-grid/50">
                    {useOwnKey
                      ? "Billed directly by Anthropic"
                      : "Included in your Dopl subscription"}
                  </span>
                </div>
              </div>
              <Badge status={useOwnKey ? "pending" : "active"}>
                {useOwnKey ? "BYOK" : "Cloud"}
              </Badge>
            </div>

            {/* Toggle */}
            <div className="flex items-center justify-between py-2">
              <div>
                <span className="font-mono text-[11px] text-forest block">
                  Use my own API key
                </span>
                <span className="font-mono text-[10px] text-grid/50">
                  Bring your own Anthropic API key
                </span>
              </div>
              <Toggle checked={useOwnKey} onChange={setUseOwnKey} />
            </div>

            {/* API Key Input (conditional) */}
            {useOwnKey && (
              <div className="pt-2 border-t border-white/[0.08]">
                <Input
                  label="Anthropic API Key"
                  type="password"
                  placeholder="sk-ant-api03-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="font-mono text-[10px] text-grid/40 mt-2">
                  Get your API key from{" "}
                  <a
                    href="https://console.anthropic.com/settings/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-forest hover:text-mint underline"
                  >
                    console.anthropic.com
                  </a>
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Save Result */}
        {saveResult && (
          <div
            className={`p-3 border ${
              saveResult.success
                ? "border-mint bg-mint/10"
                : "border-coral bg-coral/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 block ${
                  saveResult.success ? "bg-mint" : "bg-coral"
                }`}
              />
              <span className="font-mono text-[11px]">
                {saveResult.success
                  ? "Settings saved successfully"
                  : saveResult.error || "Failed to save settings"}
              </span>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            variant="solid"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
