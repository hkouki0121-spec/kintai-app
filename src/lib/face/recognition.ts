import * as faceapi from "@vladmandic/face-api";
import { FACE_MATCH_THRESHOLD } from "@/lib/constants";

const MODEL_BASE =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";

const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

let modelsLoaded = false;

export class FacePipelineError extends Error {
  readonly code: "model_load" | "face_detection" | "descriptor";

  constructor(
    code: "model_load" | "face_detection" | "descriptor",
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "FacePipelineError";
    this.code = code;
  }
}

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  try {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
    ]);
    modelsLoaded = true;
  } catch (err) {
    modelsLoaded = false;
    throw new FacePipelineError(
      "model_load",
      "顔認識モデルの読み込みに失敗しました。ネットワーク接続を確認し、ページを再読み込みしてからお試しください。",
      { cause: err }
    );
  }
}

/** 動画の解像度が取れるまで待機 */
export function waitForVideoReady(
  video: HTMLVideoElement,
  timeoutMs = 5000
): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth > 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new FacePipelineError(
          "face_detection",
          "カメラ映像の準備ができていません。数秒待ってからもう一度お試しください。"
        )
      );
    }, timeoutMs);
    const onReady = () => {
      if (video.videoWidth > 0) {
        clearTimeout(timer);
        video.removeEventListener("loadeddata", onReady);
        resolve();
      }
    };
    video.addEventListener("loadeddata", onReady);
    onReady();
  });
}

export type FaceScanResult =
  | { status: "no_face" }
  | { status: "multiple_faces"; count: number }
  | { status: "ok"; descriptor: Float32Array };

/** 顔登録用：モデル読込・検出・特徴量生成を分けてエラー化 */
export async function captureFaceForRegistration(
  video: HTMLVideoElement
): Promise<FaceScanResult> {
  await loadFaceModels();
  await waitForVideoReady(video);

  let detections;

  try {
    detections = await faceapi
      .detectAllFaces(video, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();
  } catch (err) {
    throw new FacePipelineError(
      "descriptor",
      "顔特徴量の生成に失敗しました。明るい場所で正面を向け、もう一度お試しください。",
      { cause: err }
    );
  }

  if (detections.length === 0) {
    return { status: "no_face" };
  }
  if (detections.length > 1) {
    return { status: "multiple_faces", count: detections.length };
  }

  const descriptor = detections[0].descriptor;
  if (!descriptor) {
    throw new FacePipelineError(
      "descriptor",
      "顔特徴量を取得できませんでした。明るい場所で正面を向け、もう一度お試しください。"
    );
  }

  return { status: "ok", descriptor };
}

/** 打刻用：映像内の顔を検出（0人・複数人・1人を判定） */
export async function scanSingleFace(video: HTMLVideoElement): Promise<FaceScanResult> {
  return captureFaceForRegistration(video);
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function arrayToDescriptor(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

export type EmployeeFaceRecord = {
  id: string;
  name: string;
  face_descriptor: number[] | null;
};

export type IdentifiedEmployee = {
  employeeId: string;
  name: string;
};

/** 登録済み従業員と照合（スコアは返さない） */
export function identifyEmployee(
  descriptor: Float32Array,
  employees: EmployeeFaceRecord[]
): IdentifiedEmployee | null {
  let bestId: string | null = null;
  let bestName: string | null = null;
  let bestDistance = Infinity;

  for (const emp of employees) {
    if (!emp.face_descriptor || emp.face_descriptor.length === 0) continue;
    const stored = arrayToDescriptor(emp.face_descriptor);
    const distance = faceapi.euclideanDistance(descriptor, stored);
    if (distance < FACE_MATCH_THRESHOLD && distance < bestDistance) {
      bestDistance = distance;
      bestId = emp.id;
      bestName = emp.name;
    }
  }

  if (!bestId || !bestName) return null;
  return { employeeId: bestId, name: bestName };
}

/** @deprecated captureFaceForRegistration を使用 */
export async function extractDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  const result = await scanSingleFace(video);
  return result.status === "ok" ? result.descriptor : null;
}
