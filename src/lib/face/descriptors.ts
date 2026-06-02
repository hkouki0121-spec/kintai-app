import { MAX_FACE_DESCRIPTORS } from "@/lib/face/registration-steps";
import type { FaceDescriptorEntry } from "@/types/database";

function isDescriptorEntry(value: unknown): value is FaceDescriptorEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as FaceDescriptorEntry;
  return (
    typeof entry.pose === "string" &&
    typeof entry.brightness === "string" &&
    Array.isArray(entry.descriptor) &&
    entry.descriptor.length > 0
  );
}

/** 旧形式（number[]）と新形式（FaceDescriptorEntry[]）の両方に対応 */
export function parseFaceDescriptors(raw: unknown): FaceDescriptorEntry[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if (typeof raw[0] === "number") {
    return [{ pose: "front", brightness: "normal", descriptor: raw as number[] }];
  }

  return raw.filter(isDescriptorEntry).slice(0, MAX_FACE_DESCRIPTORS);
}

export function isFaceRegistrationComplete(raw: unknown): boolean {
  return parseFaceDescriptors(raw).length >= MAX_FACE_DESCRIPTORS;
}

export function countFaceDescriptors(raw: unknown): number {
  return parseFaceDescriptors(raw).length;
}
