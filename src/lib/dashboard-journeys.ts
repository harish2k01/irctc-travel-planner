import {bookingDay,bookingInstant,todayIST,type Planner} from "./travel-planner";
export function dashboardJourneys(planner:Planner,now:Date){
 const today=todayIST(now),active=planner.journeys.filter(j=>!j.archivedAt);
 const upcoming=active.filter(j=>j.date>=today&&(j.status==="booked"||(j.status==="needs_booking"&&bookingInstant(j)<=now))).sort((a,b)=>a.date.localeCompare(b.date));
 const bookable=upcoming.filter(j=>j.status==="needs_booking"),booked=upcoming.filter(j=>j.status==="booked");
 const cancelling=active.filter(j=>j.status==="cancellation_needed").sort((a,b)=>a.date.localeCompare(b.date));
 const bookingSoon=active.filter(j=>j.date>=today&&j.status==="needs_booking"&&bookingInstant(j)>now).sort((a,b)=>bookingDay(a).localeCompare(bookingDay(b)));
 const attention=[...bookable.map(j=>({j,label:"Booking Is Open",kind:"booking" as const})),...cancelling.map(j=>({j,label:"Cancellation To Confirm",kind:"cancellation" as const}))];
 return {upcoming,bookable,booked,cancelling,bookingSoon,attention};
}
