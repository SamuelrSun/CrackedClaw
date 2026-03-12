"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Hash,
  Send,
  MessageCircle,
  Smartphone,
  Shield,
  Lock,
} from "lucide-react";

export type ChannelType =
  | "whatsapp"
  | "imessage"
  | "discord"
  | "telegram"
  | "signal"
  | "slack";

export type ChannelStatusType = "connected" | "disconnected" | "setup_required";

interface ChannelCardProps {
  channel: ChannelType;
  status: ChannelStatusType;
  onConnect: () => void;
  onDisconnect: () => void;
  loading?: boolean;
  comingSoon?: boolean;
}

const channelConfig: Record<
  ChannelType,
  {
    name: string;
    icon: React.ReactNode;
    color: string;
    description: string;
  }
> = {
  whatsapp: {
    name: "WhatsApp",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#25D366",
    description: "Link your WhatsApp account via QR code pairing",
  },
  imessage: {
    name: "iMessage",
    icon: <Smartphone className="w-5 h-5" />,
    color: "#007AFF",
    description: "Requires Dopl Connect desktop companion app",
  },
  discord: {
    name: "Discord",
    icon: <MessageCircle className="w-5 h-5" />,
    color: "#5865F2",
    description: "Connect your Discord server with a bot integration",
  },
  telegram: {
    name: "Telegram",
    icon: <Send className="w-5 h-5" />,
    color: "#0088CC",
    description: "Create a Telegram bot to relay messages",
  },
  signal: {
    name: "Signal",
    icon: <Shield className="w-5 h-5" />,
    color: "#3A76F0",
    description: "End-to-end encrypted messaging via Signal protocol",
  },
  slack: {
    name: "Slack",
    icon: <Hash className="w-5 h-5" />,
    color: "#4A154B",
    description: "Connect to your Slack workspace channels",
  },
};

const statusLabels: Record<ChannelStatusType, { label: string; badge: "active" | "inactive" | "pending" }> = {
  connected: { label: "Connected", badge: "active" },
  disconnected: { label: "Not Connected", badge: "inactive" },
  setup_required: { label: "Setup Required", badge: "pending" },
};

export function ChannelCard({
  channel,
  status,
  onConnect,
  onDisconnect,
  loading = false,
  comingSoon = false,
}: ChannelCardProps) {
  const config = channelConfig[channel];
  const statusInfo = statusLabels[status];

  return (
    <div
      className={`border border-[rgba(58,58,56,0.2)] bg-paper p-5 transition-all duration-200 ${
        comingSoon
          ? "opacity-50 cursor-not-allowed"
          : "hover:border-forest/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div
            className="w-11 h-11 flex items-center justify-center text-white"
            style={{ backgroundColor: comingSoon ? "#3A3A38" : config.color }}
          >
            {config.icon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-header text-sm font-bold text-forest">
                {config.name}
              </h3>
              {comingSoon && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-[rgba(58,58,56,0.15)] bg-grid/5 font-mono text-[9px] uppercase tracking-wider text-grid/50">
                  <Lock className="w-2.5 h-2.5" />
                  Coming Soon
                </span>
              )}
            </div>
            <p className="font-mono text-[10px] text-grid/50 mt-0.5 max-w-[280px]">
              {config.description}
            </p>
            {!comingSoon && (
              <div className="mt-1.5">
                <Badge status={statusInfo.badge}>{statusInfo.label}</Badge>
              </div>
            )}
          </div>
        </div>

        {!comingSoon && (
          <div className="flex-shrink-0 ml-4">
            {status === "connected" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisconnect}
                disabled={loading}
                className="text-coral hover:text-coral"
              >
                {loading ? "..." : "Disconnect"}
              </Button>
            ) : (
              <Button
                variant="solid"
                size="sm"
                onClick={onConnect}
                disabled={loading}
              >
                {loading ? "..." : status === "setup_required" ? "Continue Setup" : "Connect"}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
