"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TunnelGuide } from "@/components/settings/tunnel-guide";
import { cn } from "@/lib/utils";

type TabType = "ngrok" | "tailscale";

const ngrokSteps = [
  {
    title: "Install ngrok",
    description: "Install ngrok using Homebrew or download directly from their website.",
    code: "brew install ngrok",
    language: "bash",
    note: "Don't have Homebrew? Download ngrok directly from https://ngrok.com/download",
  },
  {
    title: "Create an ngrok account",
    description: "Sign up for a free ngrok account to get your auth token.",
    note: "Visit https://dashboard.ngrok.com/signup to create your free account.",
  },
  {
    title: "Authenticate ngrok",
    description: "Add your auth token to connect ngrok to your account. Find your token in the ngrok dashboard.",
    code: "ngrok config add-authtoken YOUR_AUTH_TOKEN",
    language: "bash",
  },
  {
    title: "Start the tunnel",
    description: "Run ngrok to create a secure tunnel to your local OpenClaw instance (default port 18789).",
    code: "ngrok http 18789",
    language: "bash",
    note: "Keep this terminal window open while using the tunnel.",
  },
  {
    title: "Copy the HTTPS URL",
    description: "ngrok will display a forwarding URL like https://abc123.ngrok.io. Copy this URL.",
    code: "Forwarding  https://abc123.ngrok-free.app -> http://localhost:18789",
    note: "The URL changes each time you restart ngrok unless you have a paid plan with reserved domains.",
  },
  {
    title: "Configure OpenClaw Cloud",
    description: "Go back to Settings and paste the ngrok URL as your Gateway URL. Use your OpenClaw auth token to authenticate.",
  },
];

const tailscaleSteps = [
  {
    title: "Install Tailscale",
    description: "Download and install Tailscale on your machine.",
    code: "brew install tailscale",
    language: "bash",
    note: "Or download from https://tailscale.com/download for your platform.",
  },
  {
    title: "Sign in to Tailscale",
    description: "Authenticate with your Tailscale account to join your tailnet.",
    code: "tailscale up",
    language: "bash",
  },
  {
    title: "Enable MagicDNS (optional)",
    description: "MagicDNS lets you use friendly names like 'macbook.tail1234.ts.net' instead of IP addresses.",
    note: "Enable this in your Tailscale admin console under DNS settings.",
  },
  {
    title: "Find your Tailscale hostname",
    description: "Get your machine's Tailscale hostname or IP address.",
    code: "tailscale status",
    language: "bash",
  },
  {
    title: "Configure OpenClaw Cloud",
    description: "Use your Tailscale hostname with port 18789 as your Gateway URL. Example: http://macbook.tail1234.ts.net:18789",
    note: "Tailscale connections are end-to-end encrypted, so HTTP is fine within your tailnet.",
  },
];

export default function TunnelSetupPage() {
  const [activeTab, setActiveTab] = useState<TabType>("ngrok");
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus("testing");
    
    // Simulate connection test - in real implementation, 
    // this would call the gateway test endpoint
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // For demo purposes, randomly succeed or fail
    setConnectionStatus(Math.random() > 0.5 ? "success" : "error");
    setTestingConnection(false);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Breadcrumbs 
        items={[
          { label: "Dashboard", href: "/" },
          { label: "Settings", href: "/settings" },
          { label: "Tunnel Setup" },
        ]} 
      />

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-header text-3xl font-bold tracking-tight leading-tight text-forest">
          Tunnel Setup Guide
        </h1>
        <p className="font-mono text-[11px] text-grid/60 mt-2 max-w-2xl">
          Expose your local OpenClaw instance to the internet so the cloud dashboard can connect to it. 
          Choose your preferred tunneling method below.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("ngrok")}
          className={cn(
            "px-4 py-2 font-mono text-[11px] uppercase tracking-wide border rounded-none transition-all",
            activeTab === "ngrok"
              ? "bg-forest text-white border-forest"
              : "bg-paper text-forest border-forest/30 hover:border-forest"
          )}
        >
          ngrok
        </button>
        <button
          onClick={() => setActiveTab("tailscale")}
          className={cn(
            "px-4 py-2 font-mono text-[11px] uppercase tracking-wide border rounded-none transition-all",
            activeTab === "tailscale"
              ? "bg-forest text-white border-forest"
              : "bg-paper text-forest border-forest/30 hover:border-forest"
          )}
        >
          Tailscale
        </button>
      </div>

      {/* Guide Content */}
      <Card 
        label={activeTab === "ngrok" ? "ngrok Setup" : "Tailscale Setup"} 
        accentColor="#9EFFBF"
      >
        {activeTab === "ngrok" && (
          <div className="mt-4">
            <div className="mb-6 p-4 bg-mint/10 border border-mint/30">
              <p className="font-mono text-[11px] text-forest">
                <strong>ngrok</strong> creates a secure tunnel from the internet to your local machine. 
                It&apos;s the fastest way to get started — just one command and you&apos;re live.
              </p>
            </div>
            <TunnelGuide 
              steps={ngrokSteps}
              onTestConnection={handleTestConnection}
              testingConnection={testingConnection}
              connectionStatus={connectionStatus}
            />
          </div>
        )}

        {activeTab === "tailscale" && (
          <div className="mt-4">
            <div className="mb-6 p-4 bg-mint/10 border border-mint/30">
              <p className="font-mono text-[11px] text-forest">
                <strong>Tailscale</strong> creates a secure mesh VPN between your devices. 
                It&apos;s more reliable for long-term use and doesn&apos;t require keeping a terminal open.
              </p>
            </div>
            <TunnelGuide 
              steps={tailscaleSteps}
              onTestConnection={handleTestConnection}
              testingConnection={testingConnection}
              connectionStatus={connectionStatus}
            />
          </div>
        )}
      </Card>

      {/* Additional Help */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card label="Need Help?" accentColor="#F4D35E">
          <div className="mt-2">
            <p className="font-mono text-[11px] text-grid/70 mb-3">
              Having trouble? Check our documentation or reach out for support.
            </p>
            <div className="flex gap-2">
              <a 
                href="https://docs.openclaw.io/tunnels" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center font-mono text-[10px] uppercase tracking-wide transition-colors border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-1.5 bg-transparent text-forest hover:bg-forest hover:text-white"
              >
                View Docs
              </a>
              <a 
                href="https://discord.gg/openclaw" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center font-mono text-[10px] uppercase tracking-wide transition-colors border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-1.5 bg-transparent text-forest hover:bg-forest hover:text-white"
              >
                Discord
              </a>
            </div>
          </div>
        </Card>

        <Card label="Other Options" accentColor="#FF8C69">
          <div className="mt-2">
            <p className="font-mono text-[11px] text-grid/70 mb-3">
              You can also use Cloudflare Tunnel, localtunnel, or any reverse proxy that supports HTTPS.
            </p>
            <a 
              href="https://docs.openclaw.io/advanced-tunnels" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center font-mono text-[10px] uppercase tracking-wide transition-colors border border-[rgba(58,58,56,0.2)] rounded-none px-3 py-1.5 bg-transparent text-forest hover:bg-forest hover:text-white"
            >
              Advanced Setup
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
