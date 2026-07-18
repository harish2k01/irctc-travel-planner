"use client";

import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Home, LogOut, MapPin, Menu, Plus, Settings, Ticket, TrainFront, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/client-api";
import { NotificationCenter } from "@/components/notification-center";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Home },
  { href: "/planner", label: "Planner", icon: Plus },
  { href: "/tracker", label: "Tracker", icon: Ticket },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/holidays", label: "Holidays", icon: MapPin },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings, admin: true },
];

export function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const active = navigation.find((item) => pathname.startsWith(item.href));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setCollapsed(localStorage.getItem("sidebar-collapsed") === "true"));
    return () => cancelAnimationFrame(frame);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      localStorage.setItem("sidebar-collapsed", String(!value));
      return !value;
    });
  }

  async function logout() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    window.location.assign("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
      <aside className={`fixed inset-y-0 left-0 z-40 flex border-r border-slate-200 bg-white transition-[width,transform] duration-200 ${collapsed ? "w-16" : "w-64"} ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-950 text-white"><TrainFront className="h-5 w-5" aria-hidden /></div>
            {!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">IRCTC Travel Planner</div><div className="text-xs text-slate-500">Ticket tracker</div></div>}
            {!collapsed && <button type="button" onClick={() => setMobileOpen(false)} className="grid h-8 w-8 place-items-center rounded-md lg:hidden" aria-label="Close navigation"><X className="h-4 w-4" /></button>}
            <button type="button" onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="hidden h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 lg:grid">
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="flex-1 space-y-1 overflow-y-auto p-2" aria-label="Primary navigation">
            {navigation.filter((item) => !item.admin || user.role === "ADMIN").map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link key={item.href} href={item.href} aria-current={isActive ? "page" : undefined} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined} className={`flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium ${isActive ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="border-t border-slate-200 p-2">
            {!collapsed && <div className="mb-2 truncate rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600"><span className="block">Signed in</span><strong className="mt-0.5 block truncate text-slate-900">{user.email}</strong></div>}
            <button type="button" onClick={logout} title={collapsed ? "Log out" : undefined} className="flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-red-700 hover:bg-red-50">
              <LogOut className="h-4 w-4 shrink-0" aria-hidden />{!collapsed && "Log out"}
            </button>
          </div>
        </div>
      </aside>
      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-16" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur md:px-4">
          <button type="button" onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-md border border-slate-200 lg:hidden" aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
          <h1 className="min-w-0 flex-1 truncate text-xl font-semibold">{active?.label ?? "IRCTC Travel Planner"}</h1>
          <NotificationCenter />
        </header>
        <main className="p-3 md:p-4">{children}</main>
      </div>
    </div>
  );
}
