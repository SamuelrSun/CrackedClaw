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

/** Split thinking text into individual steps/lines for display */
function parseThinkingLines(text: string): string[] {
  // Split on newlines, filter out empty lines and clean up
  return text
    .split(/
/)
    .map(line => line.trim())
    .filter(line => line.length > 0);
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

  const lines = thinkingText ? parseThinkingLines(thinkingText) : [];

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-1 font-mono text-[11px] text-white/40",
          "hover:text-white/60 transition-colors bg-transparent border-0 p-0 cursor-pointer"
        )}
      >
        <span>{label}</span>
        <span className="text-[10px]">{open ? "▼" : "▶"}</span>
      </button>

      {open && (lines.length > 0 || children) && (
        <div className="mt-1.5 pl-3 border-l border-white/[0.1]">
          {lines.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {lines.map((line, i) => (
                <p
                  key={i}
                  className="font-mono text-[11px] text-white/35 leading-relaxed m-0"
                >
                  {line}
                </p>
              ))}
            </div>
          )}
          {children && <div className="mt-2">{children}</div>}
        </div>
      )}
    </div>
  );
}
