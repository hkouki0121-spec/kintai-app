"use client";

import { FaceRegister } from "@/components/admin/FaceRegister";
import { countFaceDescriptors } from "@/lib/face/descriptors";
import type { FaceDescriptorEntry } from "@/types/database";

type Props = {
  employeeId: string;
  employeeName: string;
  faceDescriptor: unknown;
  onSave: (employeeId: string, descriptors: FaceDescriptorEntry[]) => Promise<void>;
  onClose: () => void;
};

export function FaceRegisterModal({
  employeeId,
  employeeName,
  faceDescriptor,
  onSave,
  onClose,
}: Props) {
  const registeredCount = countFaceDescriptors(faceDescriptor);

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
        <p className="mt-1 text-sm text-slate-600">
          正面・左右・明るさ違いの写真を最大10枚登録します（レベル3）
        </p>
        <div className="mt-4">
          <FaceRegister
            employeeName={employeeName}
            registeredCount={registeredCount}
            onClose={onClose}
            onSave={(descriptors) => onSave(employeeId, descriptors)}
          />
        </div>
      </div>
    </div>
  );
}
