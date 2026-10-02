"use client";
import {cloneElement,useEffect,useId,useRef,type ReactElement,type ReactNode} from "react";
import {X} from "lucide-react";
import s from "./planner.module.css";
/** Associates a form control with its generated label and optional help text. */
export function Field({ label, children, hint }: { label: string; children: ReactElement; hint?: string }) {
  const id = useId();
  return <div className={s.field}><label htmlFor={id}>{label}</label>{cloneElement(children as ReactElement<{ id: string; "aria-describedby"?: string }>, { id, "aria-describedby": hint ? `${id}-hint` : undefined })}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>;
}
/** Opens an accessible item dialog and closes it when dismissed or unmounted. */
export function Modal({ title, subtitle, children, close, wide = false }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const titleId=useId();const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return <dialog ref={ref} className={`${s.modal} ${wide ? s.wideModal : ""}`} onCancel={close} aria-labelledby={titleId} onClick={e => { if (e.target === e.currentTarget) close(); }}><header className={s.modalHead}><div><h2 id={titleId}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className={s.iconButton} onClick={close} aria-label="Close Dialog"><X size={20} /></button></header>{children}</dialog>;
}
