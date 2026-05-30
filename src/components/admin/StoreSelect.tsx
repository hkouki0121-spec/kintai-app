import type { Store } from "@/types/database";
import { ALL_STORES_VALUE } from "@/lib/stores/constants";

type Props = {
  stores: Pick<Store, "id" | "name">[];
  value: string;
  onChange: (storeId: string) => void;
  className?: string;
  label?: string;
};

export function StoreSelect({
  stores,
  value,
  onChange,
  className = "",
  label = "店舗",
}: Props) {
  return (
    <div className={className}>
      <label className="mb-1 block text-sm text-slate-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full min-w-[10rem] rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 sm:w-auto"
      >
        <option value={ALL_STORES_VALUE}>全店舗</option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name}
          </option>
        ))}
      </select>
    </div>
  );
}
