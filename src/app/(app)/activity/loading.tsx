import { Skeleton } from "@/components/ui/skeleton";

export default function ActivityLoading() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="h-8 w-32 bg-[#E5E5E3] animate-pulse rounded-[2px] mb-2" />
        <div className="h-3 w-28 bg-[#E5E5E3] animate-pulse rounded-[2px]" />
      </div>

      {/* Filters skeleton */}
      <div className="mb-6 space-y-4">
        {/* Search */}
        <div className="max-w-md">
          <Skeleton className="h-2.5 w-24 mb-2" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Filter buttons row */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1">
            <Skeleton className="h-2.5 w-10 mr-2" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16" />
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Skeleton className="h-2.5 w-12 mr-2" />
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-14" />
            ))}
          </div>
        </div>
      </div>

      {/* Activity list skeleton */}
      <div className="bg-paper p-8 relative">
        <div className="flex items-center gap-2 mb-4">
          <Skeleton className="w-0.5 h-4" />
          <Skeleton className="h-2.5 w-24" />
        </div>

        <div className="mt-2 divide-y divide-[rgba(58,58,56,0.1)]">
          {Array.from({ length: 10 }).map((_, i) => (
            <ActivityItemSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityItemSkeleton() {
  return (
    <div className="flex items-start gap-3 py-3">
      <Skeleton className="w-8 h-8 flex-shrink-0" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-2.5 w-1/2" />
      </div>
      <Skeleton className="h-2.5 w-16 flex-shrink-0" />
    </div>
  );
}
