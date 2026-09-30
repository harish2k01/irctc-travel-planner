"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import type { NotificationItem } from "@/lib/types";
import type { NotificationPage } from "@/lib/workspace-types";
import { useWorkspace } from "./context";
import { useResource } from "./resource";
import { Button, Empty, IconButton } from "./ui";
import { bookingLabel, dateLabel } from "./format";
import { ErrorView, LoadingView } from "./today";
import s from "./workspace.module.css";

export function NoticeList({ items }: { items: NotificationItem[] }) {
  const { openTrip, refresh } = useWorkspace();
  const [busy, setBusy] = useState(""), [error, setError] = useState("");
  async function update(item: NotificationItem, snooze = false, open = false) {
    setBusy(item.id); setError("");
    try { await apiRequest("/api/notifications", { method: "PATCH", body: JSON.stringify({ ids: [item.id], ...(snooze ? { snoozeMinutes: 60 } : {}) }) }); refresh(); if (open) openTrip(item.ticketId); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to update notification."); }
    finally { setBusy(""); }
  }
  if (!items.length) return <Empty title="No reminders right now" />;
  return <>{error && <p role="alert" className={s.errorMessage}>{error}</p>}{items.map((item) => <div key={item.id} className={`${s.notice} ${item.readAt ? "" : s.noticeUnread}`}><span className={`${s.noticeDot} ${item.readAt ? s.noticeReadDot : ""}`} /><div className={s.noticeBody}><button disabled={busy === item.id} onClick={() => update(item, false, true)}><strong>{item.route}</strong><p>Booking {new Date(item.bookingOpensAt) <= new Date() ? "opened" : "opens"} {bookingLabel(item.bookingOpensAt)}</p><small>Travel {dateLabel(item.travelDate, true)}</small></button><div className={s.noticeActions}>{!item.readAt && <Button variant="quiet" disabled={busy === item.id} onClick={() => update(item)}>Mark read</Button>}<Button variant="quiet" disabled={busy === item.id} onClick={() => update(item, true)}><Clock3 size={12} />Snooze 1 hour</Button></div></div></div>)}</>;
}
export function NotificationsScreen() {
  const { revision, refresh } = useWorkspace();
  const [page, setPage] = useState(1), [busy, setBusy] = useState(false), [failure, setFailure] = useState("");
  const { data, error, loading } = useResource<NotificationPage>(`/api/notifications?page=${page}`, revision);
  async function readAll() {
    setBusy(true); setFailure("");
    try { await apiRequest("/api/notifications", { method: "PATCH", body: JSON.stringify({ all: true }) }); refresh(); }
    catch (e) { setFailure(e instanceof Error ? e.message : "Unable to mark notifications read."); }
    finally { setBusy(false); }
  }
  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView error={error} retry={refresh} />;
  return <div className={s.inboxList}><div className={s.sectionHead}><h2>{data.unreadCount} unread</h2><Button variant="quiet" disabled={busy || !data.unreadCount} onClick={readAll}><Check />Mark all read</Button></div>{failure && <p role="alert" className={s.errorMessage}>{failure}</p>}<NoticeList items={data.items} /><footer className={s.pagination}><span>{data.total} notifications</span><div className={s.paginationActions}><IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft /></IconButton><span>Page {page}</span><IconButton label="Next page" disabled={page * 20 >= data.total} onClick={() => setPage(page + 1)}><ChevronRight /></IconButton></div></footer></div>;
}
