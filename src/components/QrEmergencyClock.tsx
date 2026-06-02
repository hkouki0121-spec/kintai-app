"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";

type Mode = "clock_in" | "clock_out";

type EmployeeOption = {
  id: string;
  name: string;
  store_id: string;
};

type Props = {
  mode: Mode;
  employees: EmployeeOption[];
  onClose: () => void;
  onSuccess: (message: string) => void;
};

type VerifiedStore = {
  storeId: string;
  storeName: string;
  token: string;
};

function readQrFromResult(raw: string): string {
  return raw.trim();
}

export function QrEmergencyClock({ mode, employees, onClose, onSuccess }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const [step, setStep] = useState<"scan" | "select">("scan");
  const [verifiedStore, setVerifiedStore] = useState<VerifiedStore | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [manualToken, setManualToken] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [supportsScanner, setSupportsScanner] = useState(false);

  const verifyToken = useCallback(async (rawToken: string) => {
    const token = readQrFromResult(rawToken);
    if (!token) {
      setError("QRコードの内容を読み取れませんでした");
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/qr-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        storeId?: string;
        storeName?: string;
        error?: string;
      };

      if (!res.ok || !data.storeId || !data.storeName) {
        setError("店舗QRコードが無効です。管理者に確認してください。");
        return;
      }

      setVerifiedStore({ storeId: data.storeId, storeName: data.storeName, token });
      setStep("select");
    } catch {
      setError("QRコードの検証に失敗しました");
    } finally {
      setProcessing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animationId = 0;

    const startScanner = async () => {
      if (typeof window === "undefined" || !("BarcodeDetector" in window)) {
        setSupportsScanner(false);
        return;
      }

      setSupportsScanner(true);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setScannerReady(true);

        const detector = new BarcodeDetector({ formats: ["qr_code"] });
        scanningRef.current = true;

        const scanLoop = async () => {
          if (cancelled || !scanningRef.current || !videoRef.current) return;

          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && codes[0].rawValue) {
              scanningRef.current = false;
              await verifyToken(codes[0].rawValue);
              return;
            }
          } catch {
            // ignore frame errors
          }

          animationId = window.requestAnimationFrame(() => {
            void scanLoop();
          });
        };

        void scanLoop();
      } catch {
        setSupportsScanner(false);
        setError("カメラを起動できません。手入力でQRトークンを入力してください。");
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      scanningRef.current = false;
      if (animationId) window.cancelAnimationFrame(animationId);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [verifyToken]);

  const storeEmployees = verifiedStore
    ? employees.filter((employee) => employee.store_id === verifiedStore.storeId)
    : [];

  const handleClock = async () => {
    if (!verifiedStore || !selectedEmployeeId) return;

    setProcessing(true);
    setError(null);
    try {
      const res = await fetch("/api/kiosk/qr-clock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: verifiedStore.token,
          employeeId: selectedEmployeeId,
          action: mode,
        }),
      });

      const data = (await res.json()) as {
        employeeName?: string;
        error?: string;
      };

      if (!res.ok) {
        if (data.error === "already_clocked_in") {
          setError("既に出勤中です。退勤を選んで打刻してください。");
        } else if (data.error === "no_open_record") {
          setError("出勤記録がありません。出勤を選んで打刻してください。");
        } else {
          setError("QR打刻に失敗しました");
        }
        return;
      }

      const label = mode === "clock_in" ? "出勤" : "退勤";
      onSuccess(`${data.employeeName ?? "従業員"} さん ${label}しました（QR打刻）`);
      onClose();
    } catch {
      setError("QR打刻に失敗しました");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">QR緊急打刻</h3>
            <p className="mt-1 text-sm text-slate-600">
              顔認証に失敗した場合のみ利用できます（{mode === "clock_in" ? "出勤" : "退勤"}）
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            閉じる
          </button>
        </div>

        {step === "scan" && (
          <div className="space-y-4">
            {supportsScanner ? (
              <div className="overflow-hidden rounded-xl bg-slate-900">
                <video ref={videoRef} className="aspect-video w-full object-cover" playsInline muted />
                {!scannerReady && (
                  <p className="py-8 text-center text-sm text-slate-500">カメラを起動中…</p>
                )}
              </div>
            ) : (
              <Alert type="info">
                この端末ではQRスキャンに対応していません。店舗QRのURLまたはトークンを入力してください。
              </Alert>
            )}

            <div>
              <label className="mb-1 block text-sm text-slate-600">QR URL / トークン（手入力）</label>
              <Input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="https://.../?storeQr=..."
              />
            </div>

            <Button
              type="button"
              fullWidth
              disabled={processing || !manualToken.trim()}
              onClick={() => void verifyToken(manualToken)}
            >
              {processing ? "確認中…" : "QRを確認"}
            </Button>
          </div>
        )}

        {step === "select" && verifiedStore && (
          <div className="space-y-4">
            <Alert type="success">店舗を確認しました: {verifiedStore.storeName}</Alert>

            <div>
              <label className="mb-1 block text-sm text-slate-600">従業員を選択</label>
              <select
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                value={selectedEmployeeId}
                onChange={(e) => setSelectedEmployeeId(e.target.value)}
              >
                <option value="">従業員を選択</option>
                {storeEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
              {storeEmployees.length === 0 && (
                <p className="mt-2 text-sm text-red-600">この店舗に登録された従業員がいません</p>
              )}
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="secondary" fullWidth onClick={() => setStep("scan")}>
                QRを読み直す
              </Button>
              <Button
                type="button"
                fullWidth
                disabled={processing || !selectedEmployeeId}
                onClick={() => void handleClock()}
              >
                {processing ? "打刻中…" : mode === "clock_in" ? "出勤する" : "退勤する"}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4">
            <Alert type="error">{error}</Alert>
          </div>
        )}
      </div>
    </div>
  );
}
