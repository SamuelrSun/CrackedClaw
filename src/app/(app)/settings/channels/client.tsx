"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  ChannelCard,
  type ChannelType,
  type ChannelStatusType,
} from "@/components/settings/channel-card";
import { ChannelConnectModal } from "@/components/settings/channel-connect-modal";
import { WhatsAppSetupModal } from "@/components/settings/channel-whatsapp-modal";
import { IMessageSetupModal } from "@/components/settings/channel-imessage-modal";
import { ArrowLeft, Radio } from "lucide-react";

interface ChannelStatus {
  enabled: boolean;
  connected: boolean;
}

interface ChannelsState {
  whatsapp: ChannelStatus;
  imessage: ChannelStatus;
  discord: ChannelStatus;
  telegram: ChannelStatus;
  signal: ChannelStatus;
  slack: ChannelStatus;
}

const DEFAULT_CHANNELS: ChannelsState = {
  whatsapp: { enabled: false, connected: false },
  imessage: { enabled: false, connected: false },
  discord: { enabled: false, connected: false },
  telegram: { enabled: false, connected: false },
  signal: { enabled: false, connected: false },
  slack: { enabled: false, connected: false },
};

const COMING_SOON: ChannelType[] = ["discord", "telegram", "signal", "slack"];

type ModalType =
  | { kind: "whatsapp" }
  | { kind: "imessage" }
  | { kind: "legacy"; channel: ChannelType }
  | null;

function getChannelStatus(ch: ChannelStatus): ChannelStatusType {
  if (ch.connected) return "connected";
  if (ch.enabled) return "setup_required";
  return "disconnected";
}

export default function ChannelsSettingsClient() {
  const [channels, setChannels] = useState<ChannelsState>(DEFAULT_CHANNELS);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [actionLoading, setActionLoading] = useState<ChannelType | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  async function fetchChannels() {
    try {
      const res = await fetch("/api/settings/channels/status");
      if (res.ok) {
        const data = await res.json();
        setChannels({ ...DEFAULT_CHANNELS, ...(data.channels || {}) });
      }
    } catch (err) {
      console.error("Failed to fetch channels:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleConnect(channel: ChannelType) {
    if (channel === "whatsapp") {
      setModal({ kind: "whatsapp" });
    } else if (channel === "imessage") {
      setModal({ kind: "imessage" });
    } else {
      setModal({ kind: "legacy", channel });
    }
  }

  async function handleLegacyConnect(token: string) {
    if (!modal || modal.kind !== "legacy") return { success: false, error: "No channel selected" };
    const channel = modal.channel;

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

  function handleSetupComplete(channel: ChannelType) {
    setChannels((prev) => ({
      ...prev,
      [channel]: { enabled: true, connected: true },
    }));
  }

  const primaryChannels: ChannelType[] = ["whatsapp", "imessage"];
  const otherChannels: ChannelType[] = ["discord", "telegram", "signal", "slack"];

  const connectedCount = Object.values(channels).filter((c) => c.connected).length;

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
          Connect your messaging platforms to CrackedClaw
        </p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Primary Channels */}
        <Card label="Messaging Channels" accentColor="#9EFFBF" bordered>
          <div className="mt-2">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-mint" />
                <span className="font-mono text-[11px] text-grid/60">
                  Route AI conversations through your messaging apps
                </span>
              </div>
              {connectedCount > 0 && (
                <span className="font-mono text-[10px] text-mint">
                  {connectedCount} active
                </span>
              )}
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-24 bg-forest/5 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {primaryChannels.map((channel) => (
                  <ChannelCard
                    key={channel}
                    channel={channel}
                    status={getChannelStatus(channels[channel])}
                    onConnect={() => handleConnect(channel)}
                    onDisconnect={() => handleDisconnect(channel)}
                    loading={actionLoading === channel}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Other Channels */}
        <Card label="More Channels" accentColor="#F4D35E" bordered>
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-6">
              <span className="font-mono text-[11px] text-grid/60">
                Additional integrations — coming in future updates
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
                {otherChannels.map((channel) => (
                  <ChannelCard
                    key={channel}
                    channel={channel}
                    status="disconnected"
                    onConnect={() => {}}
                    onDisconnect={() => {}}
                    comingSoon={COMING_SOON.includes(channel)}
                  />
                ))}
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-[rgba(58,58,56,0.1)]">
              <p className="font-mono text-[10px] text-grid/50">
                Want a channel we don&apos;t support yet? Let us know — we
                prioritize based on demand.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* WhatsApp Setup Modal */}
      {modal?.kind === "whatsapp" && (
        <WhatsAppSetupModal
          isOpen={true}
          onClose={() => setModal(null)}
          onComplete={() => handleSetupComplete("whatsapp")}
        />
      )}

      {/* iMessage Setup Modal */}
      {modal?.kind === "imessage" && (
        <IMessageSetupModal
          isOpen={true}
          onClose={() => setModal(null)}
          onComplete={() => handleSetupComplete("imessage")}
        />
      )}

      {/* Legacy Token Modal (for future channels) */}
      {modal?.kind === "legacy" && (
        <ChannelConnectModal
          isOpen={true}
          onClose={() => setModal(null)}
          channel={modal.channel as "slack" | "discord" | "telegram" | "whatsapp"}
          onConnect={(token) => handleLegacyConnect(token)}
        />
      )}
    </div>
  );
}
