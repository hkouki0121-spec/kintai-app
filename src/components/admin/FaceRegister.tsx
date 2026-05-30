"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  descriptorToArray,
  extractDescriptor,
  loadFaceModels,
} from "@/lib/face/recognition";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

type Props = {
  onSave: (descriptor: number[]) => Promise<void>;
  hasFace: boolean;
};

export function FaceRegister({ onSave, hasFace }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    await loadFaceModels();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setReady(true);
    }
  }, []);

  useEffect(() => {
    startCamera().catch(() => setMessage("カメラを使用できません"));
    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  const handleRegister = async () => {
    if (!videoRef.current) return;
    setLoading(true);
    setMessage(null);
    try {
      const descriptor = await extractDescriptor(videoRef.current);
      if (!descriptor) {
        setMessage("顔を検出できませんでした");
        return;
      }
      await onSave(descriptorToArray(descriptor));
      setMessage("顔を登録しました");
    } catch {
      setMessage("登録に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-xl bg-slate-900">
        <video
          ref={videoRef}
          className="aspect-video w-full object-cover"
          playsInline
          muted
          style={{ transform: "scaleX(-1)" }}
        />
      </div>
      <p className="text-xs text-slate-500">
        {hasFace ? "顔登録済み — 再登録すると上書きされます" : "顔未登録 — 打刻には登録が必要です"}
      </p>
      {message && (
        <Alert type={message.includes("しました") ? "success" : "error"}>{message}</Alert>
      )}
      <Button onClick={handleRegister} disabled={!ready || loading} variant="secondary">
        {loading ? "登録中…" : "顔を登録"}
      </Button>
    </div>
  );
}
