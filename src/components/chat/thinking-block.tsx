"use client";

import { useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  duration: number;
  thinkingText?: string;
  children?: ReactNode;
  defaultOpen?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return "less than a second";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export function ThinkingBlock({
  duration,
  thinkingText,
  children,
  defaultOpen = false,
}: ThinkingBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  const label =
    duration < 1
      ? "Worked for less than a second"
      : `Worked for ${formatDuration(duration)}`;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 font-mono text-[11px] text-grid/40",
          "hover:text-grid/60 transition-colors bg-transparent border-0 p-0 cursor-pointer"
        )}
      >
        <span>{label}</span>
        <span className="text-[10px]">{open ? "▼" : "▶"}</span>
      </button>

      {open && (thinkingText || children) && (
        <div className="mt-1.5 pl-3 border-l border-[rgba(58,58,56,0.15)]">
          {thinkingText && (
            <p className="font-mono text-[12px] text-grid/50 italic leading-relaxed whitespace-pre-wrap">
              {thinkingText}
            </p>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
      )}
    </div>
  );
}
