import { CardGridSkeleton } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-2xl bg-slate-200/80" />
      <CardGridSkeleton count={3} />
    </div>
  );
}
