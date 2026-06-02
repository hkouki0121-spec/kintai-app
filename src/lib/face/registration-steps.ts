import type { FaceBrightness, FacePose } from "@/types/database";

export const MAX_FACE_DESCRIPTORS = 10;

export type FaceRegistrationStep = {
  pose: FacePose;
  brightness: FaceBrightness;
  label: string;
  hint: string;
};

/** 正面・左右・明るさ違いの10枚登録ステップ */
export const FACE_REGISTRATION_STEPS: FaceRegistrationStep[] = [
  { pose: "front", brightness: "normal", label: "1/10 正面（通常）", hint: "正面を向いて撮影してください" },
  { pose: "front", brightness: "bright", label: "2/10 正面（明るい）", hint: "明るい場所で正面を向いて撮影してください" },
  { pose: "front", brightness: "dark", label: "3/10 正面（暗め）", hint: "やや暗い場所で正面を向いて撮影してください" },
  { pose: "left", brightness: "normal", label: "4/10 左向き（通常）", hint: "左を向いて撮影してください" },
  { pose: "left", brightness: "bright", label: "5/10 左向き（明るい）", hint: "明るい場所で左を向いて撮影してください" },
  { pose: "left", brightness: "dark", label: "6/10 左向き（暗め）", hint: "やや暗い場所で左を向いて撮影してください" },
  { pose: "right", brightness: "normal", label: "7/10 右向き（通常）", hint: "右を向いて撮影してください" },
  { pose: "right", brightness: "bright", label: "8/10 右向き（明るい）", hint: "明るい場所で右を向いて撮影してください" },
  { pose: "right", brightness: "dark", label: "9/10 右向き（暗め）", hint: "やや暗い場所で右を向いて撮影してください" },
  { pose: "front", brightness: "normal", label: "10/10 正面（再確認）", hint: "もう一度正面を向いて撮影してください" },
];
