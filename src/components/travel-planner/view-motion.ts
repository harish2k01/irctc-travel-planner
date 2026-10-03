"use client";
import { useEffect, useRef } from "react";

/** Fades a changed view without moving fixed overlays, remounting forms, or delaying interaction. */
export function animateView(element: HTMLElement | null): () => void {
  if (!element || typeof element.animate !== "function") return () => {};
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (preference.matches) return () => {};
  const animation = element.animate([{ opacity: 0.65 }, { opacity: 1 }], {
    duration: 160,
    easing: "ease-out",
  });
  const stop = () => animation.cancel();
  const changed = () => { if (preference.matches) stop(); };
  preference.addEventListener("change", changed);
  return () => { stop(); preference.removeEventListener("change", changed); };
}

/** Runs one cancellable transition when a view changes; ordinary renders leave it alone. */
export function useViewMotion<T extends HTMLElement>(view: string) {
  const ref = useRef<T>(null);
  useEffect(() => animateView(ref.current), [view]);
  return ref;
}
