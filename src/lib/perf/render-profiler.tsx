"use client";

import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";
import { perfLog } from "@/lib/perf/dev-logger";
import { recordPerfMetric } from "@/lib/perf/client-metrics";
import { countRender } from "@/lib/perf/render-counts";

type Props = {
  id: string;
  children: ReactNode;
};

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  countRender(id);
  if (process.env.NODE_ENV !== "development") return;
  const ms = Math.round(actualDuration * 10) / 10;
  perfLog("render-complete", { component: id, phase, ms });
  if (phase === "mount" || phase === "update") {
    recordPerfMetric(`render:${id}`, ms);
  }
};

/** React Profiler。回数は本番でも window.__ADMIN_RENDERS に記録する */
export function AdminRenderProfiler({ id, children }: Props) {
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
