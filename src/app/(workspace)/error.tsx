"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function WorkspaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center rounded-md border border-red-200 bg-white p-6 text-center">
      <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden />
      <h2 className="mt-3 text-base font-semibold">This section could not be loaded</h2>
      <p className="mt-1 max-w-md text-sm text-slate-600">Retry the request. If it continues, use the request logs to investigate the failure.</p>
      <button type="button" onClick={reset} className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
        <RotateCcw className="h-4 w-4" aria-hidden /> Retry
      </button>
    </section>
  );
}
