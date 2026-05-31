import type { Metadata } from "next";
import { LineUserIdClient } from "@/components/line/LineUserIdClient";

export const metadata: Metadata = {
  title: "LINEユーザーID取得",
  description: "LIFF で自分の LINEユーザーID を表示し、店舗管理画面へ設定できます。",
};

export default function LineUserIdPage() {
  return <LineUserIdClient />;
}
