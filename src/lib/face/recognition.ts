import * as faceapi from "@vladmandic/face-api";
import { FACE_MATCH_THRESHOLD } from "@/lib/constants";

const MODEL_BASE =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model";

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

export async function extractDescriptor(
  video: HTMLVideoElement
): Promise<Float32Array | null> {
  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }))
    .withFaceLandmarks()
    .withFaceDescriptor();

  return detection?.descriptor ?? null;
}

export function descriptorToArray(descriptor: Float32Array): number[] {
  return Array.from(descriptor);
}

export function arrayToDescriptor(arr: number[]): Float32Array {
  return new Float32Array(arr);
}

export type FaceMatch = {
  employeeId: string;
  name: string;
  distance: number;
};

export function findBestMatch(
  descriptor: Float32Array,
  employees: { id: string; name: string; face_descriptor: number[] | null }[]
): FaceMatch | null {
  let best: FaceMatch | null = null;

  for (const emp of employees) {
    if (!emp.face_descriptor || emp.face_descriptor.length === 0) continue;
    const stored = arrayToDescriptor(emp.face_descriptor);
    const distance = faceapi.euclideanDistance(descriptor, stored);
    if (distance < FACE_MATCH_THRESHOLD && (!best || distance < best.distance)) {
      best = { employeeId: emp.id, name: emp.name, distance };
    }
  }

  return best;
}
