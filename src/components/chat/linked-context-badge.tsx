"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface LinkedConversation {
  id: string;
  title: string;
  link_type: string;
  link_id: string;
}

interface LinkedContextBadgeProps {
  linkedConversations: LinkedConversation[];
  conversationId: string;
  onEdit?: () => void;
  onUnlink?: (targetId: string) => void;
  className?: string;
}

export function LinkedContextBadge({
  linkedConversations,
  conversationId,
  onEdit,
  onUnlink,
  className,
}: LinkedContextBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  if (!linkedConversations || linkedConversations.length === 0) return null;

  const names = linkedConversations.map((c) => c.title).join(", ");

  return (
    <div
      className={cn(
        "border-b border-white/[0.08] bg-white/[0.04] px-4 py-2",
        className
      )}
    >
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-left group"
        >
          <span className="text-xs">🔗</span>
          <span className="font-mono text-[10px] text-forest/70 uppercase tracking-wide">
            Using context from:
          </span>
          <span className="text-xs text-forest font-medium truncate max-w-[300px]">
            {names}
          </span>
          <span className="font-mono text-[9px] text-grid/30 group-hover:text-grid/50 transition-colors">
            {expanded ? "▲" : "▼"}
          </span>
        </button>
        <button
          onClick={onEdit}
          className="font-mono text-[10px] text-grid/40 hover:text-forest transition-colors uppercase tracking-wide ml-4 flex-shrink-0"
        >
          Edit
        </button>
      </div>

      {/* Expanded list */}
      {expanded && (
        <div className="mt-2 max-w-3xl mx-auto space-y-1">
          {linkedConversations.map((lc) => (
            <div
              key={lc.id}
              className="flex items-center justify-between px-2 py-1 bg-white/[0.06] border border-white/[0.08]"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-wide text-grid/40 bg-grid/10 px-1.5 py-0.5">
                  {lc.link_type}
                </span>
                <span className="text-xs text-forest">{lc.title}</span>
              </div>
              {onUnlink && (
                <button
                  onClick={() => onUnlink(lc.id)}
                  className="font-mono text-[9px] text-grid/40 hover:text-red-500 transition-colors uppercase tracking-wide"
                >
                  Unlink
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
