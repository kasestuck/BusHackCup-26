import { Skeleton } from "@/components/ui/skeleton";

export function PlanSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your plan" className="space-y-10 lg:space-y-12">
      <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-14 w-4/5 sm:h-16" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <Skeleton className="h-[84px] rounded-lg lg:col-span-5" />
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2 lg:gap-3">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-md sm:h-[132px]" />
        ))}
      </div>
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-3 lg:col-span-8">
          <Skeleton className="h-10 w-1/2" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[74px] rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[220px] rounded-lg lg:col-span-4" />
      </div>
    </div>
  );
}
