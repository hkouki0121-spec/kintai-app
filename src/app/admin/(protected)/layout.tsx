import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="mx-auto max-w-6xl p-4 sm:p-6">{children}</div>
    </div>
  );
}
