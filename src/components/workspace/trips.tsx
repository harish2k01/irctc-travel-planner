"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Bell, ChevronLeft, ChevronRight, Mail, MessageCircle, Plus, Search } from "lucide-react";
import type { TripPage } from "@/lib/workspace-types";
import { useWorkspace } from "./context";
import { useResource } from "./resource";
import { Badge, Button, Empty, IconButton, Route } from "./ui";
import { ErrorView, LoadingView } from "./today";
import { bookingLabel, CHANNELS, dateLabel, routeLabel, tripState } from "./format";
import s from "./workspace.module.css";

const icons = { email: Mail, discord: MessageCircle, inApp: Bell };
export function TripsScreen() {
  const router = useRouter(), params = useSearchParams();
  const { preferences, revision, refresh, openTrip, addTrip } = useWorkspace();
  const view = params.get("view") ?? "planned", q = params.get("q") ?? "", sort = params.get("sort") ?? "travel", page = params.get("page") ?? "1";
  const { data, error, loading } = useResource<TripPage>(`/api/workspace/trips?${new URLSearchParams({ view, q, sort, page })}`, revision);
  function navigate(values: Record<string, string>) { const next = new URLSearchParams(params); next.delete("trip"); next.set("page", "1"); for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); } router.replace(`/trips?${next}`, { scroll: false }); }
  return <>
    <div className={s.toolbar}><div className={s.tabs} role="group" aria-label="Trip view">{[["planned", "To book"], ["booked", "Booked"], ["history", "History"]].map(([key, label]) => <button key={key} aria-pressed={view === key} className={view === key ? s.tabActive : ""} onClick={() => navigate({ view: key })}>{label}{data && <small>{data.counts[key as keyof TripPage["counts"]]}</small>}</button>)}</div>
      <form className={s.toolbarFilters} onSubmit={(event) => { event.preventDefault(); navigate({ q: String(new FormData(event.currentTarget).get("q") ?? "") }); }}><label className={s.search}><Search size={14} /><input key={q} name="q" aria-label="Search trips" maxLength={120} placeholder="Station or note" defaultValue={q} /></label><Button type="submit" aria-label="Search"><Search /></Button><select className={s.sort} aria-label="Sort trips" value={sort} onChange={(event) => navigate({ sort: event.target.value })}><option value="travel">Travel date</option><option value="booking">Booking date</option></select></form>
    </div>
    {loading ? <LoadingView /> : error || !data ? <ErrorView error={error} retry={refresh} /> : data.tickets.length ? <>
      <div className={s.tableWrap}><table className={s.table}><thead><tr><th>Journey</th><th>Travel date</th><th>{view === "booked" ? "PNR" : "Est. booking opens"}</th><th>Reminders</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.tickets.map((trip) => <tr key={trip.id}><td><button className={s.rowLink} onClick={() => openTrip(trip.id)}><Route trip={trip} /><small>{trip.sourceCode} to {trip.destinationCode}{trip.journeyGroupId ? " | Return journey linked" : ""}</small></button></td><td>{dateLabel(trip.travelDate, true)}</td><td>{view === "booked" ? trip.pnrTagged ? `Ending ${trip.pnrLast4}` : "Not linked" : bookingLabel(trip.bookingOpensAt)}</td><td>{view === "planned" ? <div className={s.channelIcons}>{CHANNELS.filter(({ key }) => preferences.available[key]).map(({ key, field, label }) => { const Icon = icons[key]; return <span key={key} title={`${label}: ${trip[field] ? "on" : "off"}`} aria-label={`${label}: ${trip[field] ? "on" : "off"}`} className={trip[field] ? "" : s.channelOff}><Icon size={15} /></span>; })}</div> : <Badge tone={tripState(trip).tone}>{tripState(trip).label}</Badge>}</td><td><IconButton label={`Open ${routeLabel(trip)} on ${dateLabel(trip.travelDate)}`} onClick={() => openTrip(trip.id)}><ChevronRight /></IconButton></td></tr>)}</tbody></table></div>
      <div className={s.mobileTrips}>{data.tickets.map((trip) => <button key={trip.id} className={s.mobileTrip} onClick={() => openTrip(trip.id)}><div><Route trip={trip} /><ChevronRight size={16} /></div><div className={s.actionMeta}><span>Travel {dateLabel(trip.travelDate, true)}</span><Badge tone={tripState(trip).tone}>{tripState(trip).label}</Badge></div>{view === "planned" && <small>Est. booking {bookingLabel(trip.bookingOpensAt)}</small>}</button>)}</div>
      <footer className={s.pagination}><span>{(data.page - 1) * data.pageSize + 1}-{Math.min(data.page * data.pageSize, data.total)} of {data.total} trips</span><div className={s.paginationActions}><IconButton label="Previous page" disabled={data.page <= 1} onClick={() => navigate({ page: String(data.page - 1) })}><ChevronLeft /></IconButton><span>{data.page} / {Math.ceil(data.total / data.pageSize)}</span><IconButton label="Next page" disabled={data.page * data.pageSize >= data.total} onClick={() => navigate({ page: String(data.page + 1) })}><ChevronRight /></IconButton></div></footer>
    </> : <Empty title={q ? "No matching trips" : view === "booked" ? "No booked trips yet" : view === "history" ? "No past journeys" : "No trips to book"} action={q ? <Button onClick={() => navigate({ q: "" })}>Clear search</Button> : <Button onClick={() => addTrip()}><Plus />Add trip</Button>} />}
  </>;
}
