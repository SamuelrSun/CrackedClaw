"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { InlineTaskCard } from "./inline-task-card";

interface ScanTriggerCardProps {
  provider: string;
  scope?: "quick" | "full";
  onComplete?: (results: string) => void;
  /** Called when no native adapter exists; parent should relay to agent */
  onAgentScanNeeded?: (message: string) => void;
}

export function ScanTriggerCard({ provider, scope = "full", onComplete, onAgentScanNeeded }: ScanTriggerCardProps) {
  const [status, setStatus] = useState<"running" | "complete" | "failed">("running");
  const [summary, setSummary] = useState<string>("");
  const [startTime] = useState(Date.now());
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;

    async function runScan() {
      try {
        // Set scan consent (triggering scan = giving consent)
        await fetch("/api/ingestion/consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, consent: true }),
        });

        const res = await fetch("/api/ingestion/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider, scope }),
        });

        if (cancelled) return;

        if (!res.ok) {
          setStatus("failed");
          setSummary("Scan failed — try reconnecting the integration.");
          toast.error(`${provider} scan failed`, "Try reconnecting the integration.");
          return;
        }

        const data = await res.json();

        // ── No native adapter: hand off to agent ───────────────────────────
        if (data.needsAgentScan) {
          if (cancelled) return;
          const caps = (data.capabilities as string[] | undefined)?.join(", ") || "unknown capabilities";
          setSummary(`Agent scanning ${provider} using browser...`);

          const agentMessage = `[System: No native scanner for ${provider}. Use your browser/exec tools to scan the user's ${provider} account. Capabilities: ${caps}. Be scoped — sample recent data only. After scanning, save key insights with [[REMEMBER: key=value]] tags and report findings to the user.]`;

          if (onAgentScanNeeded) {
            onAgentScanNeeded(agentMessage);
          } else if (onComplete) {
            onComplete(agentMessage);
          }
          setStatus("complete");
          return;
        }

        // ── Native scan completed ──────────────────────────────────────────
        const summaryText = data.summary || `Scanned ${provider} successfully.`;
        setSummary(summaryText);
        setStatus("complete");

        const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
        toast.success(`✓ ${providerLabel} scan complete`, summaryText);

        if (onComplete) {
          onComplete(summaryText);
        }
      } catch {
        if (!cancelled) {
          setStatus("failed");
          setSummary("Network error during scan.");
          toast.error(`${provider} scan failed`, "Network error during scan.");
        }
      }
    }

    runScan();
    return () => { cancelled = true; };
  }, [provider, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
  const runtimeStr = status !== "running"
    ? elapsedSeconds >= 60
      ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
      : `${elapsedSeconds}s`
    : undefined;

  return (
    <InlineTaskCard
      taskId={`scan-${provider}`}
      taskName={`${providerLabel} Scan`}
      status={status}
      statusText={status === "running" ? "Learning about you" : undefined}
      result={status === "complete" ? summary : undefined}
      error={status === "failed" ? summary : undefined}
      runtime={runtimeStr}
    />
  );
}
