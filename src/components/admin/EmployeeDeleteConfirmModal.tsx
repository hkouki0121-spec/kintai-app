"use client";

import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  employeeName: string;
  attendanceCount: number;
  payrollCount: number;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function EmployeeDeleteConfirmModal({
  employeeName,
  attendanceCount,
  payrollCount,
  deleting,
  onConfirm,
  onClose,
}: Props) {
  const hasRelatedData = attendanceCount > 0 || payrollCount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-delete-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <h3 id="employee-delete-title" className="text-lg font-bold text-slate-900">
          従業員を削除
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-900">{employeeName}</span>
          を削除します。この操作は取り消せません。
        </p>

        {hasRelatedData && (
          <div className="mt-4">
            <Alert type="error">
              {attendanceCount > 0 && (
                <p>勤怠記録が {attendanceCount} 件あります。削除すると勤怠データも完全に削除されます。</p>
              )}
              {payrollCount > 0 && (
                <p className={attendanceCount > 0 ? "mt-2" : ""}>
                  給与記録が {payrollCount} 件あります。削除すると給与データも完全に削除されます。
                </p>
              )}
            </Alert>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-2">
          <Button variant="danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? "削除中…" : "削除する"}
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={deleting}>
            キャンセル
          </Button>
        </div>
      </div>
    </div>
  );
}
