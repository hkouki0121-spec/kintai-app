import { AdminNav } from "@/components/admin/AdminNav";
import { AdminCompanyProvider } from "@/components/admin/AdminCompanyProvider";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContext } from "@/lib/auth/company-context";
import { redirect } from "next/navigation";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const context = await getCompanyContext(supabase);

  if (!context) {
    redirect("/admin/no-access");
  }

  return (
    <AdminCompanyProvider context={context}>
      <div className="min-h-screen bg-slate-50">
        <AdminNav context={context} />
        <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
      </div>
    </AdminCompanyProvider>
  );
}
