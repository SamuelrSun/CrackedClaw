"use client";

import { useEffect, useState } from "react";

interface ScanTriggerCardProps {
  provider: string;
  onComplete?: (results: string) => void;
}

export function ScanTriggerCard({ provider, onComplete }: ScanTriggerCardProps) {
  const [status, setStatus] = useState<"scanning" | "complete" | "error">("scanning");
  const [summary, setSummary] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function runScan() {
      try {
        const res = await fetch("/api/memory/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        if (cancelled) return;

        if (!res.ok) {
          setStatus("error");
          setSummary("Scan failed — try reconnecting the integration.");
          return;
        }

        const data = await res.json();
        setStatus("complete");

        const emailCount = data.emails?.length || data.emailCount || 0;
        const calendarCount = data.events?.length || data.calendarCount || 0;
        const summaryText = `Scanned ${emailCount} emails and ${calendarCount} calendar events.`;
        setSummary(summaryText);

        if (onComplete) {
          const details = data.summary || data.findings || summaryText;
          onComplete(typeof details === "string" ? details : JSON.stringify(details));
        }
      } catch {
        if (!cancelled) {
          setStatus("error");
          setSummary("Network error during scan.");
        }
      }
    }

    runScan();
    return () => { cancelled = true; };
  }, [provider, onComplete]);

  return (
    <div className="rounded-lg border border-forest/20 bg-forest/5 p-3 my-2">
      <div className="flex items-center gap-2">
        {status === "scanning" && (
          <>
            <div className="w-4 h-4 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
            <span className="text-sm text-forest">
              Scanning your {provider === "google" ? "Gmail & Calendar" : provider}...
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
