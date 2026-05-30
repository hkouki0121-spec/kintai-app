"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  descriptorToArray,
  loadFaceModels,
  scanSingleFace,
} from "@/lib/face/recognition";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  employeeName: string;
  onSave: (descriptor: number[]) => Promise<void>;
  onClose?: () => void;
  hasFace: boolean;
};

export function FaceRegister({ employeeName, onSave, onClose, hasFace }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hint, setHint] = useState("顔をカメラに向けてください");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const startCamera = useCallback(async () => {
    await loadFaceModels();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReady(true);
      setHint("顔をカメラに向けてください");
    }
  }, []);

  useEffect(() => {
    startCamera().catch(() => {
      setMessage({ type: "error", text: "カメラを使用できません。権限を確認してください。" });
    });
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  const handleRegister = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setMessage(null);
    setHint("認証中...");

    try {
      const scan = await scanSingleFace(videoRef.current);

      if (scan.status === "no_face") {
        setHint("顔をカメラに向けてください");
        setMessage({ type: "error", text: "顔を検出できません。明るい場所で正面を向けてください。" });
        return;
      }
      if (scan.status === "multiple_faces") {
        setHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人で登録してください。",
        });
        return;
      }

      await onSave(descriptorToArray(scan.descriptor));
      setHint("登録完了");
      setMessage({ type: "success", text: `${employeeName} さんの顔を登録しました` });
    } catch {
      setHint("顔をカメラに向けてください");
      setMessage({ type: "error", text: "登録に失敗しました。もう一度お試しください。" });
    } finally {
      setLoading(false);
    }
  };

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
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            カメラを起動中…
          </div>
        )}
        {ready && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-center text-sm font-medium text-white">
            {loading ? "認証中..." : hint}
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
        <Button onClick={handleRegister} disabled={!ready || loading} fullWidth>
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
