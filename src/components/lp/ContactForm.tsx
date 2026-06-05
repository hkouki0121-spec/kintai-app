"use client";

import { useState, type FormEvent } from "react";

type FormData = {
  name: string;
  company: string;
  email: string;
  phone: string;
  stores: string;
  message: string;
  type: "consultation" | "inquiry";
};

const initial: FormData = {
  name: "",
  company: "",
  email: "",
  phone: "",
  stores: "",
  message: "",
  type: "consultation",
};

export function ContactForm({ defaultType = "consultation" }: { defaultType?: FormData["type"] }) {
  const [form, setForm] = useState<FormData>({ ...initial, type: defaultType });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  function validate() {
    const next: Partial<Record<keyof FormData, string>> = {};
    if (!form.name.trim()) next.name = "お名前を入力してください";
    if (!form.company.trim()) next.company = "店舗名・会社名を入力してください";
    if (!form.email.trim()) {
      next.email = "メールアドレスを入力してください";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      next.email = "正しいメールアドレスを入力してください";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const response = await fetch("/api/lp/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "送信に失敗しました");
      }
      setSubmitted(true);
    } catch (error) {
      setSubmitError((error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-emerald-900">お問い合わせを受け付けました</h3>
        <p className="mt-2 text-sm text-emerald-800">
          2営業日以内にご連絡いたします。しばらくお待ちください。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">お問い合わせ種別</label>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { value: "consultation", label: "無料相談" },
              { value: "inquiry", label: "導入の問い合わせ" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setForm({ ...form, type: opt.value })}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                form.type === opt.value
                  ? "bg-[#1e3a5f] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="お名前"
          required
          value={form.name}
          error={errors.name}
          onChange={(v) => setForm({ ...form, name: v })}
          placeholder="山田 太郎"
        />
        <Field
          label="店舗名・会社名"
          required
          value={form.company}
          error={errors.company}
          onChange={(v) => setForm({ ...form, company: v })}
          placeholder="〇〇焼肉 渋谷店"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          label="メールアドレス"
          required
          type="email"
          value={form.email}
          error={errors.email}
          onChange={(v) => setForm({ ...form, email: v })}
          placeholder="example@email.com"
        />
        <Field
          label="電話番号（任意）"
          type="tel"
          value={form.phone}
          onChange={(v) => setForm({ ...form, phone: v })}
          placeholder="03-1234-5678"
        />
      </div>

      <Field
        label="店舗数（任意）"
        value={form.stores}
        onChange={(v) => setForm({ ...form, stores: v })}
        placeholder="例：2店舗"
      />

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-semibold text-slate-700">
          ご相談内容（任意）
        </label>
        <textarea
          id="message"
          rows={4}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="現在の勤怠管理の状況や、お困りのことをお聞かせください"
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition-shadow focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {submitError && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{submitError}</p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-orange-500 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-orange-600 disabled:opacity-60"
      >
        {submitting ? "送信中…" : "送信する"}
      </button>
      <p className="text-center text-xs text-slate-500">
        送信いただいた情報は、お問い合わせ対応のみに使用します。
      </p>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  const id = label.replace(/\s/g, "-");
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-800 outline-none transition-shadow focus:ring-2 focus:ring-blue-500/20 ${
          error ? "border-red-300 focus:border-red-500" : "border-slate-200 focus:border-blue-500"
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
