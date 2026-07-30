"use client";

import { Profiler, type ProfilerOnRenderCallback, type ReactNode } from "react";
import { perfLog } from "@/lib/perf/dev-logger";
import { recordPerfMetric } from "@/lib/perf/client-metrics";

type Props = {
  id: string;
  children: ReactNode;
};

const onRender: ProfilerOnRenderCallback = (id, phase, actualDuration) => {
  if (process.env.NODE_ENV !== "development") return;
  const ms = Math.round(actualDuration * 10) / 10;
  perfLog("render-complete", { component: id, phase, ms });
  if (phase === "mount" || phase === "update") {
    recordPerfMetric(`render:${id}`, ms);
  }
};

/** 開発環境のみ React Profiler で再レンダリングを計測 */
export function AdminRenderProfiler({ id, children }: Props) {
  if (process.env.NODE_ENV !== "development") {
    return children;
  }
  return (
    <Profiler id={id} onRender={onRender}>
      {children}
    </Profiler>
  );
}
