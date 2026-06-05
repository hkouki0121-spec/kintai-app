function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** レコード配列を UTF-8 BOM 付き CSV 文字列に変換 */
export function recordsToCsv(rows: Record<string, unknown>[]): string {
  const bom = "\uFEFF";
  if (rows.length === 0) {
    return bom;
  }

  const headers = Object.keys(rows[0]);
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(",")),
  ];

  return bom + lines.join("\n");
}
