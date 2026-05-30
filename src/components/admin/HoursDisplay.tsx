import { formatActualHours, formatPayrollHours } from "@/lib/format";

type Props = {
  actualHours: number;
  payrollHours: number;
};

/** 実勤務時間と給与計算時間（30分切り捨て後）を並べて表示 */
export function HoursDisplay({ actualHours, payrollHours }: Props) {
  return (
    <div className="space-y-0.5 text-xs leading-relaxed sm:text-sm">
      <p>
        <span className="text-slate-500">実勤務：</span>
        {formatActualHours(actualHours)}
      </p>
      <p>
        <span className="text-slate-500">給与計算：</span>
        <span className="font-medium text-slate-900">{formatPayrollHours(payrollHours)}</span>
      </p>
    </div>
  );
}
