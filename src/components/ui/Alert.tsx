export function Alert({
  type = "info",
  children,
}: {
  type?: "info" | "success" | "error";
  children: React.ReactNode;
}) {
  const styles = {
    info: "bg-blue-50 text-blue-900 border-blue-200",
    success: "bg-emerald-50 text-emerald-900 border-emerald-200",
    error: "bg-red-50 text-red-900 border-red-200",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${styles[type]}`}>{children}</div>
  );
}
