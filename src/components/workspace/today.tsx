"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight, Clock3, Plus, TrainFront } from "lucide-react";
import type { Ticket } from "@/lib/types";
import type { Overview } from "@/lib/workspace-types";
import { useWorkspace } from "./context";
import { useResource } from "./resource";
import { Badge, Button, Empty, IconButton, Route } from "./ui";
import { bookingDay, bookingLabel, dateLabel, routeLabel } from "./format";
import s from "./workspace.module.css";

export function TodayScreen() {
  const { revision, refresh, openTrip, addTrip, preferences } = useWorkspace();
  const { data, error, loading } = useResource<Overview>("/api/workspace/today", revision);
  if (loading) return <LoadingView />;
  if (error || !data) return <ErrorView error={error} retry={refresh} />;
  const next = data.nextTrip;
  return <>
    <div className={s.intro}><div><p>{new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(data.today))}</p><h2>{data.attentionCount ? `${data.attentionCount} ${data.attentionCount === 1 ? "booking needs" : "bookings need"} attention` : "Your bookings are up to date"}</h2></div><span className={s.introMeta}><Clock3 size={14} />Booking times in IST</span></div>
    <div className={s.todayGrid}><div>
      <section><div className={s.sectionHead}><div className={s.sectionTitle}><h2>Needs attention</h2>{data.attentionCount > 0 && <Badge tone="attention">{data.attentionCount}</Badge>}</div><Link href="/trips?view=planned&sort=booking" className={`${s.button} ${s.quiet}`}>All trips<ArrowRight size={14} /></Link></div>
        {data.attention.length ? <div className={s.actionList}>{data.attention.map((trip) => <ActionRow key={trip.id} trip={trip} attention onOpen={() => openTrip(trip.id)} />)}</div> : <Empty title="Nothing needs booking right now" action={<Button onClick={() => addTrip()}><Plus />Add trip</Button>} />}
        {data.attentionCount > data.attention.length && <Link href="/trips?view=planned&sort=booking" className={`${s.button} ${s.quiet}`}>View all {data.attentionCount} open booking windows<ArrowRight size={14} /></Link>}
      </section>
      <section className={s.sectionSpace}><div className={s.sectionHead}><h2>Coming up</h2><small>Next booking windows</small></div>{data.upcoming.length ? <div className={s.actionList}>{data.upcoming.map((trip) => <ActionRow key={trip.id} trip={trip} onOpen={() => openTrip(trip.id)} />)}</div> : <Empty title="No upcoming booking windows" />}</section>
    </div><aside className={s.todayAside}>
      <section><div className={s.sectionHead}><h2>Your next journey</h2><TrainFront size={16} /></div>{next ? <div className={s.journeyTicket}><div className={s.ticketHead}><span>{dateLabel(next.travelDate, true)}</span><Badge tone="success">Booked</Badge></div><div className={s.ticketRoute}><Route trip={next} codes /><div className={s.ticketStations}><span>{next.sourceName}</span><span>{next.destinationName}</span></div><div className={s.ticketFoot}><div><small>Booking reference</small><strong>{next.pnrTagged ? `PNR ending ${next.pnrLast4}` : "PNR not linked"}</strong></div><IconButton label="Open next journey" onClick={() => openTrip(next.id)}><ArrowRight /></IconButton></div></div></div> : <Empty title="No booked journeys yet" />}</section>
      <section className={s.sectionSpace}><div className={s.sectionHead}><h2>Upcoming leave</h2><Link aria-label="Open calendar" className={`${s.button} ${s.quiet}`} href="/calendar"><ChevronRight size={16} /></Link></div><div className={s.sideList}>{data.holidays.length ? data.holidays.map((item) => <div key={item.id}><div><p>{item.name}</p><small>{item.type === "COMPANY" ? "Company" : "Personal leave"}</small></div><small>{dateLabel(item.date, true)}</small></div>) : <p className={s.inlineNote}>No upcoming leave.</p>}</div><p className={s.inlineNote}>Days off: {preferences.weekendDays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ") || "None"}</p></section>
    </aside></div>
  </>;
}

function ActionRow({ trip, attention = false, onOpen }: { trip: Ticket; attention?: boolean; onOpen: () => void }) {
  const parts = dateLabel(bookingDay(trip)).split(" ");
  return <div className={s.actionRow}><span className={s.dateTile}><small>{parts[1]}</small><strong>{parts[0]}</strong></span><div><button className={s.rowLink} onClick={onOpen}><Route trip={trip} /></button><div className={s.actionMeta}><span>Travel {dateLabel(trip.travelDate, true)}</span>{attention && <Badge tone="attention">Window open</Badge>}</div><p className={s.inlineNote}>Est. booking {bookingLabel(trip.bookingOpensAt)}</p></div><IconButton label={`View ${routeLabel(trip)} on ${dateLabel(trip.travelDate)}`} onClick={onOpen}><ChevronRight /></IconButton></div>;
}
export function LoadingView() { return <div role="status" className={s.skeleton}><p>Loading your workspace...</p>{[1, 2, 3].map((id) => <div key={id} />)}</div>; }
export function ErrorView({ error, retry }: { error?: string; retry: () => void }) { return <Empty title="Unable to load this view" action={<Button onClick={retry}>Try again</Button>}>{error || "Your saved data has not changed."}</Empty>; }
