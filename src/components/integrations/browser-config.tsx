"use client";

import { Input } from "@/components/ui/input";

interface BrowserConfigProps {
  config: {
    targetUrl?: string;
    loginUrl?: string;
    loginInstructions?: string;
    selectors?: string;
  };
  onChange: (config: BrowserConfigProps["config"]) => void;
}

export function BrowserConfig({ config, onChange }: BrowserConfigProps) {
  return (
    <div className="space-y-4">
      <Input
        label="Target URL"
        placeholder="https://app.example.com/dashboard"
        value={config.targetUrl || ""}
        onChange={(e) => onChange({ ...config, targetUrl: e.target.value })}
      />

      <Input
        label="Login URL (optional)"
        placeholder="https://app.example.com/login"
        value={config.loginUrl || ""}
        onChange={(e) => onChange({ ...config, loginUrl: e.target.value })}
      />

      <div className="flex flex-col gap-1.5">
        <label className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
          Login Instructions
        </label>
        <textarea
          className="w-full bg-white border border-white/[0.1] rounded-none px-3 py-2 font-body text-sm text-forest placeholder:text-grid/30 outline-none focus:border-forest transition-colors min-h-[100px] resize-y"
          placeholder="Describe how to authenticate (e.g., 'Click Sign In, enter email/password, click Submit')"
          value={config.loginInstructions || ""}
          onChange={(e) =>
            onChange({ ...config, loginInstructions: e.target.value })
          }
        />
      </div>

      <Input
        label="CSS Selectors for Data (optional)"
        placeholder=".data-table, #main-content"
        value={config.selectors || ""}
        onChange={(e) => onChange({ ...config, selectors: e.target.value })}
      />

      <div className="p-3 bg-amber-900/20 border border-amber-500/30">
        <span className="font-mono text-[10px] uppercase tracking-wide text-amber-400">
          Browser Integration
        </span>
        <p className="font-mono text-[11px] text-grid/60 mt-1">
          Browser integrations use automated browser sessions to interact with
          web applications that don&apos;t have APIs. Credentials will be stored
          securely.
        </p>
      </div>
    </div>
  );
}
