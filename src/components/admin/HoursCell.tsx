import { formatActualHours, formatPayrollHours } from "@/lib/format";

type Props = {
  actualHours: number;
  payrollHours: number;
  label?: string;
};

/** 実勤務時間と給与計算時間を並べて表示 */
export function HoursCell({ actualHours, payrollHours, label }: Props) {
  return (
    <div className="min-w-[8rem] space-y-1 text-xs">
      {label && <p className="font-medium text-slate-500">{label}</p>}
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
