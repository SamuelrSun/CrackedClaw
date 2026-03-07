"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Deterministic widths (no Math.random)
const LIST_WIDTHS = [65, 80, 55, 72, 60, 85, 58, 75];
const CONVO_WIDTHS = [55, 70, 48, 65, 52, 68, 58, 72];
const MEMORY_WIDTHS = [75, 85, 68, 90, 72, 82];

interface ListSkeletonProps {
  className?: string;
  rows?: number;
  showIcon?: boolean;
  showSubtext?: boolean;
}

export function ListSkeleton({
  className,
  rows = 5,
  showIcon = true,
  showSubtext = true,
}: ListSkeletonProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 py-2 border-b border-[rgba(58,58,56,0.1)] last:border-0"
        >
          {showIcon && <Skeleton className="w-8 h-8 flex-shrink-0" rounded />}
          <div className="flex-1 space-y-1.5">
            <Skeleton
              className="h-3.5"
              style={{ width: `${LIST_WIDTHS[i % LIST_WIDTHS.length]}%` }}
            />
            {showSubtext && <Skeleton className="h-2.5 w-24" />}
          </div>
          <Skeleton className="h-2.5 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  );
}

// Conversation list item skeleton (for chat sidebar)
export function ConversationListSkeleton({
  className,
  rows = 5,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 border-b border-[rgba(58,58,56,0.1)]"
        >
          <div className="flex justify-between items-baseline mb-1.5">
            <Skeleton
              className="h-3.5"
              style={{ width: `${CONVO_WIDTHS[i % CONVO_WIDTHS.length]}%` }}
            />
            <Skeleton className="h-2 w-10" />
          </div>
          <Skeleton className="h-2.5 w-4/5" />
        </div>
      ))}
    </div>
  );
}

// Memory entry skeleton
export function MemoryEntrySkeleton({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-b border-[rgba(58,58,56,0.1)] pb-3 last:border-0"
        >
          <div className="flex items-center gap-2 mb-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3" style={{ width: "100%" }} />
            <Skeleton className="h-3" style={{ width: `${MEMORY_WIDTHS[i % MEMORY_WIDTHS.length]}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
