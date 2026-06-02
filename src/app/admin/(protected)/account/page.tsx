import { AccountLoginEmails } from "@/components/admin/AccountLoginEmails";

export default function AccountPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">アカウント情報</h2>
        <p className="text-sm text-slate-600">
          会社アカウントのログインメール（ID）を確認できます
        </p>
      </div>
      <AccountLoginEmails />
    </div>
  );
}
