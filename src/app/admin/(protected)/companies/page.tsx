import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { CompanyManager } from "@/components/admin/CompanyManager";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    redirect("/admin/no-access");
  }
  if (!context.isSuperAdmin) {
    redirect("/admin");
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">会社管理</h2>
        <p className="text-sm text-slate-600">
          全会社の作成・一覧管理（スーパー管理者専用）
        </p>
      </div>
      <CompanyManager />
    </div>
  );
}
