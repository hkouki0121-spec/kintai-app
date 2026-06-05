import { AccountLoginEmails } from "@/components/admin/AccountLoginEmails";
import { CompanyPayrollSettings } from "@/components/admin/CompanyPayrollSettings";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">アカウント情報</h2>
        <p className="text-sm text-slate-600">
          会社アカウントのログインメール（ID）と給与計算の設定を管理できます
        </p>
      </div>
      <CompanyPayrollSettings />
      <AccountLoginEmails />
    </div>
  );
}
