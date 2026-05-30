"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

import { formatJstDateTime } from "@/lib/format";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

type Mode = "clock_in" | "clock_out";

type EmployeeRow = {
  id: string;
  name: string;
  face_descriptor: number[] | null;
};

export function FaceClock() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<Mode>("clock_in");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const supabase = createClient();
  const faceApiref = useRef<any>(null);
  const startCamera = useCallback(async () => {
    if (!faceApiref.current) {
      faceApiref.current = await import("@/lib/face/recognition");
     }
     
     await faceApiref.current.loadFaceModels();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setReady(true);
  }, []);

  useEffect(() => {
    const loadEmployees = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, face_descriptor")
        .eq("is_active", true);
      setEmployees((data as EmployeeRow[]) ?? []);
    };
    loadEmployees();
    startCamera().catch(() => {
      setMessage({ type: "error", text: "カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。" });
    });

    return () => {
      const video = videoRef.current;
      const stream = video?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera, supabase]);

  const handleStamp = async () => {
    if (!videoRef.current || !ready) return;
    setLoading(true);
    setMessage(null);

    try {
      const descriptor = await faceApiref.current.extractDescriptor(videoRef.current);
      if (!descriptor) {
        setMessage({ type: "error", text: "顔を検出できませんでした。明るい場所でカメラに正面を向けてください。" });
        return;
      }

      const match = faceApiref.current.findBestMatch(descriptor, employees);
      if (!match) {
        setMessage({
          type: "error",
          text: "登録されている従業員と一致しませんでした。管理者に顔登録を依頼してください。",
        });
        return;
      }

      const now = new Date().toISOString();

      if (mode === "clock_in") {
        const { data: open } = await supabase
          .from("attendance_records")
          .select("id")
          .eq("employee_id", match.employeeId)
          .is("clock_out", null)
          .maybeSingle();

        if (open) {
          setMessage({ type: "error", text: `${match.name} さんはすでに出勤中です。退勤打刻を行ってください。` });
          return;
        }

        const { error } = await supabase.from("attendance_records").insert({
          employee_id: match.employeeId,
          clock_in: now,
        });

        if (error) throw error;
        setMessage({
          type: "success",
          text: `${match.name} さん — 出勤を記録しました（${formatJstDateTime(now)}）`,
        });
      } else {
        const { data: record, error: fetchError } = await supabase
          .from("attendance_records")
          .select("id")
          .eq("employee_id", match.employeeId)
          .is("clock_out", null)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!record) {
          setMessage({ type: "error", text: `${match.name} さんの出勤記録がありません。` });
          return;
        }

        const { error } = await supabase
          .from("attendance_records")
          .update({ clock_out: now })
          .eq("id", record.id);

        if (error) throw error;
        setMessage({
          type: "success",
          text: `${match.name} さん — 退勤を記録しました（${formatJstDateTime(now)}）`,
        });
      }
    } catch (e) {
      const err = e as Error;
      setMessage({ type: "error", text: err.message || "打刻に失敗しました。" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 sm:p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">勤怠打刻</h1>
        <p className="mt-1 text-sm text-slate-600">顔認証で出勤・退勤を記録します</p>
      </header>

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("clock_in")}
          className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-colors ${
            mode === "clock_in" ? "bg-white text-blue-700 shadow" : "text-slate-600"
          }`}
        >
          出勤
        </button>
        <button
          type="button"
          onClick={() => setMode("clock_out")}
          className={`flex-1 rounded-lg py-3 text-sm font-semibold transition-colors ${
            mode === "clock_out" ? "bg-white text-blue-700 shadow" : "text-slate-600"
          }`}
        >
          退勤
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="relative aspect-[4/3] bg-slate-900">
          <video
            ref={videoRef}
            className="h-full w-full object-cover mirror"
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
          />
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              カメラを起動中…
            </div>
          )}
        </div>
      </Card>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <Button
        fullWidth
        onClick={handleStamp}
        disabled={!ready || loading}
        variant={mode === "clock_in" ? "primary" : "secondary"}
      >
        {loading ? "認証中…" : mode === "clock_in" ? "出勤打刻" : "退勤打刻"}
      </Button>

      <p className="text-center text-xs text-slate-500">
        22時以降の勤務は時給1.25倍で計算されます
      </p>
    </div>
  );
}
