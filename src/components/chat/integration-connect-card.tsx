"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, FileText, Check, Loader2 } from "lucide-react";

export type IntegrationProvider = "google" | "slack" | "notion";

interface IntegrationConnectCardProps {
  provider: IntegrationProvider;
  onConnect: () => Promise<boolean>;
}

const providerConfig: Record<
  IntegrationProvider,
  { name: string; description: string; icon: React.ReactNode }
> = {
  google: {
    name: "Google Workspace",
    description: "Connect Gmail, Calendar, and Drive",
    icon: <Mail className="w-5 h-5" />,
  },
  slack: {
    name: "Slack",
    description: "Connect your workspace channels",
    icon: <MessageSquare className="w-5 h-5" />,
  },
  notion: {
    name: "Notion",
    description: "Connect your pages and databases",
    icon: <FileText className="w-5 h-5" />,
  },
};

export function IntegrationConnectCard({
  provider,
  onConnect,
}: IntegrationConnectCardProps) {
  const [status, setStatus] = useState<"loading" | "default" | "connecting" | "connected">("loading");
  const config = providerConfig[provider];

  // Check on mount if already connected
  useEffect(() => {
    fetch(`/api/integrations/status/${provider}`)
      .then(r => r.json())
      .then(d => setStatus(d.connected ? "connected" : "default"))
      .catch(() => setStatus("default"));
  }, [provider]);

  const handleConnect = async () => {
    setStatus("connecting");
    try {
      const success = await onConnect();
      setStatus(success ? "connected" : "default");
    } catch {
      setStatus("default");
    }
  };

  if (status === "loading") {
    return (
      <div className="border border-[rgba(58,58,56,0.2)] rounded-none bg-gray-100 p-4 max-w-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 border border-[rgba(58,58,56,0.2)] flex items-center justify-center text-forest animate-pulse bg-grid/10" />
          <div className="flex-1 h-8 bg-grid/10 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  // Already connected — render minimal inline badge instead of full card
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-forest bg-[#9EFFBF]/20 border border-[#9EFFBF]/40 px-2 py-1 rounded-sm">
        <Check className="w-3 h-3" />
        {config.name} connected
      </span>
    );
  }

  return (
    <div className="border border-[rgba(58,58,56,0.2)] rounded-none bg-gray-100 p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 border border-[rgba(58,58,56,0.2)] flex items-center justify-center text-forest">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-header text-sm font-bold text-forest">
            {config.name}
          </h4>
          <p className="text-xs text-grid/60 mt-0.5">
            {status === "connected" ? "Connected ✓" : config.description}
          </p>
        </div>
      </div>

      <button
        onClick={status === "default" ? handleConnect : undefined}
        disabled={status !== "default"}
        className={cn(
          "w-full mt-3 py-2 px-4 font-mono text-[10px] uppercase tracking-wide transition-all border border-[rgba(58,58,56,0.2)] rounded-none",
          status === "default" &&
            "bg-forest text-white hover:bg-forest/90 cursor-pointer",
          status === "connecting" &&
            "bg-forest/50 text-white cursor-wait",
        )}
      >
        {status === "default" && "Connect"}
        {status === "connecting" && (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting...
          </span>
        )}
      </button>
    </div>
  );
}
