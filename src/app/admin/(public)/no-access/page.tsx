import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function NoAccessPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md text-center">
        <h1 className="text-xl font-bold text-slate-900">アクセス権限がありません</h1>
        <p className="mt-2 text-sm text-slate-600">
          このアカウントは会社に紐付けられていません。管理者にお問い合わせください。
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link href="/admin/register" className="text-blue-600 hover:underline">
            会社アカウントを新規登録
          </Link>
          <Link href="/admin/login" className="text-sm text-slate-500 hover:underline">
            別のアカウントでログイン
          </Link>
        </div>
      </Card>
    </main>
  );
}
