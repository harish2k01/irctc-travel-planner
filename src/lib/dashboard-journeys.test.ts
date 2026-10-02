import {expect,it} from "vitest";
import {dashboardJourneys} from "./dashboard-journeys";
import {EMPTY_PLANNER,journeySchema} from "./travel-planner";
const journey=(id:string,status:string,date="2026-12-01")=>journeySchema.parse({train:"",travelClass:"SL",windowDays:60,originOffset:0,departure:"22:00",pnr:"",notes:"",id,status,date,from:"A",to:"B"});
it("shows every actionable item but excludes unopened plans and cancellations from upcoming travel",()=>{
 const planner={...EMPTY_PLANNER,journeys:[journey("booked","booked"),journey("open","needs_booking"),journey("later","needs_booking","2026-12-03"),journey("cancel1","cancellation_needed"),journey("cancel2","cancellation_needed"),journey("cancelled","cancelled"),journey("past","booked","2026-10-01")]};
 const view=dashboardJourneys(planner,new Date("2026-10-02T02:30:00Z"));
 expect(view.upcoming.map(j=>j.id)).toEqual(["booked","open"]);
 expect(view.attention.map(item=>item.j.id)).toEqual(["open","cancel1","cancel2"]);
 expect(view.bookingSoon.map(j=>j.id)).toEqual(["later"]);
 expect(dashboardJourneys(planner,new Date("2026-10-02T02:29:59Z")).upcoming.map(j=>j.id)).toEqual(["booked"]);
});
