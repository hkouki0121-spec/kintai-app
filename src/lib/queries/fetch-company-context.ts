import type { CompanyContext } from "@/lib/auth/company-context";
import { perfLog } from "@/lib/perf/dev-logger";

export async function fetchCompanyContext(): Promise<CompanyContext> {
  perfLog("query-start", { key: "company-context" });
  const started = performance.now();
  const res = await fetch("/api/auth/company-context", { credentials: "include" });
  if (!res.ok) {
    throw new Error("Unauthorized");
  }
  const data = (await res.json()) as { context: CompanyContext };
  perfLog("query-complete", {
    key: "company-context",
    ms: Math.round(performance.now() - started),
  });
  return data.context;
}
