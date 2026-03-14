import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface IntegrationSkeletonProps {
  className?: string;
}

export function IntegrationCardSkeleton({ className }: IntegrationSkeletonProps) {
  return (
    <div className={cn("bg-paper p-8 relative", className)}>
      {/* Label (emoji) */}
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="w-0.5 h-4" />
        <Skeleton className="h-5 w-5" />
      </div>

      {/* Header with badge */}
      <div className="flex items-center justify-between mt-2">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>

      {/* Connected Accounts section */}
      <div className="mt-4">
        <Skeleton className="h-2.5 w-32 mb-3" />
        
        {/* Account item */}
        <div className="py-1.5 px-2 border border-white/[0.08] bg-white/[0.03] mb-2">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Skeleton className="h-3 w-36" />
              <Skeleton className="h-2 w-24" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        </div>

        {/* Add Account button */}
        <Skeleton className="h-9 w-full mt-3" />
      </div>

      {/* Last sync */}
      <Skeleton className="h-2.5 w-28 mt-4" />
    </div>
  );
}

export function IntegrationGridSkeleton({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05]",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <IntegrationCardSkeleton key={i} />
      ))}
    </div>
  );
}
