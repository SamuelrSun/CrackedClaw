"use client";

import { cn } from "@/lib/utils";
import { Check, AlertCircle } from "lucide-react";

interface IntegrationStatusCardProps {
  provider: string;
  status: "connected" | "error";
  accountName?: string;
}

export function IntegrationStatusCard({
  provider,
  status,
  accountName,
}: IntegrationStatusCardProps) {
  return (
    <div
      className={cn(
        "border rounded-none p-3 max-w-sm flex items-center gap-3",
        status === "connected"
          ? "border-[#9EFFBF] bg-[#9EFFBF]/10"
          : "border-[#FF6B6B] bg-[#FF6B6B]/10"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 flex items-center justify-center rounded-none",
          status === "connected" ? "bg-[#9EFFBF]/30" : "bg-[#FF6B6B]/30"
        )}
      >
        {status === "connected" ? (
          <Check className="w-4 h-4 text-forest" />
        ) : (
          <AlertCircle className="w-4 h-4 text-[#FF6B6B]" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60">
            {provider}
          </span>
          <span
            className={cn(
              "font-mono text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded-none",
              status === "connected"
                ? "bg-[#9EFFBF]/30 text-forest"
                : "bg-[#FF6B6B]/30 text-[#FF6B6B]"
            )}
          >
            {status}
          </span>
        </div>
        {accountName && (
          <p className="text-xs text-forest mt-0.5 truncate">{accountName}</p>
        )}
        {status === "error" && (
          <p className="text-xs text-[#FF6B6B] mt-0.5">
            Connection failed. Try again.
          </p>
        )}
      </div>
    </div>
  );
}
