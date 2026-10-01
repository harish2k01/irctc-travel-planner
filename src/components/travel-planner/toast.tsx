"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import s from "./planner.module.css";

export function Toast({ message, dismiss, undo, error = false }: { message: string; dismiss: () => void; undo?: () => void; error?: boolean }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(dismiss, undo ? 8000 : error ? 9000 : 4500);
    return () => clearTimeout(timer);
  }, [dismiss, paused, undo, error]);
  return <div className={`${s.toast} ${error ? s.toastError : ""}`} role={error ? "alert" : "status"} aria-atomic="true" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}>
    <span className={s.toastIcon}>{error ? <CircleAlert size={19} /> : <Check size={19} />}</span><p>{message}</p>
    {undo && <button className={s.textButton} onClick={undo}>Undo</button>}
    <button className={s.iconButton} onClick={dismiss} aria-label="Dismiss notification"><X size={17} /></button>
  </div>;
}
