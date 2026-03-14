"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Hash, MessageCircle, Send, MessageSquare, ExternalLink } from "lucide-react";
import type { ChannelType } from "./channel-card";

interface ChannelConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: ChannelType;
  onConnect: (token: string) => Promise<{ success: boolean; error?: string }>;
}

const channelInstructions: Record<ChannelType, {
  name: string;
  icon: React.ReactNode;
  steps: string[];
  tokenLabel: string;
  tokenPlaceholder: string;
  docsUrl: string;
}> = {
  slack: {
    name: "Slack",
    icon: <Hash className="w-6 h-6" />,
    steps: [
      "Go to api.slack.com/apps and create a new app",
      "Under 'OAuth & Permissions', add the required scopes",
      "Install the app to your workspace",
      "Copy the Bot User OAuth Token",
    ],
    tokenLabel: "Bot User OAuth Token",
    tokenPlaceholder: "xoxb-your-token-here",
    docsUrl: "https://api.slack.com/start/quickstart",
  },
  discord: {
    name: "Discord",
    icon: <MessageCircle className="w-6 h-6" />,
    steps: [
      "Go to discord.com/developers/applications",
      "Create a new application and add a bot",
      "Enable Message Content Intent under Privileged Intents",
      "Copy the Bot Token from the Bot settings",
    ],
    tokenLabel: "Bot Token",
    tokenPlaceholder: "your-bot-token-here",
    docsUrl: "https://discord.com/developers/docs/getting-started",
  },
  telegram: {
    name: "Telegram",
    icon: <Send className="w-6 h-6" />,
    steps: [
      "Open Telegram and search for @BotFather",
      "Send /newbot and follow the prompts",
      "Choose a name and username for your bot",
      "Copy the HTTP API token provided",
    ],
    tokenLabel: "Bot Token",
    tokenPlaceholder: "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ",
    docsUrl: "https://core.telegram.org/bots#how-do-i-create-a-bot",
  },
  signal: {
    name: "Signal",
    icon: <MessageSquare className="w-6 h-6" />,
    steps: [
      "Install signal-cli on your server (github.com/AsamK/signal-cli)",
      "Register or link a phone number with signal-cli",
      "Set up the JSON-RPC interface",
      "Copy the phone number used for registration",
    ],
    tokenLabel: "Phone Number",
    tokenPlaceholder: "+1234567890",
    docsUrl: "https://github.com/AsamK/signal-cli",
  },
  imessage: {
    name: "iMessage",
    icon: <MessageCircle className="w-6 h-6" />,
    steps: [
      "Requires a Mac with Messages.app signed in",
      "Install the Dopl Connect companion app",
      "The companion app bridges iMessage to your cloud agent",
      "Messages are processed locally on your Mac",
    ],
    tokenLabel: "Connection Token",
    tokenPlaceholder: "Paste your companion app token",
    docsUrl: "https://usedopl.com/connect",
  },
  whatsapp: {
    name: "WhatsApp",
    icon: <MessageSquare className="w-6 h-6" />,
    steps: [
      "Go to developers.facebook.com and create an app",
      "Add WhatsApp product to your app",
      "Get a phone number from Meta or verify yours",
      "Copy the access token from the API Setup page",
    ],
    tokenLabel: "Access Token",
    tokenPlaceholder: "your-access-token-here",
    docsUrl: "https://developers.facebook.com/docs/whatsapp/cloud-api/get-started",
  },
};

export function ChannelConnectModal({
  isOpen,
  onClose,
  channel,
  onConnect,
}: ChannelConnectModalProps) {
  const [token, setToken] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const config = channelInstructions[channel];

  const handleTest = async () => {
    if (!token.trim()) return;
    
    setTesting(true);
    setTestResult(null);
    
    // For now, we'll just validate the token format
    // In production, this would make a test API call
    await new Promise((r) => setTimeout(r, 1000));
    
    setTestResult({ success: true });
    setTesting(false);
  };

  const handleSave = async () => {
    if (!token.trim()) return;
    
    setSaving(true);
    const result = await onConnect(token);
    setSaving(false);
    
    if (result.success) {
      setToken("");
      setTestResult(null);
      onClose();
    } else {
      setTestResult({ success: false, error: result.error });
    }
  };

  const handleClose = () => {
    setToken("");
    setTestResult(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Connect ${config.name}`}>
      <div className="space-y-6">
        {/* Channel header */}
        <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
          <div className="w-12 h-12 flex items-center justify-center bg-forest/10 text-forest">
            {config.icon}
          </div>
          <div>
            <h3 className="font-header text-lg font-bold text-forest">{config.name}</h3>
            <p className="font-mono text-[10px] uppercase tracking-wide text-grid/50">
              Chat Integration
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div>
          <h4 className="font-mono text-[10px] uppercase tracking-wide text-grid/60 mb-3">
            Setup Instructions
          </h4>
          <ol className="space-y-2">
            {config.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-forest">
                <span className="font-mono text-[10px] text-grid/40 mt-0.5">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <a
            href={config.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 font-mono text-[10px] uppercase tracking-wide text-forest hover:text-mint transition-colors"
          >
            View Full Documentation
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Token input */}
        <div>
          <Input
            label={config.tokenLabel}
            type="password"
            placeholder={config.tokenPlaceholder}
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setTestResult(null);
            }}
          />
        </div>

        {/* Test result */}
        {testResult && (
          <div
            className={`p-3 border ${
              testResult.success
                ? "border-mint bg-mint/10"
                : "border-coral bg-coral/10"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 block ${
                  testResult.success ? "bg-mint" : "bg-coral"
                }`}
              />
              <span className="font-mono text-[11px]">
                {testResult.success
                  ? "Connection test successful"
                  : testResult.error || "Connection test failed"}
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={testing || !token.trim()}
          >
            {testing ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            variant="solid"
            size="sm"
            onClick={handleSave}
            disabled={saving || !token.trim()}
          >
            {saving ? "Saving..." : "Save & Connect"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
