import { TableSkeleton } from "@/components/ui/Skeleton";

export default function EmployeesLoading() {
  return (
    <div className="space-y-6">
      <div className="h-14 animate-pulse rounded-2xl bg-slate-200/80" />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
