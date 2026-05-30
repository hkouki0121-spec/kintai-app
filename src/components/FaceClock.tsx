"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { IdentifiedEmployee } from "@/lib/face/recognition";
import { formatJstDateTime } from "@/lib/format";
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

type AuthState = "idle" | "verifying" | "verified" | "failed";

export function FaceClock() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceApiRef = useRef<typeof import("@/lib/face/recognition") | null>(null);
  const [mode, setMode] = useState<Mode>("clock_in");
  const [ready, setReady] = useState(false);
  const [authState, setAuthState] = useState<AuthState>("idle");
  const [verified, setVerified] = useState<IdentifiedEmployee | null>(null);
  const [stamping, setStamping] = useState(false);
  const [overlayHint, setOverlayHint] = useState("顔をカメラに向けてください");
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(
    null
  );
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const supabase = createClient();

  const resetAuth = useCallback(() => {
    setAuthState("idle");
    setVerified(null);
    setOverlayHint("顔をカメラに向けてください");
  }, []);

  const startCamera = useCallback(async () => {
    if (!faceApiRef.current) {
      faceApiRef.current = await import("@/lib/face/recognition");
    }
    await faceApiRef.current.loadFaceModels();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    setReady(true);
    setOverlayHint("顔をカメラに向けてください");
  }, []);

  useEffect(() => {
    const loadEmployees = async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, name, store_id, face_descriptor")
        .eq("is_active", true);
      const rows = ((data as EmployeeRow[]) ?? []).filter(
        (e) => e.face_descriptor && e.face_descriptor.length > 0
      );
      setEmployees(rows);
    };
    loadEmployees();
    startCamera().catch(() => {
      setMessage({
        type: "error",
        text: "カメラへのアクセスが拒否されました。ブラウザの設定を確認してください。",
      });
    });

    return () => {
      const stream = videoRef.current?.srcObject as MediaStream | undefined;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera, supabase]);

  useEffect(() => {
    resetAuth();
    setMessage(null);
  }, [mode, resetAuth]);

  const handleVerify = async () => {
    if (!videoRef.current || !ready || !faceApiRef.current) return;

    setAuthState("verifying");
    setMessage(null);
    setOverlayHint("認証中...");

    try {
      const scan = await faceApiRef.current.scanSingleFace(videoRef.current);

      if (scan.status === "no_face") {
        setAuthState("failed");
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "顔を検出できません。打刻できません。明るい場所で正面を向けてください。",
        });
        return;
      }

      if (scan.status === "multiple_faces") {
        setAuthState("failed");
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "複数の顔が検出されました。お一人でカメラを向けて打刻してください。",
        });
        return;
      }

      if (employees.length === 0) {
        setAuthState("failed");
        setMessage({
          type: "error",
          text: "顔登録済みの従業員がいません。管理者に顔登録を依頼してください。",
        });
        return;
      }

      const identified = faceApiRef.current.identifyEmployee(scan.descriptor, employees);

      if (!identified) {
        setAuthState("failed");
        setOverlayHint("顔をカメラに向けてください");
        setMessage({
          type: "error",
          text: "登録済みの従業員と一致しません。管理者に顔登録を依頼してください。",
        });
        return;
      }

      setVerified(identified);
      setAuthState("verified");
      setOverlayHint("認証成功");
      setMessage({
        type: "success",
        text: `認証成功 — ${identified.name} さん`,
      });
    } catch (e) {
      setAuthState("failed");
      setOverlayHint("顔をカメラに向けてください");
      setMessage({ type: "error", text: (e as Error).message || "認証に失敗しました。" });
    }
  };

  const handleStamp = async () => {
    if (!verified || authState !== "verified") return;

    const matchedEmployee = employees.find((e) => e.id === verified.employeeId);
    if (!matchedEmployee) return;

    setStamping(true);
    setMessage(null);

    try {
      const now = new Date().toISOString();

      if (mode === "clock_in") {
        const { data: open } = await supabase
          .from("attendance_records")
          .select("id")
          .eq("employee_id", verified.employeeId)
          .is("clock_out", null)
          .maybeSingle();

        if (open) {
          setMessage({
            type: "error",
            text: `${verified.name} さんはすでに出勤中です。退勤を選んで打刻してください。`,
          });
          return;
        }

        const { error } = await supabase.from("attendance_records").insert({
          employee_id: verified.employeeId,
          store_id: matchedEmployee.store_id,
          clock_in: now,
        });

        if (error) throw error;
        setMessage({
          type: "success",
          text: `出勤しました — ${verified.name} さん（${formatJstDateTime(now)}）`,
        });
      } else {
        const { data: record, error: fetchError } = await supabase
          .from("attendance_records")
          .select("id")
          .eq("employee_id", verified.employeeId)
          .is("clock_out", null)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!record) {
          setMessage({
            type: "error",
            text: `${verified.name} さんの出勤記録がありません。`,
          });
          return;
        }

        const { error } = await supabase
          .from("attendance_records")
          .update({ clock_out: now })
          .eq("id", record.id);

        if (error) throw error;
        setMessage({
          type: "success",
          text: `退勤しました — ${verified.name} さん（${formatJstDateTime(now)}）`,
        });
      }

      resetAuth();
    } catch (e) {
      setMessage({ type: "error", text: (e as Error).message || "打刻に失敗しました。" });
    } finally {
      setStamping(false);
    }
  };

  const canStamp = authState === "verified" && verified !== null && !stamping;
  const isVerifying = authState === "verifying";

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-8 sm:p-6">
      <header className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">勤怠打刻</h1>
        <p className="mt-1 text-sm text-slate-600">顔認証後に出勤・退勤できます</p>
      </header>

      <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("clock_in")}
          disabled={isVerifying || stamping}
          className={`flex-1 rounded-lg py-3.5 text-sm font-semibold transition-colors ${
            mode === "clock_in" ? "bg-white text-blue-700 shadow" : "text-slate-600"
          }`}
        >
          出勤
        </button>
        <button
          type="button"
          onClick={() => setMode("clock_out")}
          disabled={isVerifying || stamping}
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
          {!ready && (
            <div className="absolute inset-0 flex items-center justify-center text-white">
              カメラを起動中…
            </div>
          )}
          {ready && (
            <>
              <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-dashed border-white/40" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-4 pb-4 pt-12 text-center">
                <p className="text-base font-semibold text-white">{overlayHint}</p>
                {authState === "verified" && verified && (
                  <p className="mt-1 text-sm text-emerald-300">{verified.name} さん</p>
                )}
              </div>
            </>
          )}
        </div>
      </Card>

      {authState === "verified" && verified && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-800">認証成功</p>
          <p className="text-lg font-bold text-emerald-900">{verified.name} さん</p>
        </div>
      )}

      {message && <Alert type={message.type}>{message.text}</Alert>}

      <div className="flex flex-col gap-3">
        {authState !== "verified" && (
          <Button
            fullWidth
            onClick={handleVerify}
            disabled={!ready || isVerifying || stamping}
            className="py-4 text-base"
          >
            {isVerifying ? "認証中..." : "顔認証する"}
          </Button>
        )}

        <Button
          fullWidth
          onClick={handleStamp}
          disabled={!canStamp}
          variant={mode === "clock_in" ? "primary" : "secondary"}
          className="py-4 text-base"
        >
          {stamping
            ? "打刻中…"
            : mode === "clock_in"
              ? "出勤する"
              : "退勤する"}
        </Button>

        {authState === "verified" && (
          <Button
            fullWidth
            variant="ghost"
            onClick={resetAuth}
            disabled={stamping}
            className="text-sm"
          >
            別の人で認証し直す
          </Button>
        )}
      </div>

      <p className="text-center text-xs leading-relaxed text-slate-500">
        お一人で正面を向けてください。複数人が映る場合は打刻できません。
        <br />
        22時以降の勤務は時給1.25倍で計算されます。
      </p>
    </div>
  );
}
