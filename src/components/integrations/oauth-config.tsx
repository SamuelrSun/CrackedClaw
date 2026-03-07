"use client";

import { Input } from "@/components/ui/input";

const POPULAR_PROVIDERS = [
  { id: "google", name: "Google", url: "https://accounts.google.com/o/oauth2" },
  { id: "github", name: "GitHub", url: "https://github.com/login/oauth" },
  { id: "slack", name: "Slack", url: "https://slack.com/oauth/v2" },
  { id: "notion", name: "Notion", url: "https://api.notion.com/v1/oauth" },
  { id: "linear", name: "Linear", url: "https://linear.app/oauth" },
  { id: "custom", name: "Custom", url: "" },
];

interface OAuthConfigProps {
  config: {
    provider?: string;
    oauthUrl?: string;
    clientId?: string;
    clientSecret?: string;
    scopes?: string;
  };
  onChange: (config: OAuthConfigProps["config"]) => void;
}

export function OAuthConfig({ config, onChange }: OAuthConfigProps) {
  const selectedProvider = config.provider || "";
  const isCustom = selectedProvider === "custom";

  return (
    <div className="space-y-4">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-2 block">
          Select Provider
        </span>
        <div className="grid grid-cols-3 gap-2">
          {POPULAR_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              onClick={() =>
                onChange({
                  ...config,
                  provider: provider.id,
                  oauthUrl: provider.url,
                })
              }
              className={`py-2 px-3 font-mono text-[11px] border transition-colors ${
                selectedProvider === provider.id
                  ? "border-forest bg-forest/5 text-forest"
                  : "border-[rgba(58,58,56,0.2)] text-grid/60 hover:border-forest/50"
              }`}
            >
              {provider.name}
            </button>
          ))}
        </div>
      </div>

      {isCustom && (
        <Input
          label="OAuth Authorization URL"
          placeholder="https://example.com/oauth/authorize"
          value={config.oauthUrl || ""}
          onChange={(e) => onChange({ ...config, oauthUrl: e.target.value })}
        />
      )}

      <Input
        label="Client ID"
        placeholder="Enter your OAuth client ID"
        value={config.clientId || ""}
        onChange={(e) => onChange({ ...config, clientId: e.target.value })}
      />

      <Input
        label="Client Secret"
        type="password"
        placeholder="Enter your OAuth client secret"
        value={config.clientSecret || ""}
        onChange={(e) => onChange({ ...config, clientSecret: e.target.value })}
      />

      <Input
        label="Scopes (comma-separated)"
        placeholder="read, write, profile"
        value={config.scopes || ""}
        onChange={(e) => onChange({ ...config, scopes: e.target.value })}
      />
    </div>
  );
}
