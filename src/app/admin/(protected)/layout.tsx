import { AdminNav } from "@/components/admin/AdminNav";
import { AdminCompanyProvider } from "@/components/admin/AdminCompanyProvider";
import { createClient } from "@/lib/supabase/server";
import { getCompanyContextDiagnostics } from "@/lib/auth/company-context";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const diagnostics = await getCompanyContextDiagnostics(supabase);

  if (!diagnostics.context) {
    console.error("[admin-layout] redirecting to no-access", {
      failureReason: diagnostics.failureReason,
      resolvedUserId: diagnostics.resolvedUserId,
      member: diagnostics.member,
    });
    redirect("/admin/no-access");
  }

  return (
    <AdminCompanyProvider context={diagnostics.context}>
      <div className="min-h-screen bg-slate-50">
        <AdminNav context={diagnostics.context} />
        <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
      </div>
    </AdminCompanyProvider>
  );
}
