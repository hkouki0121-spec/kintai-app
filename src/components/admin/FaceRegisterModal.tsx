"use client";

import { FaceRegister } from "@/components/admin/FaceRegister";

type Props = {
  employeeId: string;
  employeeName: string;
  hasFace: boolean;
  onSave: (employeeId: string, descriptor: number[]) => Promise<void>;
  onClose: () => void;
};

export function FaceRegisterModal({
  employeeId,
  employeeName,
  hasFace,
  onSave,
  onClose,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="face-register-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-xl sm:p-6">
        <h3 id="face-register-title" className="text-lg font-bold text-slate-900">
          顔登録 — {employeeName}
        </h3>
        <p className="mt-1 text-sm text-slate-600">カメラで顔を撮影し、特徴量を登録します</p>
        <div className="mt-4">
          <FaceRegister
            employeeName={employeeName}
            hasFace={hasFace}
            onClose={onClose}
            onSave={(descriptor) => onSave(employeeId, descriptor)}
          />
        </div>
      </div>
    </div>
  );
}
