"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Deterministic widths (no Math.random)
const CARD_WIDTHS = [75, 85, 68, 90, 72, 82, 78, 88];

interface CardSkeletonProps {
  className?: string;
  lines?: number;
  showLabel?: boolean;
  showAccent?: boolean;
}

export function CardSkeleton({
  className,
  lines = 3,
  showLabel = true,
  showAccent = true,
}: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "bg-paper p-8 relative border border-[rgba(58,58,56,0.2)]",
        className
      )}
    >
      {/* Label */}
      {showLabel && (
        <div className="flex items-center gap-2 mb-4">
          {showAccent && <Skeleton className="w-0.5 h-4" />}
          <Skeleton className="h-2.5 w-24" />
        </div>
      )}

      {/* Header line */}
      <Skeleton className="h-5 w-3/4 mb-4" />

      {/* Content lines */}
      <div className="space-y-3 mt-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <Skeleton
              className="h-3"
              style={{ width: `${CARD_WIDTHS[i % CARD_WIDTHS.length]}%` }}
            />
            <Skeleton className="h-2.5 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Variant for the dashboard bento grid (no border, gap-px layout)
export function CardSkeletonBento({
  className,
  lines = 3,
  showLabel = true,
  showAccent = true,
}: CardSkeletonProps) {
  return (
    <div className={cn("bg-paper p-8 relative", className)}>
      {/* Label */}
      {showLabel && (
        <div className="flex items-center gap-2 mb-4">
          {showAccent && <Skeleton className="w-0.5 h-4" />}
          <Skeleton className="h-2.5 w-24" />
        </div>
      )}

      {/* Content lines */}
      <div className="space-y-3 mt-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-2.5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat card skeleton (for gateway status, token usage)
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-paper p-8 relative", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-0.5 h-4" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-8 w-24 mb-2" />
      <Skeleton className="h-2.5 w-32" />
    </div>
  );
}
