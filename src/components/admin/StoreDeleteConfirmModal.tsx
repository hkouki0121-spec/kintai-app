"use client";

import { Button } from "@/components/ui/Button";

type Props = {
  storeName: string;
  deleting: boolean;
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
};

export function StoreDeleteConfirmModal({
  storeName,
  deleting,
  errorMessage,
  onConfirm,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="store-delete-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <h3 id="store-delete-title" className="text-lg font-bold text-slate-900">
          店舗を削除しますか？
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{storeName}</span>
          を削除します。
          <br />
          この操作は取り消せません。
        </p>

        {errorMessage && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
            {errorMessage}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            キャンセル
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? "削除中…" : "削除する"}
          </Button>
        </div>
      </div>
    </div>
  );
}
