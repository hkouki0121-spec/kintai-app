import * as faceapi from "@vladmandic/face-api";
import { FACE_MATCH_THRESHOLD } from "@/lib/constants";

const MODEL_BASE =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";

const detectorOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 416,
  scoreThreshold: 0.5,
});

let modelsLoaded = false;

export async function loadFaceModels(): Promise<void> {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_BASE),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_BASE),
  ]);
  modelsLoaded = true;
}

export type FaceScanResult =
  | { status: "no_face" }
  | { status: "multiple_faces"; count: number }
  | { status: "ok"; descriptor: Float32Array };

/** 映像内の顔を検出（0人・複数人・1人を判定） */
export async function scanSingleFace(video: HTMLVideoElement): Promise<FaceScanResult> {
  await loadFaceModels();
  const detections = await faceapi
    .detectAllFaces(video, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) {
    return { status: "no_face" };
  }
  if (detections.length > 1) {
    return { status: "multiple_faces", count: detections.length };
  }
  return { status: "ok", descriptor: detections[0].descriptor };
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

/** @deprecated scanSingleFace を使用 */
export async function extractDescriptor(video: HTMLVideoElement): Promise<Float32Array | null> {
  const result = await scanSingleFace(video);
  return result.status === "ok" ? result.descriptor : null;
}
