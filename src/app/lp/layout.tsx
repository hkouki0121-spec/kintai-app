import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "勤怠管理アプリ | 飲食店・小規模店舗向け スマホ打刻・給与自動集計",
  description:
    "飲食店・小規模店舗向けの勤怠管理アプリ。スマホでアルバイトの出勤・退勤を打刻し、顔認証で本人確認。深夜手当の自動計算、月末給与の自動集計、店舗別管理、CSV出力に対応。紙のタイムカード・Excel管理から卒業しませんか？",
  keywords: [
    "勤怠管理アプリ",
    "アルバイト 勤怠管理",
    "飲食店 勤怠管理",
    "給与計算 自動化",
    "タイムカード アプリ",
    "顔認証 勤怠",
    "シフト管理",
    "店舗 勤怠管理",
    "深夜手当 自動計算",
  ],
  openGraph: {
    title: "勤怠管理アプリ | もう、月末の給与計算で悩まない。",
    description:
      "スマホで打刻、自動で集計。飲食店・小規模店舗の勤怠・給与管理をラクにするアプリです。",
    type: "website",
    locale: "ja_JP",
  },
};

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
