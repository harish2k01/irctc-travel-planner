"use client";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import s from "./planner.module.css";
type Action = { label: string; onClick: () => void; disabled?: boolean; danger?: boolean };
export function ActionMenu({ label, actions, disabled = false }: { label: string; actions: Action[]; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return <div ref={root} className={s.actionMenu} onKeyDown={event => {
    if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    if (event.key === "Tab") setOpen(false);
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) && open) {
      event.preventDefault();
      const items = Array.from(root.current!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)'));
      const current = items.indexOf(document.activeElement as HTMLButtonElement);
      items[event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
    }
  }}>
    <button ref={trigger} type="button" className={s.secondary} aria-label={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}><MoreHorizontal size={18}/></button>
    {open && <div role="menu" aria-label={label} className={s.actionMenuItems}>{actions.map(action => <button key={action.label} type="button" role="menuitem" className={action.danger ? s.dangerAction : undefined} disabled={action.disabled} onClick={() => { setOpen(false); trigger.current?.focus(); action.onClick(); }}>{action.label}</button>)}</div>}
  </div>;
}
