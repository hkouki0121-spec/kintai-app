import type { FaceBrightness, FacePose, FaceDescriptorEntry } from "@/types/database";

const POSE_LABELS: Record<FacePose, string> = {
  front: "正面",
  left: "左向き",
  right: "右向き",
};

const BRIGHTNESS_LABELS: Record<FaceBrightness, string> = {
  normal: "通常",
  bright: "明るい",
  dark: "暗め",
};

export function formatFacePhotoLabel(entry: FaceDescriptorEntry, index: number): string {
  return `${index + 1}. ${POSE_LABELS[entry.pose]} / ${BRIGHTNESS_LABELS[entry.brightness]}`;
}
