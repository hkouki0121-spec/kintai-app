import Link from "next/link";
import { FaceClock } from "@/components/FaceClock";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 pb-8">
      <FaceClock />
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
