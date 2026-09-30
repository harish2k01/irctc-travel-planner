"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowRight, Check, Inbox, X } from "lucide-react";
import type { Ticket } from "@/lib/types";
import s from "./workspace.module.css";

export function Button({ children, variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "quiet" | "danger" }) {
  return <button type="button" {...props} className={`${s.button} ${s[variant]} ${className}`}>{children}</button>;
}
export function IconButton({ label, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <Button {...props} variant="quiet" aria-label={label} title={label} className={s.iconButton}>{children}</Button>;
}
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={`${s.badge} ${s[tone] ?? s.neutral}`}>{children}</span>;
}
export function Switch({ label, checked, onChange, disabled, description }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; description?: string }) {
  return <label className={s.switchRow}><span><span className={s.switchLabel}>{label}</span>{description && <small>{description}</small>}</span><input type="checkbox" role="switch" aria-label={label} checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className={s.switchTrack} aria-hidden="true"><span /></span></label>;
}
export function Route({ trip, codes = false }: { trip: Ticket; codes?: boolean }) {
  return <div className={s.route}><strong>{codes ? trip.sourceCode : trip.sourceName || trip.sourceCode}</strong><ArrowRight size={14} aria-hidden /><strong>{codes ? trip.destinationCode : trip.destinationName || trip.destinationCode}</strong></div>;
}
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return <div className={s.empty}><Inbox size={26} strokeWidth={1.5} aria-hidden /><h3>{title}</h3>{children && <p>{children}</p>}{action}</div>;
}
export function Dialog({ title, children, onClose, wide = false, panel = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; panel?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={`${s.dialog} ${wide ? s.wideDialog : ""} ${panel ? s.sidePanel : ""}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose(); } }}>
    <header className={s.dialogHeader}><h2 id={titleId}>{title}</h2><IconButton label="Close panel" onClick={onClose}><X size={18} /></IconButton></header>{children}
  </dialog>;
}
export function SavedNotice({ children }: { children: ReactNode }) {
  return <div className={s.savedNotice} role="status"><Check size={16} />{children}</div>;
}
