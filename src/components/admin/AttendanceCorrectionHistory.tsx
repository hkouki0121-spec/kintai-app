import type { AttendanceCorrection } from "@/types/database";
import { formatJstDateTime } from "@/lib/format";

type Props = {
  corrections: AttendanceCorrection[];
};

function formatChange(before: string | null, after: string | null): string | null {
  const beforeText = before ? formatJstDateTime(before) : "—";
  const afterText = after ? formatJstDateTime(after) : "—";
  if (before === after && before !== null) return null;
  return `${beforeText} → ${afterText}`;
}

export function AttendanceCorrectionHistory({ corrections }: Props) {
  if (corrections.length === 0) {
    return <p className="text-sm text-slate-500">修正履歴はありません</p>;
  }

  return (
    <ul className="space-y-3">
      {corrections.map((item) => {
        const clockInChange = formatChange(item.before_clock_in, item.after_clock_in);
        const clockOutChange = formatChange(item.before_clock_out, item.after_clock_out);
        const adminLabel = item.corrected_by_email ?? "管理者";

        return (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-slate-900">{adminLabel}</span>
              <span className="text-xs text-slate-500">{formatJstDateTime(item.created_at)}</span>
            </div>
            <p className="mt-2 text-slate-700">理由: {item.reason}</p>
            {clockInChange && <p className="mt-1 text-slate-600">出勤: {clockInChange}</p>}
            {clockOutChange && <p className="mt-1 text-slate-600">退勤: {clockOutChange}</p>}
          </li>
        );
      })}
    </ul>
  );
}
