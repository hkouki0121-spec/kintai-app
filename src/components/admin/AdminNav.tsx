"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { CompanyContext } from "@/lib/auth/company-context";
import { Button } from "@/components/ui/Button";

const baseLinks = [
  { href: "/admin/dashboard", label: "ダッシュボード" },
  { href: "/admin/stores", label: "店舗管理" },
  { href: "/admin/employees", label: "従業員" },
  { href: "/admin/attendance", label: "勤怠履歴" },
  { href: "/admin/payroll", label: "給与" },
  { href: "/admin/backups", label: "バックアップ" },
  { href: "/admin/account", label: "アカウント" },
];

type Props = {
  context: CompanyContext;
};

export function AdminNav({ context }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const links = context.isSuperAdmin
    ? [...baseLinks, { href: "/admin/companies", label: "会社管理" }]
    : baseLinks;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/admin/login");
    router.refresh();
  };

  const roleLabel = context.isSuperAdmin
    ? "スーパー管理者"
    : context.companyName
      ? `${context.companyName}`
      : "会社管理者";

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium text-blue-600">{roleLabel}</p>
          <h1 className="text-lg font-bold">勤怠管理</h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                pathname === link.href
                  ? "bg-blue-100 text-blue-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Button variant="ghost" onClick={handleLogout} className="shrink-0 py-2 text-sm">
          ログアウト
        </Button>
      </div>
    </header>
  );
}
