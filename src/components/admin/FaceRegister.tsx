"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureFaceForRegistration,
  descriptorToArray,
  FacePipelineError,
  loadFaceModels,
} from "@/lib/face/recognition";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  employeeName: string;
  onSave: (descriptor: number[]) => Promise<void>;
  onClose?: () => void;
  hasFace: boolean;
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

export function FaceRegister({ employeeName, onSave, onClose, hasFace }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraReadyRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("顔をカメラに向けてください");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

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
    setHint("顔をカメラに向けてください");
  }, []);

  const loadModels = useCallback(async () => {
    await loadFaceModels();
    setModelsReady(true);
  }, []);

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

  const handleRegister = async () => {
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
        setHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "顔を検出できませんでした。明るい場所で正面を向けてください。",
        });
        return;
      }
      if (scan.status === "multiple_faces") {
        setHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人でカメラの前に立ってください。",
        });
        return;
      }

      await onSave(descriptorToArray(scan.descriptor));
      setHint("登録完了");
      setMessage({ type: "success", text: `${employeeName} さんの顔を登録しました` });
    } catch (err) {
      setHint("顔をカメラに向けてください");
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

  const canRegister = cameraReady && modelsReady && !loading;

  return (
    <div className="flex flex-col gap-4">
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

      <p className="text-xs text-slate-500">
        {hasFace
          ? "顔登録済みです。再登録すると上書きされます。"
          : "顔未登録です。打刻には登録が必要です。"}
      </p>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={handleRegister} disabled={!canRegister} fullWidth>
          {loading ? "登録中…" : "顔を登録"}
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
