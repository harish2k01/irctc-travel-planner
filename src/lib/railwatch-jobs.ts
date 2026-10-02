import { recordInAppReminder } from "./in-app-notifications";
import {logger} from "./logger";
import { pollTelegram } from "./telegram-polling";
import { getProviderConfiguration,telegramConfigured } from "./provider-config";
import {telegramBookingMessage} from "./message-templates";
import { sendTelegram } from "./telegram";
import { createHash,randomUUID } from "node:crypto";
import { encryptSecret } from "./crypto";
import { prisma } from "./db";
import { getFeaturePolicy } from "./settings";
import { applyAccountSettings,decodeWorkspace,loadWorkspace } from "./railwatch-store";
import { effectiveReminders,reminderPreview,todayIST,formatDay,bookingDay,type Planner } from "./travel-planner";
import { sendWhatsApp,whatsappReady } from "./railwatch-providers";
import { syncGoogleCalendars } from "./railwatch-google";
/** Builds durable reminder identities and due times from active journey preferences. */
export function reminderJobs(planner:Planner,now:Date){
  const result:{key:string;kind:string;dueAt:Date;journeyId:string;message:string}[]=[];
  for(const j of planner.journeys){if(j.archivedAt||j.status!=="needs_booking"||j.date<todayIST(now))continue;
    const pref=effectiveReminders(planner,j);
    for(const time of reminderPreview(j,pref.times,pref.clock)){const dueAt=new Date(time);if(dueAt.getTime()<now.getTime()-86400000)continue;
      const message=`Book your train from ${j.from} to ${j.to} for ${formatDay(j.date,{day:"numeric",month:"long",year:"numeric"})}. Booking opens ${formatDay(bookingDay(j))} at 8:00 AM IST.`;
      for(const kind of ["IN_APP",...(planner.settings.whatsappEnabled?["WHATSAPP"]:[]),...(planner.settings.telegramEnabled?["TELEGRAM"]:[])]){
        const identity=JSON.stringify([j.id,j.from,j.to,j.date,time,kind,kind==="WHATSAPP"?planner.settings.whatsappNumber:kind==="TELEGRAM"?[planner.settings.telegramProviderId,planner.settings.telegramChatId]:""]);
        result.push({key:createHash("sha256").update(identity).digest("hex"),kind,dueAt,journeyId:j.id,message});
      }
    }
  }return result;
}
/** Polls Telegram, refreshes workspaces, leases due reminders, and synchronizes calendars. */
export async function processRailWatch(now=new Date()){
  await pollTelegram();
  const policy=await getFeaturePolicy();const config=await getProviderConfiguration();const telegramProviderId=telegramConfigured(config)?config.telegram!.id:undefined;
  const workspaces=await prisma.railWorkspace.findMany({select:{userId:true,user:{select:{isActive:true}}}});
  for(const {userId,user} of workspaces){const {planner}=await loadWorkspace(userId,now);if(!user.isActive)continue;const jobs=policy.remindersEnabled?reminderJobs(planner,now).filter(j=>(j.kind!=="WHATSAPP"||policy.whatsappEnabled)&&(j.kind!=="TELEGRAM"||policy.telegramEnabled)):[];
    await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;const current=await tx.railWorkspace.findUniqueOrThrow({where:{userId}});const owner=await tx.user.findUniqueOrThrow({where:{id:userId}});const effective=applyAccountSettings(decodeWorkspace(current.payload),policy,owner.phoneNumber??"",await tx.railTelegram.findUnique({where:{userId}}),telegramProviderId);const actual=policy.remindersEnabled?reminderJobs(effective,now).filter(j=>(j.kind!=="WHATSAPP"||policy.whatsappEnabled)&&(j.kind!=="TELEGRAM"||policy.telegramEnabled)):[];
      await tx.railJob.updateMany({where:{userId,state:{in:["PENDING","FAILED"]},key:{notIn:actual.map(j=>j.key)}},data:{state:"CANCELLED",lease:null,leaseUntil:null}});
      await tx.railJob.updateMany({where:{userId,state:"CANCELLED",key:{in:actual.map(j=>j.key)}},data:{state:"PENDING",attempts:0,lastError:null,lease:null,leaseUntil:null}});
      await tx.railJob.createMany({data:jobs.filter(j=>actual.some(a=>a.key===j.key)).map(({key,kind,dueAt,message,journeyId})=>({userId,key,kind,dueAt,payload:encryptSecret(JSON.stringify({message,journeyId}))})),skipDuplicates:true});
    });
  }
  const available={dueAt:{lte:now},attempts:{lt:5},OR:[{state:"PENDING"},{state:"FAILED"},{state:"SENDING",leaseUntil:{lt:now}}]};
  const jobs=await prisma.railJob.findMany({where:available,orderBy:{dueAt:"asc"},take:100});let sent=0;
  for(const job of jobs){const lease=randomUUID();const claim=await prisma.railJob.updateMany({where:{id:job.id,...available},data:{state:"SENDING",lease,leaseUntil:new Date(Date.now()+120000),attempts:{increment:1}}});if(!claim.count)continue;
    try{
      const currentPolicy=await getFeaturePolicy();const currentConfig=await getProviderConfiguration();const workspace=await prisma.railWorkspace.findUnique({where:{userId:job.userId},include:{user:{select:{isActive:true,phoneNumber:true}}}});const planner=workspace?applyAccountSettings(decodeWorkspace(workspace.payload),currentPolicy,workspace.user.phoneNumber??"",await prisma.railTelegram.findUnique({where:{userId:job.userId}}),telegramConfigured(currentConfig)?currentConfig.telegram!.id:undefined):undefined;
      const actual=currentPolicy.remindersEnabled&&(job.kind!=="WHATSAPP"||currentPolicy.whatsappEnabled)&&(job.kind!=="TELEGRAM"||currentPolicy.telegramEnabled)&&planner&&workspace?.user.isActive?reminderJobs(planner,now).find(j=>j.key===job.key):undefined;
      if(!actual){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"CANCELLED",lease:null,leaseUntil:null}});continue;}
      if(job.kind==="WHATSAPP"&&!await whatsappReady()){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"PENDING",attempts:{decrement:1},dueAt:new Date(now.getTime()+300000),lastError:"WhatsApp setup is incomplete.",lease:null,leaseUntil:null}});continue;}
      if(job.kind==="IN_APP"){if(await recordInAppReminder({id:job.id,userId:job.userId,lease,journeyId:actual.journeyId,dueAt:actual.dueAt},now))sent++;continue;}
      const journey=planner!.journeys.find(j=>j.id===actual.journeyId)!;
      const providerId=job.kind==="WHATSAPP"?await sendWhatsApp(planner!.settings.whatsappNumber,journey):job.kind==="TELEGRAM"?await sendTelegram(planner!.settings.telegramChatId,telegramBookingMessage(journey),planner!.settings.telegramProviderId,`${process.env.APP_URL??"http://localhost:3000"}/journeys`):undefined;
      await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"SENT",sentAt:now,providerId,lastError:null,lease:null,leaseUntil:null}});sent++;logger.info("reminder.delivered",{jobId:job.id,kind:job.kind});
    }catch(error){logger.error("reminder.delivery_failed",{jobId:job.id,kind:job.kind,attempt:job.attempts,errorType:error instanceof Error?error.name:"UnknownError"});await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"FAILED",dueAt:new Date(now.getTime()+Math.min(60,2**(job.attempts+1))*60000),lastError:"Delivery failed. Check the provider configuration.",lease:null,leaseUntil:null}});}
  }
  const calendars=await syncGoogleCalendars();return {accounts:workspaces.length,sent,calendars};
}
