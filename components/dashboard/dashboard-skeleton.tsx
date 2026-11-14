import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the dashboard layout so content doesn't jump when data arrives. */
export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard" className="space-y-10 lg:space-y-12">
      <div className="grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-6 lg:col-span-7 lg:pt-4">
          <Skeleton className="h-3 w-56" />
          <div className="space-y-3">
            <Skeleton className="h-12 w-4/5 sm:h-20" />
            <Skeleton className="h-12 w-3/5 sm:h-20" />
          </div>
          <Skeleton className="h-5 w-full max-w-md" />
          <div className="flex gap-3 pt-6">
            <Skeleton className="h-13 w-44 rounded-md" />
            <Skeleton className="hidden h-13 w-36 rounded-md sm:block" />
          </div>
        </div>
        <Skeleton className="h-[420px] rounded-lg lg:col-span-5" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[176px] rounded-lg" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-[300px] rounded-lg lg:col-span-8" />
        <Skeleton className="h-[300px] rounded-lg lg:col-span-4" />
      </div>
    </div>
  );
}
