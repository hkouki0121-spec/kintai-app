"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

type RegisterErrorDetails = {
  error?: string;
  step?: string | null;
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

export default function RegisterCompanyPage() {
  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<RegisterErrorDetails | null>(
    null
  );
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorDetails(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("パスワードが一致しません");
      return;
    }

    if (password.length < 8) {
      setError("パスワードは8文字以上にしてください");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          adminName: adminName || companyName,
          email,
          password,
        }),
      });

      const data = (await res.json()) as RegisterErrorDetails & {
        companyName?: string;
        ok?: boolean;
      };

      if (!res.ok) {
        console.error("[register-company] API error", {
          status: res.status,
          ...data,
        });
        setError(data.error ?? "登録に失敗しました");
        setErrorDetails({
          step: data.step ?? null,
          message: data.message ?? null,
          code: data.code ?? null,
          details: data.details ?? null,
          hint: data.hint ?? null,
        });
        return;
      }

      setSuccess(
        `${data.companyName ?? companyName} のアカウントを作成しました。ログインしてください。`
      );
      setTimeout(() => router.push("/admin/login"), 1500);
    } catch (caught) {
      console.error("[register-company] network error", caught);
      setError("登録に失敗しました（通信エラー）");
      setErrorDetails({
        message: caught instanceof Error ? caught.message : String(caught),
        code: "NETWORK_ERROR",
        details: null,
        hint: null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-bold text-slate-900">会社アカウント登録</h1>
        <p className="mt-1 text-sm text-slate-600">
          会社情報と管理者アカウントを作成します
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">会社名</label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">管理者名</label>
            <Input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              placeholder="未入力の場合は会社名を使用"
            />
          </div>
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
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">パスワード（確認）</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && <Alert type="error">{error}</Alert>}
          {errorDetails && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-900">
              <p className="font-semibold">エラー詳細</p>
              {errorDetails.step && (
                <p className="mt-2">
                  <span className="font-medium">step:</span> {errorDetails.step}
                </p>
              )}
              <p className="mt-1 break-all">
                <span className="font-medium">error.message:</span>{" "}
                {errorDetails.message ?? "—"}
              </p>
              <p className="mt-1 break-all">
                <span className="font-medium">error.code:</span>{" "}
                {errorDetails.code ?? "—"}
              </p>
              <p className="mt-1 break-all">
                <span className="font-medium">error.details:</span>{" "}
                {errorDetails.details ?? "—"}
              </p>
              {errorDetails.hint && (
                <p className="mt-1 break-all">
                  <span className="font-medium">error.hint:</span> {errorDetails.hint}
                </p>
              )}
            </div>
          )}
          {success && <Alert type="success">{success}</Alert>}

          <Button type="submit" fullWidth disabled={loading}>
            {loading ? "登録中…" : "会社アカウントを作成"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link href="/admin/login" className="text-blue-600 hover:underline">
            ログインはこちら
          </Link>
        </p>
      </Card>
    </main>
  );
}
