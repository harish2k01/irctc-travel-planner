"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Home, LogOut, Plus, Settings, Ticket as TicketIcon, TrainFront, X } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import type { Ticket } from "@/lib/types";
import type { Preferences, NotificationPage } from "@/lib/workspace-types";
import { WorkspaceContext } from "./context";
import { Button, IconButton } from "./ui";
import { TripPanel, TripForm } from "./trip-panel";
import { NoticeList } from "./notifications";
import { useResource } from "./resource";
import s from "./workspace.module.css";

const NAV = [{ href: "/today", label: "Today", icon: Home }, { href: "/trips", label: "Trips", icon: TicketIcon }, { href: "/calendar", label: "Calendar", icon: CalendarDays }, { href: "/settings", label: "Settings", icon: Settings }];

export function WorkspaceShell({ initialPreferences, children }: { initialPreferences: Preferences; children: React.ReactNode }) {
  const router = useRouter(), pathname = usePathname(), params = useSearchParams();
  const [preferences, setPreferences] = useState(initialPreferences);
  const [revision, setRevision] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [draft, setDraft] = useState<{ seed?: Partial<Ticket> }>();
  const [toast, setToast] = useState("");
  const notificationRef = useRef<HTMLDivElement>(null), bellRef = useRef<HTMLButtonElement>(null);
  const notices = useResource<NotificationPage>("/api/notifications", revision);
  const unread = notices.data?.unreadCount;
  const tripId = params.get("trip");
  const refresh = () => setRevision((value) => value + 1);
  useEffect(() => {
    const refreshData = () => { if (!document.hidden) setRevision((value) => value + 1); };
    const timer = setInterval(refreshData, 60000);
    window.addEventListener("focus", refreshData);
    return () => { clearInterval(timer); window.removeEventListener("focus", refreshData); };
  }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(""), 5000); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const outside = (event: PointerEvent) => { if (!notificationRef.current?.contains(event.target as Node)) setNotificationsOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setNotificationsOpen(false); bellRef.current?.focus(); } };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [notificationsOpen]);
  function closeTrip() { const query = new URLSearchParams(params); query.delete("trip"); router.replace(`${pathname}${query.size ? `?${query}` : ""}`, { scroll: false }); }
  function openTrip(id: string) { setNotificationsOpen(false); const query = new URLSearchParams(params); query.set("trip", id); router.push(`${pathname}?${query}`, { scroll: false }); }
  function addTrip(seed?: Partial<Ticket>) { setDraft({ seed }); setNotificationsOpen(false); }
  async function logout() {
    try { await apiRequest("/api/auth/logout", { method: "POST" }); router.replace("/"); router.refresh(); }
    catch (error) { setToast(error instanceof Error ? error.message : "Unable to log out."); }
  }
  return <WorkspaceContext.Provider value={{ preferences, setPreferences, revision, refresh, notify: setToast, openTrip, addTrip, logout }}>
    <div className={`${s.root} ${collapsed ? s.collapsed : ""}`}>
      <a href="#workspace-content" className={s.skipLink}>Skip to content</a>
      <aside className={s.sidebar}>
        <div className={s.brand}><span className={s.brandMark}><TrainFront size={21} /></span>{!collapsed && <div className={s.brandName}>IRCTC Travel Planner<span>Ticket tracker</span></div>}<IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}</IconButton></div>
        <nav className={s.nav} aria-label="Primary navigation">{NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? s.navActive : ""} aria-current={pathname === href ? "page" : undefined} title={collapsed ? label : undefined}><Icon size={18} /><span className={collapsed ? "sr-only" : ""}>{label}</span></Link>)}</nav>
        <div className={s.sidebarFooter}>{!collapsed && <div className={s.identity}><span className={s.avatar}>{(preferences.name || preferences.email).slice(0, 2).toUpperCase()}</span><div><strong>{preferences.name || "Your workspace"}</strong><small>{preferences.email}</small></div></div>}<Button variant="quiet" onClick={logout} aria-label="Log out"><LogOut size={16} />{!collapsed && "Log out"}</Button></div>
      </aside>
      <div className={s.workspace}>
        <header className={s.topbar}><div className={s.topbarTitle}><span className={s.mobileBrand}><span className={s.brandMark}><TrainFront size={18} /></span></span><h1>{NAV.find((item) => item.href === pathname)?.label ?? "Notifications"}</h1></div>
          <div className={s.topbarActions}><Button variant="primary" onClick={() => addTrip()}><Plus />Add trip</Button><div className={s.notificationWrap} ref={notificationRef}>
            <button ref={bellRef} className={`${s.button} ${s.quiet} ${s.iconButton} ${s.bell}`} aria-label={`Notifications${unread !== undefined ? `, ${unread} unread` : ""}`} aria-expanded={notificationsOpen} aria-controls="notifications" onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell size={18} />{Boolean(unread) && <span className={s.bellCount}>{unread! > 99 ? "99+" : unread}</span>}</button>
            {notificationsOpen && <section id="notifications" className={s.popover} role="dialog" aria-label="Notifications"><div className={s.popoverHead}><h3>Notifications</h3><IconButton label="Close notifications" onClick={() => setNotificationsOpen(false)}><X /></IconButton></div>{notices.error ? <p role="alert" className={s.errorMessage}>{notices.error}<Button onClick={refresh}>Retry</Button></p> : notices.loading ? <p className={s.dialogBody} role="status">Loading notifications...</p> : <NoticeList items={notices.data?.items.slice(0, 4) ?? []} />}<Link className={`${s.button} ${s.quiet} ${s.fullWidth}`} href="/notifications" onClick={() => setNotificationsOpen(false)}>All notifications<ChevronRight size={14} /></Link></section>}
          </div></div>
        </header>
        <main id="workspace-content" className={s.content}>{children}</main>
      </div>
      <nav className={s.mobileNav} aria-label="Mobile navigation">{NAV.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={pathname === href ? s.navActive : ""} aria-current={pathname === href ? "page" : undefined}><Icon size={19} />{label}</Link>)}</nav>
      {tripId && !draft && <TripPanel key={tripId} id={tripId} onClose={closeTrip} />}
      {draft && <TripForm seed={draft.seed} onClose={() => setDraft(undefined)} onSaved={(trip) => { setDraft(undefined); refresh(); openTrip(trip.id); }} />}
      {toast && <div className={s.toast} role="status"><Check size={16} />{toast}</div>}
    </div>
  </WorkspaceContext.Provider>;
}
