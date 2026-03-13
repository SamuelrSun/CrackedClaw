"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface MessageFeedbackProps {
  messageContent?: string;
  className?: string;
}

export function MessageFeedback({ messageContent, className }: MessageFeedbackProps) {
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!messageContent) return;
    try {
      await navigator.clipboard.writeText(messageContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-0.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity",
        className
      )}
    >
      <button
        type="button"
        title="Copy"
        onClick={handleCopy}
        className={cn(
          "w-6 h-6 flex items-center justify-center text-[11px] border border-transparent",
          "hover:border-[rgba(58,58,56,0.15)] hover:text-forest transition-colors rounded-none bg-transparent",
          copied ? "text-forest" : "text-grid/30"
        )}
      >
        {copied ? "✓" : "📋"}
      </button>
      <button
        type="button"
        title="Good response"
        onClick={() => setFeedback(feedback === "up" ? null : "up")}
        className={cn(
          "w-6 h-6 flex items-center justify-center text-[11px] border border-transparent",
          "hover:border-[rgba(58,58,56,0.15)] hover:text-forest transition-colors rounded-none bg-transparent",
          feedback === "up" ? "text-forest" : "text-grid/30"
        )}
      >
        👍
      </button>
      <button
        type="button"
        title="Bad response"
        onClick={() => setFeedback(feedback === "down" ? null : "down")}
        className={cn(
          "w-6 h-6 flex items-center justify-center text-[11px] border border-transparent",
          "hover:border-[rgba(58,58,56,0.15)] hover:text-forest transition-colors rounded-none bg-transparent",
          feedback === "down" ? "text-grid/70" : "text-grid/30"
        )}
      >
        👎
      </button>
    </div>
  );
}
