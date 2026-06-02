"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureFaceForRegistration,
  descriptorToArray,
  FacePipelineError,
  loadFaceModels,
} from "@/lib/face/recognition";
import { FACE_REGISTRATION_STEPS, MAX_FACE_DESCRIPTORS } from "@/lib/face/registration-steps";
import type { FaceDescriptorEntry } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  employeeName: string;
  onSave: (descriptors: FaceDescriptorEntry[]) => Promise<void>;
  onClose?: () => void;
  registeredCount: number;
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

export function FaceRegister({ employeeName, onSave, onClose, registeredCount }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraReadyRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [captured, setCaptured] = useState<FaceDescriptorEntry[]>([]);
  const [hint, setHint] = useState(FACE_REGISTRATION_STEPS[0].hint);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const currentStep = FACE_REGISTRATION_STEPS[stepIndex];
  const progress = captured.length;

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
    setHint(currentStep.hint);
  }, [currentStep.hint]);

  const loadModels = useCallback(async () => {
    await loadFaceModels();
    setModelsReady(true);
  }, []);

  useEffect(() => {
    setHint(currentStep.hint);
  }, [currentStep.hint]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await startCamera();
        if (cancelled) return;
        setMessage(null);

        try {
          await loadModels();
          if (!cancelled) setMessage(null);
        } catch (err) {
          if (cancelled || !cameraReadyRef.current) return;
          const text =
            err instanceof FacePipelineError
              ? err.message
              : "顔認識モデルの読み込みに失敗しました。ページを再読み込みしてお試しください。";
          setMessage({ type: "error", text });
        }
      } catch (err) {
        if (cancelled || cameraReadyRef.current) return;
        const text = isCameraPermissionError(err)
          ? "カメラを使用できません。ブラウザのカメラ権限を許可してください。"
          : `カメラの起動に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
        setMessage({ type: "error", text });
      }
    };

    init();

    const video = videoRef.current;
    return () => {
      cancelled = true;
      cameraReadyRef.current = false;
      const stream = video?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera, loadModels]);

  const handleCapture = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setMessage(null);
    setHint("認証中...");

    try {
      if (!cameraReady) {
        setMessage({
          type: "error",
          text: "カメラ映像が準備できていません。カメラの権限を確認してください。",
        });
        return;
      }
      if (!modelsReady) {
        setMessage({
          type: "error",
          text: "顔認識モデルが読み込まれていません。ページを再読み込みするか、しばらく待ってからお試しください。",
        });
        return;
      }

      const scan = await captureFaceForRegistration(videoRef.current);

      if (scan.status === "no_face") {
        setHint(currentStep.hint);
        setMessage({
          type: "error",
          text: "もう一度正面を向いて撮影してください",
        });
        return;
      }
      if (scan.status === "multiple_faces") {
        setHint(currentStep.hint);
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人でカメラの前に立ってください。",
        });
        return;
      }

      const entry: FaceDescriptorEntry = {
        pose: currentStep.pose,
        brightness: currentStep.brightness,
        descriptor: descriptorToArray(scan.descriptor),
      };

      const nextCaptured = [...captured, entry];
      setCaptured(nextCaptured);

      if (nextCaptured.length >= MAX_FACE_DESCRIPTORS) {
        await onSave(nextCaptured);
        setHint("登録完了");
        setMessage({
          type: "success",
          text: `${employeeName} さんの顔を${MAX_FACE_DESCRIPTORS}枚登録しました`,
        });
        return;
      }

      const nextIndex = stepIndex + 1;
      setStepIndex(nextIndex);
      setHint(FACE_REGISTRATION_STEPS[nextIndex].hint);
      setMessage({
        type: "success",
        text: `${nextCaptured.length}/${MAX_FACE_DESCRIPTORS} 枚登録しました`,
      });
    } catch (err) {
      setHint(currentStep.hint);
      if (err instanceof FacePipelineError) {
        setMessage({ type: "error", text: err.message });
      } else if (err instanceof Error && err.message.includes("Supabase")) {
        setMessage({
          type: "error",
          text: `顔データの保存に失敗しました: ${err.message}`,
        });
      } else {
        setMessage({
          type: "error",
          text: `登録に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      console.error("[FaceRegister] register failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const canCapture = cameraReady && modelsReady && !loading;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{currentStep.label}</span>
          <span className="text-slate-500">{progress}/{MAX_FACE_DESCRIPTORS}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-blue-600 transition-all"
            style={{ width: `${(progress / MAX_FACE_DESCRIPTORS) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          正面・左右・明るさ違いの写真を最大{MAX_FACE_DESCRIPTORS}枚登録します。
          {registeredCount > 0 ? ` 現在 ${registeredCount} 枚登録済み（再登録で上書き）。` : ""}
        </p>
      </div>

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
            {loading ? "認証中..." : !modelsReady ? "モデルを読み込み中…" : hint}
          </div>
        )}
      </div>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleCapture} disabled={!canCapture} fullWidth>
          {loading ? "撮影中…" : "この角度で撮影"}
        </Button>
        {onClose && (
          <Button variant="secondary" onClick={onClose} disabled={loading} fullWidth>
            閉じる
          </Button>
        )}
      </div>
    </div>
  );
}
