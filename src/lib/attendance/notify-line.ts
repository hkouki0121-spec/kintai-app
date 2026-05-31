import type { AttendanceNotifyType } from "@/lib/line/build-attendance-message";

export type NotifyLineAttendanceParams = {
  type: AttendanceNotifyType;
  employeeId: string;
  storeId: string;
  employeeName: string;
  timestamp: string;
};

/** 打刻成功後に LINE 通知 API を呼ぶ（失敗しても打刻結果に影響しない） */
export function notifyLineAttendance(params: NotifyLineAttendanceParams): void {
  void fetch("/api/notify/line", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch((error) => {
    console.error("[notifyLineAttendance]", error);
  });
}
