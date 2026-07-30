"use client";

import { memo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAdminCompany } from "@/components/admin/AdminCompanyProvider";
import { useAdminNavigation } from "@/components/admin/AdminNavigationProvider";
import { clearAdminCache } from "@/lib/queries/invalidate";
import { prefetchAdminRoute } from "@/lib/queries/prefetch-route";
import { Button } from "@/components/ui/Button";
import { AdminRenderProfiler } from "@/lib/perf/render-profiler";

const baseLinks = [
  { href: "/admin/dashboard", label: "ダッシュボード" },
  { href: "/admin/stores", label: "店舗管理" },
  { href: "/admin/employees", label: "従業員" },
  { href: "/admin/attendance", label: "勤怠履歴" },
  { href: "/admin/payroll", label: "給与" },
  { href: "/admin/backups", label: "バックアップ" },
  { href: "/admin/account", label: "アカウント" },
] as const;

const NavLink = memo(function NavLink({
  href,
  label,
  active,
  onPrefetch,
  onNavigate,
  optimistic,
}: {
  href: string;
  label: string;
  active: boolean;
  onPrefetch: (href: string) => void;
  onNavigate: (href: string) => void;
  optimistic: boolean;
}) {
  if (optimistic) {
    return (
      <a
        href={href}
        onMouseDown={(e) => {
          e.preventDefault();
          onNavigate(href);
        }}
        onClick={(e) => e.preventDefault()}
        onMouseEnter={() => onPrefetch(href)}
        onTouchStart={(e) => {
          onPrefetch(href);
          e.preventDefault();
          onNavigate(href);
        }}
        className={`rounded-lg px-3 py-2 text-sm font-medium ${
          active ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        {label}
      </a>
    );
  }

  return (
    <Link
      href={href}
      prefetch
      onMouseEnter={() => onPrefetch(href)}
      onTouchStart={() => onPrefetch(href)}
      className={`rounded-lg px-3 py-2 text-sm font-medium ${
        active ? "bg-blue-100 text-blue-800" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
});

const AdminNavBrand = memo(function AdminNavBrand() {
  const { isSuperAdmin, companyName } = useAdminCompany();
  const roleLabel = isSuperAdmin
    ? "スーパー管理者"
    : companyName
      ? `${companyName}`
      : "会社管理者";

  return (
    <div>
      <p className="text-xs font-medium text-blue-600">{roleLabel}</p>
      <h1 className="text-lg font-bold">勤怠管理</h1>
    </div>
  );
});

const AdminNavLinks = memo(function AdminNavLinks({
  onPrefetch,
  onNavigate,
  isKeepAliveRoute,
}: {
  onPrefetch: (href: string) => void;
  onNavigate: (href: string) => void;
  isKeepAliveRoute: (href: string) => boolean;
}) {
  const { displayPath } = useAdminNavigation();
  const { isSuperAdmin } = useAdminCompany();
  const links = isSuperAdmin
    ? [...baseLinks, { href: "/admin/companies", label: "会社管理" } as const]
    : baseLinks;

  return (
    <nav className="flex flex-wrap gap-2">
      {links.map((link) => (
        <NavLink
          key={link.href}
          href={link.href}
          label={link.label}
          active={displayPath === link.href}
          onPrefetch={onPrefetch}
          onNavigate={onNavigate}
          optimistic={isKeepAliveRoute(link.href)}
        />
      ))}
    </nav>
  );
});

const AdminNavLogout = memo(function AdminNavLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const handleLogout = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearAdminCache(queryClient);
    router.push("/admin/login");
  }, [router, queryClient]);

  return (
    <Button variant="ghost" onClick={handleLogout} className="shrink-0 py-2 text-sm">
      ログアウト
    </Button>
  );
});

export const AdminNav = memo(function AdminNav() {
  const queryClient = useQueryClient();
  const { isSuperAdmin } = useAdminCompany();
  const { navigateTo, isKeepAliveRoute } = useAdminNavigation();
  const onPrefetch = useCallback(
    (href: string) => prefetchAdminRoute(queryClient, href, isSuperAdmin),
    [queryClient, isSuperAdmin]
  );

  return (
    <AdminRenderProfiler id="Header">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <AdminNavBrand />
          <AdminNavLinks
            onPrefetch={onPrefetch}
            onNavigate={navigateTo}
            isKeepAliveRoute={isKeepAliveRoute}
          />
          <AdminNavLogout />
        </div>
      </header>
    </AdminRenderProfiler>
  );
});
