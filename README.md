# 勤怠管理アプリ（kintai-app）

顔認証による出勤・退勤打刻、従業員管理、深夜割増（22時以降×1.25）、月末給与自動計算に対応した勤怠管理システムです。

## 技術スタック

- **Next.js 15**（App Router）
- **TypeScript**
- **Tailwind CSS 4**
- **Supabase**（PostgreSQL / Auth / RLS）
- **@vladmandic/face-api**（ブラウザ顔認証）

## 機能一覧

| 機能 | 説明 |
|------|------|
| 顔認証出勤・退勤 | トップ画面のキオスクで打刻 |
| 従業員ごとの時給 | 管理画面で設定 |
| 22時以降 1.25倍 | 給与計算時に自動適用（22時〜翌5時） |
| 30分単位切り捨て | `Math.floor(分/30)*0.5` で通常・深夜それぞれ集計 |
| 月末給与計算 | 管理画面の手動計算 + Vercel Cron |
| 管理者ログイン | Supabase Auth |
| 従業員一覧 | 追加・時給・顔登録 |
| 勤怠履歴 | 期間フィルタ付き |
| スマホ対応 | レスポンシブ UI |
| 日本語 | 全画面日本語 |

## セットアップ

### 1. 依存関係のインストール

```bash
cd ~/Projects/kintai-app
npm install
```

### 2. Supabase プロジェクト

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. SQL Editor で `supabase/schema.sql` を実行（既存DBの場合は `supabase/migrations/20250529_add_actual_hours.sql` も実行）
3. **Authentication → Users** で管理者ユーザーを作成（メール / パスワード）
4. **Settings → API** から URL と `anon` / `service_role` キーを取得

### 3. 環境変数

```bash
cp .env.example .env.local
```

`.env.local` を編集:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
CRON_SECRET=ランダムな長い文字列
```

### 4. 開発サーバー

```bash
npm run dev
```

- 打刻（キオスク）: http://localhost:3000
- 管理者ログイン: http://localhost:3000/admin/login

### 5. 初期運用フロー

1. 管理者でログイン
2. **従業員** から氏名・社員コード・時給を登録
3. 各従業員の **編集 → 顔を登録** で顔データを保存
4. スマホまたはタブレットでトップ画面を開き、出勤・退勤打刻
5. **給与** 画面で対象月を選び「給与を計算」

## 月末自動給与（Vercel）

`vercel.json` に Cron を定義しています。デプロイ後、Vercel の環境変数に `CRON_SECRET` と `SUPABASE_SERVICE_ROLE_KEY` を設定してください。

Cron は月末（JST）に前月分の給与を自動計算します。手動では **給与 → 給与を計算** でも実行できます。

## 顔認証について

- 初回はモデルを CDN から読み込むため、ネット接続が必要です
- 屋内の明るい場所で正面を向けてください
- 社内キオスク利用を想定した簡易認証です。高セキュリティが必要な場合は専用端末・サーバー側認証への拡張を検討してください

## ディレクトリ構成

```
src/
  app/                 # ページ・API
  components/          # UI・打刻・管理
  lib/                 # Supabase・顔認証・給与計算
  types/               # 型定義
supabase/
  schema.sql           # DB スキーマ
```

## ライセンス

MIT
