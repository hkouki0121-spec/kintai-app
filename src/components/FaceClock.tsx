"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clockIn, clockOut } from "@/lib/attendance/clock";
import { notifyLineAttendance } from "@/lib/attendance/notify-line";
import { createKioskClient, getSupabaseAuthRole } from "@/lib/supabase/kiosk-client";
import type { IdentifiedEmployee } from "@/lib/face/recognition";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";

type Mode = "clock_in" | "clock_out";

type EmployeeRow = {
  id: string;
  name: string;
  store_id: string;
  face_descriptor: number[] | null;
};

function isCameraPermissionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.name === "NotAllowedError" ||
    err.name === "PermissionDeniedError" ||
    err.name === "NotFoundError" ||
    err.name === "NotReadableError"
  );
}

export function FaceClock() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceApiRef = useRef<typeof import("@/lib/face/recognition") | null>(null);
  const cameraReadyRef = useRef(false);
  const [mode, setMode] = useState<Mode>("clock_in");
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [overlayHint, setOverlayHint] = useState("顔をカメラに向けてください");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const supabase = useMemo(() => createKioskClient(), []);

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
    setOverlayHint("顔をカメラに向けてください");
  }, []);

  const loadModels = useCallback(async () => {
    if (!faceApiRef.current) {
      faceApiRef.current = await import("@/lib/face/recognition");
    }
    await faceApiRef.current.loadFaceModels();
    setModelsReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadEmployees = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, store_id, face_descriptor")
        .eq("is_active", true);
      const rows = ((data as EmployeeRow[]) ?? []).filter(
        (e) => e.face_descriptor && e.face_descriptor.length > 0
      );
      if (!cancelled) setEmployees(rows);
    };

    const init = async () => {
      await loadEmployees();
      try {
        await startCamera();
        if (cancelled) return;
        setMessage(null);
        try {
          await loadModels();
          if (!cancelled) setMessage(null);
        } catch {
          if (!cancelled && cameraReadyRef.current) {
            setMessage({
              type: "error",
              text: "顔認識モデルの読み込みに失敗しました。ページを再読み込みしてお試しください。",
            });
          }
        }
      } catch (err) {
        if (cancelled || cameraReadyRef.current) return;
        setMessage({
          type: "error",
          text: isCameraPermissionError(err)
            ? "カメラを使用できません。ブラウザのカメラ権限を許可してください。"
            : `カメラの起動に失敗しました: ${err instanceof Error ? err.message : String(err)}`,
        });
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
  }, [startCamera, loadModels, supabase]);

  useEffect(() => {
    setMessage(null);
    setOverlayHint("顔をカメラに向けてください");
  }, [mode]);

  /** 顔認証後に出勤 INSERT のみ実行 */
  const runClockIn = async (identified: IdentifiedEmployee, storeId: string) => {
    const now = new Date().toISOString();
    await clockIn(supabase, {
      employeeId: identified.employeeId,
      storeId,
      clockIn: now,
    });
    notifyLineAttendance({
      type: "clock_in",
      employeeId: identified.employeeId,
      storeId,
      employeeName: identified.name,
      timestamp: now,
    });
    setMessage({ type: "success", text: `${identified.name} さん 出勤しました` });
  };

  /** 顔認証後に退勤 UPDATE のみ実行（INSERT しない） */
  const runClockOut = async (identified: IdentifiedEmployee, storeId: string) => {
    const now = new Date().toISOString();
    await clockOut(supabase, {
      employeeId: identified.employeeId,
      clockOut: now,
    });
    notifyLineAttendance({
      type: "clock_out",
      employeeId: identified.employeeId,
      storeId,
      employeeName: identified.name,
      timestamp: now,
    });
    setMessage({ type: "success", text: `${identified.name} さん 退勤しました` });
  };

  const handleClockIn = () => handleStamp("clock_in");
  const handleClockOut = () => handleStamp("clock_out");

  const handleStamp = async (action: Mode) => {
    if (!videoRef.current || !faceApiRef.current || processing) return;

    if (!cameraReady) {
      setMessage({ type: "error", text: "カメラ映像が準備できていません。" });
      return;
    }
    if (!modelsReady) {
      setMessage({
        type: "error",
        text: "顔認識モデルが読み込まれていません。ページを再読み込みしてください。",
      });
      return;
    }
    if (employees.length === 0) {
      setMessage({
        type: "error",
        text: "顔登録済みの従業員がいません。管理者に顔登録を依頼してください。",
      });
      return;
    }

    setProcessing(true);
    setMessage(null);
    setOverlayHint("認証中...");

    try {
      const scan = await faceApiRef.current.scanSingleFace(videoRef.current);

      if (scan.status === "no_face") {
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "顔を検出できません。明るい場所で正面を向けてください。",
        });
        return;
      }

      if (scan.status === "multiple_faces") {
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人でカメラの前に立ってください。",
        });
        return;
      }

      const identified = faceApiRef.current.identifyEmployee(scan.descriptor, employees);

      if (!identified) {
        setOverlayHint("顔をカメラに向けてください");
        setMessage({ type: "error", text: "登録済みの従業員と一致しません" });
        return;
      }

      const matchedEmployee = employees.find((e) => e.id === identified.employeeId);
      if (!matchedEmployee) {
        setMessage({ type: "error", text: "登録済みの従業員と一致しません" });
        return;
      }

      setOverlayHint("認証成功");

      const jwtRole = await getSupabaseAuthRole(supabase);
      if (process.env.NODE_ENV === "development") {
        console.debug(`[FaceClock] supabase JWT role: ${jwtRole}`);
      }

      try {
        if (action === "clock_in") {
          await runClockIn(identified, matchedEmployee.store_id);
        } else {
          await runClockOut(identified, matchedEmployee.store_id);
        }
      } catch (e) {
        if (!(e instanceof Error)) throw e;

        if (e.message === "ALREADY_CLOCKED_IN") {
          setOverlayHint("顔をカメラに向けてください");
          setMessage({
            type: "error",
            text: `${identified.name} さんは既に出勤中です。退勤を選んで打刻してください。`,
          });
          return;
        }
        if (e.message === "NO_OPEN_RECORD") {
          setOverlayHint("顔をカメラに向けてください");
          setMessage({
            type: "error",
            text: `${identified.name} さんの出勤記録がありません。`,
          });
          return;
        }
        throw e;
      }

      setOverlayHint("顔をカメラに向けてください");
    } catch (e) {
      setOverlayHint("顔をカメラに向けてください");
      const err = e as Error & { name?: string };
      if (err.name === "FacePipelineError") {
        setMessage({ type: "error", text: err.message });
      } else {
        setMessage({
          type: "error",
          text: err.message || "打刻に失敗しました。",
        });
      }
    } finally {
      setProcessing(false);
    }
  };

  const canStamp = cameraReady && modelsReady && !processing;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-8 sm:p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">勤怠打刻</h1>
        <p className="mt-1 text-sm text-slate-600">顔認証で出勤・退勤を記録します</p>
      </header>

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("clock_in")}
          disabled={processing}
          className={`flex-1 rounded-lg py-3.5 text-sm font-semibold transition-colors ${
            mode === "clock_in" ? "bg-white text-blue-700 shadow" : "text-slate-600"
          }`}
        >
          出勤
        </button>
        <button
          type="button"
          onClick={() => setMode("clock_out")}
          disabled={processing}
          className={`flex-1 rounded-lg py-3.5 text-sm font-semibold transition-colors ${
            mode === "clock_out" ? "bg-white text-blue-700 shadow" : "text-slate-600"
          }`}
        >
          退勤
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="relative aspect-[3/4] max-h-[min(70vh,520px)] bg-slate-900 sm:aspect-[4/3]">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            style={{ transform: "scaleX(-1)" }}
          />
          {!cameraReady && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              カメラを起動中…
            </div>
          )}
          {cameraReady && (
            <>
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/40" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-12 text-center">
                <p className="text-base font-semibold text-white">
                  {processing ? "認証中..." : !modelsReady ? "モデルを読み込み中…" : overlayHint}
                </p>
              </div>
            </>
          )}
        </div>
      </Card>

      {message && <Alert type={message.type}>{message.text}</Alert>}

      {mode === "clock_in" ? (
        <Button
          fullWidth
          onClick={handleClockIn}
          disabled={!canStamp}
          className="py-4 text-base"
        >
          {processing ? "認証中..." : "出勤する"}
        </Button>
      ) : (
        <Button
          fullWidth
          onClick={handleClockOut}
          disabled={!canStamp}
          variant="secondary"
          className="py-4 text-base"
        >
          {processing ? "認証中..." : "退勤する"}
        </Button>
      )}

      <p className="text-center text-xs leading-relaxed text-slate-500">
        お一人で正面を向けてください。顔認証に成功した場合のみ打刻されます。
        <br />
        22時以降の勤務は時給1.25倍で計算されます。
      </p>
    </div>
  );
}
