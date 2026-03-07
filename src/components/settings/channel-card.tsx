"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquare, Hash, Send, MessageCircle } from "lucide-react";

export type ChannelType = "slack" | "discord" | "telegram" | "whatsapp";

interface ChannelCardProps {
  channel: ChannelType;
  connected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  loading?: boolean;
}

const channelConfig: Record<ChannelType, { name: string; icon: React.ReactNode; color: string }> = {
  slack: {
    name: "Slack",
    icon: <Hash className="w-5 h-5" />,
    color: "#4A154B",
  },
  discord: {
    name: "Discord",
    icon: <MessageCircle className="w-5 h-5" />,
    color: "#5865F2",
  },
  telegram: {
    name: "Telegram",
    icon: <Send className="w-5 h-5" />,
    color: "#0088CC",
  },
  whatsapp: {
    name: "WhatsApp",
    icon: <MessageSquare className="w-5 h-5" />,
    color: "#25D366",
  },
};

export function ChannelCard({
  channel,
  connected,
  onConnect,
  onDisconnect,
  loading = false,
}: ChannelCardProps) {
  const config = channelConfig[channel];

  return (
    <div className="border border-[rgba(58,58,56,0.2)] bg-paper p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 flex items-center justify-center text-white"
          style={{ backgroundColor: config.color }}
        >
          {config.icon}
        </div>
        <div>
          <h3 className="font-header text-sm font-bold text-forest">{config.name}</h3>
          <Badge status={connected ? "active" : "inactive"}>
            {connected ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </div>

      <div>
        {connected ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDisconnect}
            disabled={loading}
            className="text-coral hover:text-coral"
          >
            {loading ? "Disconnecting..." : "Disconnect"}
          </Button>
        ) : (
          <Button
            variant="solid"
            size="sm"
            onClick={onConnect}
            disabled={loading}
          >
            {loading ? "Connecting..." : "Connect"}
          </Button>
        )}
      </div>
    </div>
  );
}
