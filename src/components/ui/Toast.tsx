"use client";

import { useEffect } from "react";

type Props = {
  message: string;
  onClose: () => void;
  durationMs?: number;
};

export function Toast({ message, onClose, durationMs = 3000 }: Props) {
  useEffect(() => {
    const timer = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, onClose]);

  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white shadow-lg"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
