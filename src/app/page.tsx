import Link from "next/link";
import { Suspense } from "react";
import { FaceClock } from "@/components/FaceClock";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-8">
      <Suspense fallback={<p className="p-8 text-center text-slate-500">読み込み中…</p>}>
        <FaceClock />
      </Suspense>
      <footer className="mt-4 text-center">
        <Link
          href="/admin/login"
          className="text-sm text-slate-500 underline-offset-2 hover:text-blue-600 hover:underline"
        >
          管理者ログイン
        </Link>
      </footer>
    </main>
  );
}
