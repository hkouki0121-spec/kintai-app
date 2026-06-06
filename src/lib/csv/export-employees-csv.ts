import { formatJstDate } from "@/lib/format";
import type { EmployeeWithStore } from "@/types/database";

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadEmployeesCsv(employees: EmployeeWithStore[], filename = "employees.csv") {
  const headers = [
    "店舗名",
    "社員コード",
    "従業員名",
    "役職",
    "時給",
    "入社日",
    "ステータス",
  ];

  const rows = employees.map((emp) => [
    emp.stores?.name ?? "",
    emp.employee_code,
    emp.name,
    emp.job_title ?? "",
    String(emp.hourly_rate),
    formatJstDate(emp.created_at),
    emp.is_active ? "在籍中" : "無効",
  ]);

  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
