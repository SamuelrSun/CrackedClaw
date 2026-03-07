import { Skeleton } from "@/components/ui/skeleton";
import { MemoryEntrySkeleton } from "@/components/skeletons/list-skeleton";
import { CardSkeleton } from "@/components/skeletons/card-skeleton";

export default function MemoryLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-8 w-28 bg-[#E5E5E3] animate-pulse rounded-[2px]" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="h-3 w-40 bg-[#E5E5E3] animate-pulse rounded-[2px] mt-2" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Search */}
      <div className="mb-6 max-w-md">
        <Skeleton className="h-2.5 w-24 mb-2" />
        <Skeleton className="h-10 w-full" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[rgba(58,58,56,0.2)]">
        {/* Memory Entries */}
        <div className="col-span-1 bg-paper p-8">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-0.5 h-4" />
            <Skeleton className="h-2.5 w-20" />
          </div>
          <MemoryEntrySkeleton rows={5} />
        </div>

        {/* Instructions */}
        <div className="col-span-1 bg-paper p-8">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="w-0.5 h-4" />
            <Skeleton className="h-2.5 w-24" />
          </div>
          <div className="mt-2 space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <div className="border border-[rgba(58,58,56,0.2)] bg-white p-4 mt-3">
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <Skeleton className="h-8 w-32 mt-3" />
          </div>
        </div>
      </div>
    </div>
  );
}
