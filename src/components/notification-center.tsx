"use client";

import { Bell, CheckCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import type { NotificationItem } from "@/lib/types";

function message(item: NotificationItem) {
  if (item.type === "SEVEN_DAYS_BEFORE") return "Booking opens in 7 days";
  if (item.type === "ONE_DAY_BEFORE") return "Booking opens tomorrow";
  return "Booking is open";
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    apiRequest<NotificationItem[]>("/api/notifications")
      .then((data) => {
        setItems(data);
        setUnread(data.filter((item) => !item.readAt).length);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function markRead(ids?: string[]) {
    await apiRequest("/api/notifications", {
      method: "PATCH",
      body: JSON.stringify(ids ? { ids } : { all: true }),
    });
    const selected = new Set(ids);
    setItems((current) => current.map((item) => (!ids || selected.has(item.id)) ? { ...item, readAt: new Date().toISOString() } : item));
    setUnread((current) => ids ? Math.max(0, current - ids.length) : 0);
  }

  async function openTicket(item: NotificationItem) {
    if (!item.readAt) await markRead([item.id]);
    setOpen(false);
    router.push(`/tracker?ticket=${encodeURIComponent(item.ticketId)}`);
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={unread ? `${unread} unread booking reminders` : "Booking reminders"}
        aria-expanded={open}
        className="relative grid h-9 w-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && (
        <section className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl" aria-label="Booking reminders">
          <header className="flex h-11 items-center justify-between border-b border-slate-200 px-3">
            <h2 className="text-sm font-semibold">Booking reminders</h2>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button type="button" onClick={() => markRead()} title="Mark all as read" className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100">
                  <CheckCheck className="h-4 w-4" aria-hidden />
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} title="Close" className="grid h-8 w-8 place-items-center rounded-md text-slate-600 hover:bg-slate-100">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </header>
          <div className="max-h-[28rem] overflow-y-auto p-2">
            {items.length === 0 ? (
              <p className="px-2 py-8 text-center text-sm text-slate-500">No reminders yet.</p>
            ) : items.map((item) => (
              <button key={item.id} type="button" onClick={() => openTicket(item)} className={`mb-1 w-full rounded-md border p-3 text-left hover:border-slate-300 hover:bg-slate-50 ${item.readAt ? "border-slate-200" : "border-blue-200 bg-blue-50/50"}`}>
                <span className="flex items-center justify-between gap-3">
                  <strong className="text-sm">{item.route}</strong>
                  {!item.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                </span>
                <span className="mt-1 block text-sm text-slate-600">{message(item)}</span>
                <span className="mt-2 block text-xs text-slate-500">Travel {new Date(`${item.travelDate}T00:00:00Z`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
