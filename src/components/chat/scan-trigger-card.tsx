"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface ScanTriggerCardProps {
  provider: string;
  scope?: "quick" | "full";
  onComplete?: (results: string) => void;
  /** Called when no native adapter exists; parent should relay to agent */
  onAgentScanNeeded?: (message: string) => void;
}

export function ScanTriggerCard({ provider, scope = "full", onComplete, onAgentScanNeeded }: ScanTriggerCardProps) {
  const [status, setStatus] = useState<"scanning" | "agent" | "complete" | "error">("scanning");
  const [summary, setSummary] = useState<string>("");
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;

    async function runScan() {
      try {
        const res = await fetch("/api/ingestion/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, scope }),
        });

        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setSummary("Scan failed — try reconnecting the integration.");
          toast.error(`${provider} scan failed`, "Try reconnecting the integration.");
          return;
        }

        const data = await res.json();

        // ── No native adapter: hand off to agent ───────────────────────────
        if (data.needsAgentScan) {
          if (cancelled) return;
          setStatus("agent");
          const caps = (data.capabilities as string[] | undefined)?.join(", ") || "unknown capabilities";
          setSummary(`Agent is scanning ${provider} using browser...`);

          const agentMessage = `[System: No native scanner for ${provider}. Use your browser/exec tools to scan the user's ${provider} account. Capabilities: ${caps}. Be scoped — sample recent data only. After scanning, save key insights with [[REMEMBER: key=value]] tags and report findings to the user.]`;

          if (onAgentScanNeeded) {
            onAgentScanNeeded(agentMessage);
          } else if (onComplete) {
            onComplete(agentMessage);
          }
          return;
        }

        // ── Native scan completed ──────────────────────────────────────────
        setStatus("complete");
        const summaryText = data.summary || `Scanned ${provider} successfully.`;
        setSummary(summaryText);

        // Show toast notification
        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
        toast.success(`✓ ${providerLabel} scan complete`, summaryText);

        // Auto-inject summary message into chat
        if (onComplete) {
          onComplete(summaryText);
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setSummary("Network error during scan.");
          toast.error(`${provider} scan failed`, "Network error during scan.");
        }
      }
    }

    runScan();
    return () => { cancelled = true; };
  }, [provider, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <div className="rounded-lg border border-forest/20 bg-forest/5 p-3 my-2">
      <div className="flex items-center gap-2">
        {(status === "scanning" || status === "agent") && (
          <>
            <div className="w-4 h-4 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
            <span className="text-sm text-forest">
              {status === "agent"
                ? `Agent is scanning ${providerLabel} using browser...`
                : `Learning about you via ${providerLabel}...`}
            </span>
          </>
        )}
        {status === "complete" && (
          <>
            <span className="text-green-600">✓</span>
            <span className="text-sm text-forest">{summary}</span>
          </>
        )}
        {status === "error" && (
          <>
            <span className="text-red-500">✕</span>
            <span className="text-sm text-red-600">{summary}</span>
          </>
        )}
      </div>
    </div>
  );
}
