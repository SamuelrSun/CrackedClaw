import { StatCardSkeleton, CardSkeletonBento } from "@/components/skeletons/card-skeleton";

export default function DashboardLoading() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="h-8 w-56 bg-[#E5E5E3] animate-pulse rounded-[2px] mb-2" />
        <div className="h-3 w-40 bg-[#E5E5E3] animate-pulse rounded-[2px]" />
      </div>

      {/* Bento Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[rgba(58,58,56,0.2)]">
        {/* Gateway Status */}
        <StatCardSkeleton />
        
        {/* Token Usage */}
        <StatCardSkeleton />
        
        {/* Active Workflows */}
        <CardSkeletonBento className="md:col-span-2" lines={4} />
        
        {/* Recent Activity */}
        <CardSkeletonBento className="md:col-span-2" lines={5} />
      </div>
    </div>
  );
}
