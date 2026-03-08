"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ChannelCard, type ChannelType } from "@/components/settings/channel-card";
import { ChannelConnectModal } from "@/components/settings/channel-connect-modal";
import { ArrowLeft, Radio } from "lucide-react";

interface ChannelStatus {
  enabled: boolean;
  connected: boolean;
}

interface ChannelsState {
  slack: ChannelStatus;
  discord: ChannelStatus;
  telegram: ChannelStatus;
  whatsapp: ChannelStatus;
}

const DEFAULT_CHANNELS: ChannelsState = {
  slack: { enabled: false, connected: false },
  discord: { enabled: false, connected: false },
  telegram: { enabled: false, connected: false },
  whatsapp: { enabled: false, connected: false },
};

export default function ChannelsSettingsClient() {
  const [channels, setChannels] = useState<ChannelsState>(DEFAULT_CHANNELS);
  const [loading, setLoading] = useState(true);
  const [connectingChannel, setConnectingChannel] = useState<ChannelType | null>(null);
  const [actionLoading, setActionLoading] = useState<ChannelType | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      const res = await fetch("/api/settings/channels");
      if (res.ok) {
        const data = await res.json();
        setChannels(data.channels || DEFAULT_CHANNELS);
      }
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(channel: ChannelType, token: string) {
    try {
      const res = await fetch("/api/settings/channels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, token, enabled: true }),
      });

      const data = await res.json();

      if (res.ok) {
        setChannels((prev) => ({
          ...prev,
          [channel]: { enabled: true, connected: true },
        }));
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }

  async function handleDisconnect(channel: ChannelType) {
    setActionLoading(channel);

    try {
      const res = await fetch(`/api/settings/channels?channel=${channel}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setChannels((prev) => ({
          ...prev,
          [channel]: { enabled: false, connected: false },
        }));
      }
    } catch (err) {
      console.error("Failed to disconnect:", err);
    } finally {
      setActionLoading(null);
    }
  }

  const channelTypes: ChannelType[] = ["slack", "discord", "telegram", "whatsapp"];

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
          Channels
        </h1>
        <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50 mt-1">
          Connect your messaging platforms
        </p>
      </div>

      <div className="max-w-2xl">
        <Card label="Connected Channels" accentColor="#9EFFBF" bordered>
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-6">
              <Radio className="w-4 h-4 text-mint" />
              <span className="font-mono text-[11px] text-grid/60">
                Connect channels to enable AI chat on each platform
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 bg-forest/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {channelTypes.map((channel) => (
                  <ChannelCard
                    key={channel}
                    channel={channel}
                    connected={channels[channel].connected}
                    onConnect={() => setConnectingChannel(channel)}
                    onDisconnect={() => handleDisconnect(channel)}
                    loading={actionLoading === channel}
                  />
                ))}
              </div>
            )}

            {/* Help text */}
            <div className="mt-6 pt-4 border-t border-[rgba(58,58,56,0.1)]">
              <p className="font-mono text-[10px] text-grid/50">
                Each channel requires a bot token from the respective platform.
                Click &quot;Connect&quot; for setup instructions specific to each service.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Connect Modal */}
      {connectingChannel && (
        <ChannelConnectModal
          isOpen={true}
          onClose={() => setConnectingChannel(null)}
          channel={connectingChannel}
          onConnect={(token) => handleConnect(connectingChannel, token)}
        />
      )}
    </div>
  );
}
