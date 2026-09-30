"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";

export function useResource<T>(url: string | null, revision = 0) {
  const key = `${url}:${revision}`;
  const [state, setState] = useState<{ key: string; data?: T; error?: string }>();
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    apiRequest<T>(url, { cache: "no-store", signal: controller.signal }).then(
      (data) => setState({ key, data }),
      (error) => { if (!controller.signal.aborted) setState({ key, error: error instanceof Error ? error.message : "Unable to load this view." }); },
    );
    return () => controller.abort();
  }, [url, key]);
  return state?.key === key ? { ...state, loading: false } : { loading: Boolean(url), data: undefined, error: undefined };
}
