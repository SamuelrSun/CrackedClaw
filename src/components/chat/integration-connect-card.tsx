"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Mail, MessageSquare, FileText, Check, Loader2 } from "lucide-react";

export type IntegrationProvider = "google" | "slack" | "notion";

interface IntegrationConnectCardProps {
  provider: IntegrationProvider;
  onConnect: () => void;
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
  const [status, setStatus] = useState<"default" | "connecting" | "connected">(
    "default"
  );
  const config = providerConfig[provider];

  const handleConnect = async () => {
    setStatus("connecting");
    try {
      await onConnect();
      setStatus("connected");
    } catch {
      setStatus("default");
    }
  };

  return (
    <div className="border border-[rgba(58,58,56,0.2)] rounded-none bg-white p-4 max-w-sm">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 border border-[rgba(58,58,56,0.2)] flex items-center justify-center text-forest">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-header text-sm font-bold text-forest">
            {config.name}
          </h4>
          <p className="text-xs text-grid/60 mt-0.5">{config.description}</p>
        </div>
      </div>

      <button
        onClick={handleConnect}
        disabled={status !== "default"}
        className={cn(
          "w-full mt-3 py-2 px-4 font-mono text-[10px] uppercase tracking-wide transition-all border border-[rgba(58,58,56,0.2)] rounded-none",
          status === "default" &&
            "bg-forest text-white hover:bg-forest/90 cursor-pointer",
          status === "connecting" &&
            "bg-forest/50 text-white cursor-wait",
          status === "connected" &&
            "bg-[#9EFFBF]/20 text-forest border-[#9EFFBF] cursor-default"
        )}
      >
        {status === "default" && "Connect"}
        {status === "connecting" && (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Connecting...
          </span>
        )}
        {status === "connected" && (
          <span className="flex items-center justify-center gap-2">
            <Check className="w-3 h-3" />
            Connected
          </span>
        )}
      </button>
    </div>
  );
}
