import { Skeleton } from "@/components/ui/skeleton";
import { IntegrationGridSkeleton } from "@/components/skeletons/integration-skeleton";

export default function IntegrationsLoading() {
  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="h-8 w-40 bg-[#E5E5E3] animate-pulse rounded-[2px] mb-2" />
          <div className="h-3 w-48 bg-[#E5E5E3] animate-pulse rounded-[2px]" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <IntegrationGridSkeleton count={6} />
    </div>
  );
}
