"use client";

import { FacePhotoManager } from "@/components/admin/FacePhotoManager";
import { FACE_MATCH_MIN_RATE } from "@/lib/constants";
import { MAX_FACE_DESCRIPTORS } from "@/lib/face/registration-steps";
import type { FaceDescriptorEntry } from "@/types/database";

type Props = {
  employeeId: string;
  employeeName: string;
  faceDescriptor: unknown;
  onUpdate: (employeeId: string, descriptors: FaceDescriptorEntry[]) => Promise<void>;
  onClose: () => void;
};

export function FaceRegisterModal({
  employeeId,
  employeeName,
  faceDescriptor,
  onUpdate,
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
          顔写真管理 — {employeeName}
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          最大{MAX_FACE_DESCRIPTORS}枚まで登録できます。一致率閾値は{FACE_MATCH_MIN_RATE}%です。
        </p>
        <div className="mt-4">
          <FacePhotoManager
            employeeName={employeeName}
            faceDescriptor={faceDescriptor}
            onClose={onClose}
            onUpdate={(descriptors) => onUpdate(employeeId, descriptors)}
          />
        </div>
      </div>
    </div>
  );
}
