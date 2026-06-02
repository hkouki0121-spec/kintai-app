"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureFaceForRegistration,
  descriptorToArray,
  FacePipelineError,
  loadFaceModels,
} from "@/lib/face/recognition";
import { formatFacePhotoLabel } from "@/lib/face/labels";
import { parseFaceDescriptors } from "@/lib/face/descriptors";
import { FACE_REGISTRATION_STEPS, MAX_FACE_DESCRIPTORS } from "@/lib/face/registration-steps";
import { FACE_MATCH_MIN_RATE } from "@/lib/constants";
import type { FaceDescriptorEntry } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  employeeName: string;
  faceDescriptor: unknown;
  onUpdate: (descriptors: FaceDescriptorEntry[]) => Promise<void>;
  onClose: () => void;
};

function isCameraPermissionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name;
  return (
    name === "NotAllowedError" ||
    name === "PermissionDeniedError" ||
    name === "NotFoundError" ||
    name === "NotReadableError"
  );
}

export function FacePhotoManager({
  employeeName,
  faceDescriptor,
  onUpdate,
  onClose,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraReadyRef = useRef(false);
  const [photos, setPhotos] = useState<FaceDescriptorEntry[]>(() =>
    parseFaceDescriptors(faceDescriptor)
  );
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [hint, setHint] = useState(FACE_REGISTRATION_STEPS[0].hint);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const canAddMore = photos.length < MAX_FACE_DESCRIPTORS;
  const nextStep = FACE_REGISTRATION_STEPS[Math.min(photos.length, FACE_REGISTRATION_STEPS.length - 1)];

  useEffect(() => {
    setPhotos(parseFaceDescriptors(faceDescriptor));
  }, [faceDescriptor]);

  useEffect(() => {
    if (showCamera) {
      setHint(nextStep.hint);
    }
  }, [showCamera, nextStep.hint]);

  const startCamera = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (!videoRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error("ビデオ要素の初期化に失敗しました");
    }
    videoRef.current.srcObject = stream;
    await videoRef.current.play();
    cameraReadyRef.current = true;
    setCameraReady(true);
  }, []);

  const stopCamera = useCallback(() => {
    const stream = videoRef.current?.srcObject as MediaStream | undefined;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    cameraReadyRef.current = false;
    setCameraReady(false);
  }, []);

  const loadModels = useCallback(async () => {
    await loadFaceModels();
    setModelsReady(true);
  }, []);

  useEffect(() => {
    if (!showCamera) {
      stopCamera();
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        await startCamera();
        if (cancelled) return;
        await loadModels();
      } catch (err) {
        if (cancelled) return;
        const text = isCameraPermissionError(err)
          ? "カメラを使用できません。ブラウザのカメラ権限を許可してください。"
          : `カメラの起動に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
        setMessage({ type: "error", text });
        setShowCamera(false);
      }
    };

    init();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [showCamera, startCamera, loadModels, stopCamera]);

  const handleAddPhoto = async () => {
    if (!videoRef.current || !canAddMore) return;
    setLoading(true);
    setMessage(null);

    try {
      const scan = await captureFaceForRegistration(videoRef.current);

      if (scan.status === "no_face") {
        setMessage({ type: "error", text: "もう一度正面を向いて撮影してください" });
        return;
      }
      if (scan.status === "multiple_faces") {
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人でカメラの前に立ってください。",
        });
        return;
      }

      const entry: FaceDescriptorEntry = {
        pose: nextStep.pose,
        brightness: nextStep.brightness,
        descriptor: descriptorToArray(scan.descriptor),
      };

      const nextPhotos = [...photos, entry];
      await onUpdate(nextPhotos);
      setPhotos(nextPhotos);
      setMessage({
        type: "success",
        text: `${employeeName} さんの顔写真を追加しました（${nextPhotos.length}/${MAX_FACE_DESCRIPTORS}枚）`,
      });

      if (nextPhotos.length >= MAX_FACE_DESCRIPTORS) {
        setShowCamera(false);
      }
    } catch (err) {
      if (err instanceof FacePipelineError) {
        setMessage({ type: "error", text: err.message });
      } else {
        setMessage({
          type: "error",
          text: `追加に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (index: number) => {
    setDeletingIndex(index);
    setMessage(null);

    try {
      const nextPhotos = photos.filter((_, i) => i !== index);
      await onUpdate(nextPhotos);
      setPhotos(nextPhotos);
      setMessage({ type: "success", text: "顔写真を削除しました" });
    } catch (err) {
      setMessage({
        type: "error",
        text: `削除に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setDeletingIndex(null);
    }
  };

  const canCapture = cameraReady && modelsReady && !loading && canAddMore;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <p>
          登録枚数: <span className="font-semibold text-slate-900">{photos.length}/{MAX_FACE_DESCRIPTORS}枚</span>
        </p>
        <p className="mt-1">
          一致率閾値: <span className="font-semibold text-slate-900">{FACE_MATCH_MIN_RATE}%</span>
          （認証時は登録済み写真すべてと比較し、最高一致率を使用）
        </p>
      </div>

      {photos.length > 0 ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {photos.map((photo, index) => (
            <li key={index} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm text-slate-700">{formatFacePhotoLabel(photo, index)}</span>
              <Button
                variant="danger"
                onClick={() => handleDeletePhoto(index)}
                disabled={deletingIndex !== null || loading}
              >
                {deletingIndex === index ? "削除中…" : "削除"}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          登録済みの顔写真はありません
        </p>
      )}

      {canAddMore && !showCamera && (
        <Button onClick={() => setShowCamera(true)}>顔写真を追加</Button>
      )}

      {showCamera && canAddMore && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <p className="text-sm font-medium text-slate-700">
            追加: {nextStep.label}（{photos.length + 1}/{MAX_FACE_DESCRIPTORS}枚目）
          </p>
          <div className="relative overflow-hidden rounded-2xl bg-slate-900">
            <video
              ref={videoRef}
              className="aspect-[4/3] w-full object-cover"
              playsInline
              muted
              style={{ transform: "scaleX(-1)" }}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
                カメラを起動中…
              </div>
            )}
            {cameraReady && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-sm font-medium text-white">
                {loading ? "撮影中…" : !modelsReady ? "モデルを読み込み中…" : hint}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={handleAddPhoto} disabled={!canCapture} fullWidth>
              {loading ? "撮影中…" : "撮影して追加"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowCamera(false)}
              disabled={loading}
              fullWidth
            >
              キャンセル
            </Button>
          </div>
        </div>
      )}

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <Button variant="secondary" onClick={onClose} disabled={loading || deletingIndex !== null}>
        閉じる
      </Button>
    </div>
  );
}
