import type { FaceBrightness, FacePose } from "@/types/database";

export const MAX_FACE_DESCRIPTORS = 5;

export type FaceRegistrationStep = {
  pose: FacePose;
  brightness: FaceBrightness;
  label: string;
  hint: string;
};

/** 追加時の撮影ガイド（最大5枚） */
export const FACE_REGISTRATION_STEPS: FaceRegistrationStep[] = [
  { pose: "front", brightness: "normal", label: "正面（通常）", hint: "正面を向いて撮影してください" },
  { pose: "front", brightness: "bright", label: "正面（明るい）", hint: "明るい場所で正面を向いて撮影してください" },
  { pose: "left", brightness: "normal", label: "左向き（通常）", hint: "左を向いて撮影してください" },
  { pose: "right", brightness: "normal", label: "右向き（通常）", hint: "右を向いて撮影してください" },
  { pose: "front", brightness: "dark", label: "正面（暗め）", hint: "やや暗い場所で正面を向いて撮影してください" },
];
