"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("メールアドレスまたはパスワードが正しくありません。");
      setLoading(false);
      return;
    }

    router.push("/admin");
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">管理者ログイン</h1>
        <p className="mt-1 text-sm text-slate-600">Supabase で作成した管理者アカウントでログイン</p>

        <form onSubmit={handleLogin} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">メールアドレス</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">パスワード</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <p className="mt-2 text-right text-sm">
              <Link href="/admin/forgot-password" className="text-blue-600 hover:underline">
                パスワードを忘れた方
              </Link>
            </p>
          </div>
          {error && <Alert type="error">{error}</Alert>}
          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "ログイン中…" : "ログイン"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link href="/admin/register" className="text-blue-600 hover:underline">
            会社アカウントを新規登録
          </Link>
          {" · "}
          <Link href="/" className="text-blue-600 hover:underline">
            打刻画面に戻る
          </Link>
        </p>
      </Card>
    </main>
  );
}
