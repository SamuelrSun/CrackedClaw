"use client";

import { Input } from "@/components/ui/input";

interface ApiKeyConfigProps {
  config: {
    keyName?: string;
    baseUrl?: string;
    apiKey?: string;
    headerName?: string;
  };
  onChange: (config: ApiKeyConfigProps["config"]) => void;
}

export function ApiKeyConfig({ config, onChange }: ApiKeyConfigProps) {
  return (
    <div className="space-y-4">
      <Input
        label="Key Name"
        placeholder="e.g., Production API Key"
        value={config.keyName || ""}
        onChange={(e) => onChange({ ...config, keyName: e.target.value })}
      />

      <Input
        label="Base URL"
        placeholder="https://api.example.com/v1"
        value={config.baseUrl || ""}
        onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
      />

      <Input
        label="API Key"
        type="password"
        placeholder="Enter your API key"
        value={config.apiKey || ""}
        onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
      />

      <Input
        label="Header Name (optional)"
        placeholder="Authorization, X-API-Key, etc."
        value={config.headerName || ""}
        onChange={(e) => onChange({ ...config, headerName: e.target.value })}
      />

      <div className="p-3 bg-forest/5 border border-forest/20">
        <span className="font-mono text-[10px] uppercase tracking-wide text-forest/70">
          Tip
        </span>
        <p className="font-mono text-[11px] text-grid/60 mt-1">
          If header name is not specified, the key will be sent as{" "}
          <code className="bg-white px-1">Authorization: Bearer [key]</code>
        </p>
      </div>
    </div>
  );
}
