import { createClient } from "@/lib/supabase/server";
import { StoreManager } from "@/components/admin/StoreManager";
import type { Store } from "@/types/database";

export default async function StoresPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("stores").select("*").order("name");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">店舗管理</h2>
        <p className="text-sm text-slate-600">店舗の追加・編集・有効/無効の切り替え</p>
      </div>
      <StoreManager initialStores={(data as Store[]) ?? []} />
    </div>
  );
}
