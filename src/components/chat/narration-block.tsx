"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NarrationBlockProps {
  segments: string[];
  defaultOpen?: boolean;
}

export function NarrationBlock({ segments, defaultOpen = false }: NarrationBlockProps) {
  const [open, setOpen] = useState(defaultOpen);
  const fullText = segments.filter(Boolean).join("\n\n");
  if (!fullText.trim()) return null;

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          "flex items-center gap-1.5 font-mono text-[11px] text-white/35",
          "hover:text-white/55 transition-colors bg-transparent border-0 p-0 cursor-pointer"
        )}
      >
        <span>Show Thinking</span>
        <span className="text-[10px] transition-transform" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {open && (
        <div className="mt-1.5 pl-3 border-l border-white/[0.08] max-h-[300px] overflow-y-auto">
          <p className="font-mono text-[12px] text-white/40 italic leading-relaxed whitespace-pre-wrap">
            {fullText}
          </p>
        </div>
      )}
    </div>
  );
}
