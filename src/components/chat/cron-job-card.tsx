"use client";

import { cn } from "@/lib/utils";
import { Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";

export interface CronJobCardData {
  name: string;
  schedule: string;
  description?: string;
  status: "created" | "updated" | "error";
  method?: "rest" | "chat" | "noop";
  jobId?: string;
  errorMessage?: string;
}

function parseCronHuman(schedule: string): string {
  const presets: Record<string, string> = {
    "* * * * *": "Every minute",
    "*/5 * * * *": "Every 5 minutes",
    "*/15 * * * *": "Every 15 minutes",
    "*/30 * * * *": "Every 30 minutes",
    "0 * * * *": "Every hour",
    "0 */6 * * *": "Every 6 hours",
    "0 0 * * *": "Daily at midnight",
    "0 9 * * *": "Daily at 9 AM",
    "0 9 * * 1": "Every Monday at 9 AM",
    "0 9 * * 1-5": "Weekdays at 9 AM",
  };
  return presets[schedule] || schedule;
}

interface CronJobCardProps {
  job: CronJobCardData;
  className?: string;
}

export function CronJobCard({ job, className }: CronJobCardProps) {
  const isSuccess = job.status !== "error";

  return (
    <div
      className={cn(
        "border rounded-none bg-white max-w-sm",
        isSuccess ? "border-white/[0.1]" : "border-coral/40",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 border-b",
          isSuccess
            ? "border-white/[0.08] bg-white/[0.04]"
            : "border-coral/20 bg-coral/[0.05]"
        )}
      >
        <Clock className={cn("w-3.5 h-3.5 flex-shrink-0", isSuccess ? "text-forest" : "text-coral")} />
        <span className="font-mono text-[10px] uppercase tracking-wide text-grid/60 flex-1">
          {job.status === "created" ? "Cron Job Created" : job.status === "updated" ? "Cron Job Updated" : "Cron Job Error"}
        </span>
        {isSuccess ? (
          <CheckCircle className="w-3.5 h-3.5 text-mint flex-shrink-0" />
        ) : (
          <AlertCircle className="w-3.5 h-3.5 text-coral flex-shrink-0" />
        )}
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Job name */}
        <div>
          <h4 className="font-header text-base font-bold text-forest leading-tight">{job.name}</h4>
          {job.description && (
            <p className="font-mono text-[10px] text-grid/50 mt-0.5">{job.description}</p>
          )}
        </div>

        {/* Schedule */}
        <div className="flex items-center gap-2">
          <div className="flex-shrink-0 bg-forest/5 border border-forest/10 px-2 py-1">
            <span className="font-mono text-[11px] text-forest">{job.schedule}</span>
          </div>
          <span className="font-mono text-[10px] text-grid/50">{parseCronHuman(job.schedule)}</span>
        </div>

        {/* Status row */}
        {isSuccess && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 bg-mint block" />
              <span className="font-mono text-[10px] text-forest uppercase tracking-wide">Active</span>
            </div>
            {job.method && job.method !== "noop" && (
              <div className="flex items-center gap-1 text-grid/40">
                <Zap className="w-3 h-3" />
                <span className="font-mono text-[9px] uppercase tracking-wide">
                  via {job.method}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {!isSuccess && job.errorMessage && (
          <p className="font-mono text-[10px] text-coral">{job.errorMessage}</p>
        )}

        {/* Job ID */}
        {job.jobId && (
          <p className="font-mono text-[9px] text-grid/30 truncate">ID: {job.jobId}</p>
        )}
      </div>
    </div>
  );
}
