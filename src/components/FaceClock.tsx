"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { notifyLineAttendance } from "@/lib/attendance/notify-line";
import { hasRegisteredFace } from "@/lib/face/descriptors";
import { FACE_MATCH_MIN_RATE } from "@/lib/constants";
import { createKioskClient, getSupabaseAuthRole } from "@/lib/supabase/kiosk-client";
import type { MatchResult } from "@/lib/face/recognition";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { QrEmergencyClock } from "@/components/QrEmergencyClock";

type Mode = "clock_in" | "clock_out";

type EmployeeRow = {
  id: string;
  name: string;
  store_id: string;
  company_id: string;
  face_descriptor: unknown;
};

type StoreRow = {
  id: string;
  name: string;
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
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceApiRef = useRef<typeof import("@/lib/face/recognition") | null>(null);
  const cameraReadyRef = useRef(false);
  const [mode, setMode] = useState<Mode>("clock_in");
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [overlayHint, setOverlayHint] = useState("顔をカメラに向けてください");
  const [matchRate, setMatchRate] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [allEmployees, setAllEmployees] = useState<
    Pick<EmployeeRow, "id" | "name" | "store_id">[]
  >([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState(
    () => searchParams.get("store") ?? ""
  );
  const [faceAuthFailed, setFaceAuthFailed] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
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

    const loadStores = async () => {
      try {
        const response = await fetch("/api/kiosk/stores");
        const payload = (await response.json()) as {
          stores?: StoreRow[];
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) {
            setStores([]);
            setMessage({
              type: "error",
              text: "店舗一覧の取得に失敗しました。ページを再読み込みしてください。",
            });
          }
          return;
        }
        const rows = payload.stores ?? [];
        if (!cancelled) {
          setStores(rows);
          if (!selectedStoreId && rows.length === 1) {
            setSelectedStoreId(rows[0].id);
          }
          if (rows.length === 0) {
            setMessage({
              type: "error",
              text: "有効な店舗がありません。管理者画面で店舗を登録してください。",
            });
          }
        }
      } catch {
        if (!cancelled) {
          setStores([]);
          setMessage({
            type: "error",
            text: "店舗一覧の取得に失敗しました。通信環境を確認して再読み込みしてください。",
          });
        }
      }
    };

    const loadEmployees = async () => {
      if (!selectedStoreId) {
        if (!cancelled) {
          setEmployees([]);
          setAllEmployees([]);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/kiosk/face-roster?storeId=${encodeURIComponent(selectedStoreId)}`
        );
        const payload = (await response.json()) as {
          employees?: EmployeeRow[];
          error?: string;
        };
        if (!response.ok) {
          if (!cancelled) {
            setEmployees([]);
            setAllEmployees([]);
            setMessage({
              type: "error",
              text: "従業員一覧の取得に失敗しました。店舗を選び直すか再読み込みしてください。",
            });
          }
          return;
        }
        const data = payload.employees ?? [];
        const rows = data.filter((e) => hasRegisteredFace(e.face_descriptor));
        if (!cancelled) {
          setEmployees(rows);
          setAllEmployees(
            data.map((employee) => ({
              id: employee.id,
              name: employee.name,
              store_id: employee.store_id,
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setEmployees([]);
          setAllEmployees([]);
          setMessage({
            type: "error",
            text: "従業員一覧の取得に失敗しました。通信環境を確認して再読み込みしてください。",
          });
        }
      }
    };

    const init = async () => {
      await loadStores();
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
  }, [startCamera, loadModels, selectedStoreId]);

  useEffect(() => {
    setMessage(null);
    setMatchRate(null);
    setOverlayHint("顔をカメラに向けてください");
    setFaceAuthFailed(false);
    setShowQrModal(false);
  }, [mode]);

  const syncPayroll = async (employeeId: string) => {
    try {
      await fetch("/api/kiosk/sync-payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
    } catch {
      // 給与同期失敗は打刻成功を妨げない
    }
  };

  const postKioskClock = async (
    action: "clock_in" | "clock_out",
    employee: EmployeeRow
  ) => {
    const response = await fetch("/api/kiosk/clock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        employeeId: employee.id,
        storeId: employee.store_id,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "clock_failed");
    }
  };

  const runClockIn = async (identified: MatchResult, employee: EmployeeRow) => {
    const now = new Date().toISOString();
    await postKioskClock("clock_in", employee);
    void syncPayroll(identified.employeeId);
    notifyLineAttendance({
      type: "clock_in",
      employeeId: identified.employeeId,
      storeId: employee.store_id,
      employeeName: identified.name,
      timestamp: now,
    });
    setMessage({
      type: "success",
      text: `${identified.name} さん 出勤しました（一致率 ${identified.matchRate}%）`,
    });
  };

  const runClockOut = async (identified: MatchResult, employee: EmployeeRow) => {
    const now = new Date().toISOString();
    await postKioskClock("clock_out", employee);
    void syncPayroll(identified.employeeId);
    notifyLineAttendance({
      type: "clock_out",
      employeeId: identified.employeeId,
      storeId: employee.store_id,
      employeeName: identified.name,
      timestamp: now,
    });
    setMessage({
      type: "success",
      text: `${identified.name} さん 退勤しました（一致率 ${identified.matchRate}%）`,
    });
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
    if (!selectedStoreId) {
      setMessage({ type: "error", text: "打刻する店舗を選択してください。" });
      return;
    }
    if (employees.length === 0) {
      setMessage({
        type: "error",
        text: "顔写真が登録された従業員がいません。管理者に顔登録を依頼してください。",
      });
      return;
    }

    setProcessing(true);
    setMessage(null);
    setMatchRate(null);
    setFaceAuthFailed(false);
    setOverlayHint("認証中...");

    try {
      const scan = await faceApiRef.current.scanSingleFace(videoRef.current);

      if (scan.status === "no_face") {
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "もう一度正面を向いて撮影してください",
        });
        setFaceAuthFailed(true);
        return;
      }

      if (scan.status === "multiple_faces") {
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人でカメラの前に立ってください。",
        });
        setFaceAuthFailed(true);
        return;
      }

      const bestMatch = faceApiRef.current.findBestEmployeeMatch(scan.descriptor, employees);
      if (bestMatch) {
        setMatchRate(bestMatch.matchRate);
      }

      const identified = faceApiRef.current.identifyEmployee(scan.descriptor, employees);

      if (!identified) {
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: bestMatch
            ? `もう一度正面を向いて撮影してください（一致率 ${bestMatch.matchRate}% / 必要 ${FACE_MATCH_MIN_RATE}%以上）`
            : "もう一度正面を向いて撮影してください",
        });
        setFaceAuthFailed(true);
        return;
      }

      const matchedEmployee = employees.find((e) => e.id === identified.employeeId);
      if (!matchedEmployee) {
        setMessage({ type: "error", text: "登録済みの従業員と一致しません" });
        return;
      }

      setOverlayHint(`認証成功（一致率 ${identified.matchRate}%）`);

      const jwtRole = await getSupabaseAuthRole(supabase);
      if (process.env.NODE_ENV === "development") {
        console.debug(`[FaceClock] supabase JWT role: ${jwtRole}`);
      }

      try {
        if (action === "clock_in") {
          await runClockIn(identified, matchedEmployee);
        } else {
          await runClockOut(identified, matchedEmployee);
        }
      } catch (e) {
        if (!(e instanceof Error)) throw e;

        if (e.message === "ALREADY_CLOCKED_IN" || e.message === "ALREADY_CLOCKED_IN") {
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
      setFaceAuthFailed(true);
    } finally {
      setProcessing(false);
    }
  };

  const canStamp = cameraReady && modelsReady && !processing && !!selectedStoreId;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-8 sm:p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">勤怠打刻</h1>
        <p className="mt-1 text-sm text-slate-600">
          店舗を選び、顔認証（一致率{FACE_MATCH_MIN_RATE}%以上）で出勤・退勤を記録します
        </p>
      </header>

      <Card>
        <label className="mb-1 block text-sm font-medium text-slate-700">打刻店舗</label>
        <select
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          value={selectedStoreId}
          onChange={(e) => {
            setSelectedStoreId(e.target.value);
            setMessage(null);
            setFaceAuthFailed(false);
            setShowQrModal(false);
          }}
          disabled={processing}
        >
          <option value="">店舗を選択してください</option>
          {stores.map((store) => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </Card>

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
              {matchRate != null && (
                <div className="absolute left-4 top-4 rounded-lg bg-black/60 px-3 py-1.5 text-sm font-semibold text-white">
                  一致率 {matchRate}%
                </div>
              )}
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

      {faceAuthFailed && !showQrModal && (
        <Button
          type="button"
          variant="secondary"
          fullWidth
          onClick={() => setShowQrModal(true)}
          className="py-3"
        >
          QRコードで緊急打刻
        </Button>
      )}

      {showQrModal && (
        <QrEmergencyClock
          mode={mode}
          employees={allEmployees}
          onClose={() => setShowQrModal(false)}
          onSuccess={(text) => {
            setShowQrModal(false);
            setFaceAuthFailed(false);
            setMessage({ type: "success", text });
          }}
        />
      )}

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
        お一人で正面を向けてください。一致率{FACE_MATCH_MIN_RATE}%以上で打刻されます。
        <br />
        カメラの利用許可が必要です。
      </p>
    </div>
  );
}
