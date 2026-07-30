"use client";

import { useSyncExternalStore } from "react";
import { wasRouteVisited } from "@/components/admin/AdminRouteVisitTracker";
import { CardGridSkeleton, TableSkeleton } from "@/components/ui/Skeleton";

type Variant = "dashboard" | "table" | "payroll";

type Props = {
  pathname: string;
  variant: Variant;
};

function subscribe() {
  return () => {};
}

/** 初回訪問時のみ Skeleton を表示（再訪問は Router Cache を優先し何も出さない） */
export function AdminPageSkeleton({ pathname, variant }: Props) {
  const visited = useSyncExternalStore(
    subscribe,
    () => wasRouteVisited(pathname),
    () => false
  );

  if (visited) {
    return null;
  }

  if (variant === "dashboard") {
    return (
      <div className="space-y-6" data-admin-loading-skeleton>
        <div className="h-14 animate-pulse rounded-2xl bg-slate-200/80" />
        <CardGridSkeleton count={3} />
      </div>
    );
  }

  if (variant === "payroll") {
    return (
      <div className="space-y-6" data-admin-loading-skeleton>
        <div className="h-14 animate-pulse rounded-2xl bg-slate-200/80" />
        <TableSkeleton rows={6} cols={4} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-admin-loading-skeleton>
      <div className="h-14 animate-pulse rounded-2xl bg-slate-200/80" />
      <TableSkeleton rows={8} cols={5} />
    </div>
  );
}
