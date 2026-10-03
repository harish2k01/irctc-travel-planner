import {logger} from "./logger";
import { createHash,randomUUID } from "node:crypto";
import { prisma } from "./db";
import { decryptSecret,encryptSecret } from "./crypto";
import { getFeaturePolicy } from "./settings";
import { applyAccountSettings,decodeWorkspace } from "./railwatch-store";
import { addDays,bookingDay,bookingClock,scheduledReminders,type Planner } from "./travel-planner";
import { getProviderConfiguration,googleConfigured } from "./provider-config";
/** Checks instance configuration before Google connection or synchronization. */
export async function googleReady(){return googleConfigured(await getProviderConfiguration());}
/** Returns the canonical Google OAuth callback URL. */
export function googleRedirect(){return new URL("/api/railwatch/google/callback",process.env.APP_URL).href;}
/** Builds deterministic calendar events for travel, booking dates, and time off. */
export function googleEvents(planner:Planner){
  const events:{id:string;summary:string;description:string;start:{date?:string;dateTime?:string;timeZone?:string};end:{date?:string;dateTime?:string;timeZone?:string};reminders:{useDefault:false;overrides:{method:"popup";minutes:number}[]}}[]=[];
  const /** Builds a stable provider event identifier for idempotent synchronization. */ id=(key:string)=>createHash("sha256").update(key).digest("hex");
  for(const j of planner.journeys){if(j.archivedAt||["skipped","cancelled","completed"].includes(j.status))continue;
    const summary=`${j.status==="cancellation_needed"?"Cancel ticket":"Train"}: ${j.from} → ${j.to}`;
    const dateTime=`${j.date}T${j.departure}:00+05:30`;
    events.push({id:id(`${j.id}:journey`),summary,description:[j.trainNumber,j.trainName,j.notes].filter(Boolean).join(" · "),start:j.departureConfirmed?{dateTime,timeZone:"Asia/Kolkata"}:{date:j.date},end:j.departureConfirmed?{dateTime:new Date(new Date(dateTime).getTime()+3600000).toISOString(),timeZone:"Asia/Kolkata"}:{date:addDays(j.date,1)},reminders:{useDefault:false,overrides:[]}});
    if(j.status==="needs_booking"){const dateTime=`${bookingDay(j)}T${bookingClock(j)}:00+05:30`;const overrides=scheduledReminders(planner,j).map(t=>({method:"popup" as const,minutes:Math.round((new Date(dateTime).getTime()-new Date(t).getTime())/60000)})).filter(r=>r.minutes>=0&&r.minutes<=40320).slice(0,5);
      events.push({id:id(`${j.id}:booking`),summary:`Book train: ${j.from} → ${j.to}`,description:`Travel date: ${j.date}. Booking date is based on your shared ${planner.settings.bookingWindowDays}-day window.`,start:{dateTime,timeZone:"Asia/Kolkata"},end:{dateTime:new Date(new Date(dateTime).getTime()+900000).toISOString(),timeZone:"Asia/Kolkata"},reminders:{useDefault:false,overrides}});
    }
  }
  for(const h of planner.holidays)events.push({id:id(`${h.id}:holiday`),summary:h.name,description:h.type==="company"?"Company holiday":"Personal leave",start:{date:h.date},end:{date:addDays(h.date,1)},reminders:{useDefault:false,overrides:[]}});
  return events;
}
/** Makes a bounded authenticated Google Calendar API call. */
export async function googleFetch(token:string,path:string,init?:RequestInit){const response=await fetch(`https://www.googleapis.com/calendar/v3${path}`,{...init,redirect:"error",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json",...init?.headers},signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Calendar request failed (${response.status}).`);return response.status===204?{}:response.json();}
/** Leases account calendars and incrementally synchronizes events without concurrent duplicate writes. */
export async function syncGoogleCalendars(){
  const policy=await getFeaturePolicy();const configuration=await getProviderConfiguration();const google=configuration.google;if(!policy.googleCalendarEnabled||!googleConfigured(configuration)||!google)return 0;const accounts=await prisma.railGoogle.findMany({where:{enabled:true,user:{isActive:true}},orderBy:{syncedAt:{sort:"asc",nulls:"first"}},take:50});let synced=0;
  for(const connection of accounts){const lease=randomUUID();const now=new Date();const claim=await prisma.railGoogle.updateMany({where:{userId:connection.userId,enabled:true,OR:[{leaseUntil:null},{leaseUntil:{lt:now}}]},data:{lease,leaseUntil:new Date(now.getTime()+300000)}});if(!claim.count)continue;
    try{
      const workspace=await prisma.railWorkspace.findUnique({where:{userId:connection.userId}});if(!workspace)continue;
      let tokens=JSON.parse(decryptSecret(connection.tokens)!);
      if(tokens.providerId!==google.id)throw new Error("Reconnect Google after configuration changes.");
      if(connection.calendarId&&!connection.lastError&&tokens.workspaceVersion===workspace.version)continue;
      if(!tokens.access_token||tokens.expiresAt<Date.now()+60000){const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:google.clientId,client_secret:google.clientSecret,refresh_token:tokens.refresh_token,grant_type:"refresh_token"}),signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error("Reconnect Google Calendar to renew access.");const fresh=await response.json();tokens={...tokens,...fresh,expiresAt:Date.now()+fresh.expires_in*1000};await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{tokens:encryptSecret(JSON.stringify(tokens))}});}
      let calendarId=connection.calendarId;if(!calendarId){const calendar=await googleFetch(tokens.access_token,"/calendars",{method:"POST",body:JSON.stringify({summary:"RailWatch",description:"Train journeys, booking reminders, and time off managed by RailWatch.",timeZone:"Asia/Kolkata"})});calendarId=String(calendar.id);await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{calendarId}});}
      const base=`/calendars/${encodeURIComponent(calendarId!)}/events`;const user=await prisma.user.findUniqueOrThrow({where:{id:connection.userId}});const events=googleEvents(applyAccountSettings(decodeWorkspace(workspace.payload),policy,user.phoneNumber??""));
      // Persist ownership before network writes. A partial sync can then be reconciled on retry.
      const owned=[...new Set([...connection.eventIds,...events.map(e=>e.id)])];await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{eventIds:owned}});
      tokens.eventHashes??={};let changes=0;
      for(const event of events){const hash=createHash("sha256").update(JSON.stringify({...event,status:"confirmed"})).digest("hex");if(tokens.eventHashes[event.id]===hash)continue;if(++changes>100)throw new Error("Calendar sync will continue in the next worker run.");const current=await prisma.railGoogle.findUnique({where:{userId:connection.userId},select:{lease:true,enabled:true}});if(!current?.enabled||current.lease!==lease)throw new Error("Calendar sync paused.");await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{leaseUntil:new Date(Date.now()+300000)}});const response=await fetch(`https://www.googleapis.com/calendar/v3${base}/${event.id}`,{method:"PUT",redirect:"error",headers:{Authorization:`Bearer ${tokens.access_token}`,"Content-Type":"application/json"},body:JSON.stringify(event),signal:AbortSignal.timeout(15000)});if(response.status===404){try{await googleFetch(tokens.access_token,base,{method:"POST",body:JSON.stringify(event)});}catch(e){if(!String(e).includes("409"))throw e;}}else if(!response.ok)throw new Error("Calendar update failed.");tokens.eventHashes[event.id]=hash;await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{tokens:encryptSecret(JSON.stringify(tokens))}});}
      for(const eventId of owned.filter(id=>!events.some(e=>e.id===id))){if(++changes>100)throw new Error("Calendar cleanup will continue next run.");const current=await prisma.railGoogle.findUnique({where:{userId:connection.userId},select:{lease:true,enabled:true}});if(!current?.enabled||current.lease!==lease)throw new Error("Calendar sync paused.");await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{leaseUntil:new Date(Date.now()+300000)}});const response=await fetch(`https://www.googleapis.com/calendar/v3${base}/${eventId}`,{method:"DELETE",redirect:"error",headers:{Authorization:`Bearer ${tokens.access_token}`},signal:AbortSignal.timeout(15000)});if(!response.ok&&![404,410].includes(response.status))throw new Error("Calendar cleanup failed.");}
      tokens.workspaceVersion=workspace.version;tokens.eventHashes=Object.fromEntries(events.map(e=>[e.id,tokens.eventHashes[e.id]]));
      await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{tokens:encryptSecret(JSON.stringify(tokens)),eventIds:events.map(e=>e.id),syncedAt:new Date(),lastError:null}});synced++;logger.info("google.sync_completed",{events:events.length});
    }catch(error){logger.error("google.sync_failed",{errorType:error instanceof Error?error.name:"UnknownError"});await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{lastError:"Calendar sync failed. Check your connection or reconnect Google."}});}finally{await prisma.railGoogle.updateMany({where:{userId:connection.userId,lease},data:{lease:null,leaseUntil:null}});}
  }return synced;
}
