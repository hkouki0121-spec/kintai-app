import { CardGridSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

export default function PayrollLoading() {
  return (
    <div className="space-y-6">
      <div className="h-16 animate-pulse rounded-2xl bg-slate-200/80" />
      <CardGridSkeleton count={5} />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
