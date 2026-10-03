import { quietHoursResume } from "./notification-controls";
import { sendBrowserPush } from "./browser-push";
import { recordInAppReminder } from "./in-app-notifications";
import {logger} from "./logger";
import { pollTelegram } from "./telegram-polling";
import { getProviderConfiguration,telegramConfigured } from "./provider-config";
import {telegramBookingMessage} from "./message-templates";
import { sendTelegram } from "./telegram";
import { createHash,randomUUID } from "node:crypto";
import { encryptSecret } from "./crypto";
import { prisma } from "./db";
import { sendBookingEmail } from "./mail";
import { getDeliveryConfiguration } from "./settings";
import { getFeaturePolicy } from "./settings";
import { applyAccountSettings,decodeWorkspace,loadWorkspace } from "./railwatch-store";
import { scheduledReminders,bookingTimeLabel,todayIST,formatDay,bookingDay,type Planner } from "./travel-planner";
import { sendWhatsApp,whatsappReady } from "./railwatch-providers";
import { syncGoogleCalendars } from "./railwatch-google";
/** Builds durable reminder identities and due times from active journey preferences. */
export function reminderJobs(planner:Planner,now:Date,emailRecipient?:string,deviceIds:string[]=[]){
  const result:{key:string;kind:string;dueAt:Date;journeyId:string;message:string;deviceId?:string}[]=[];
  for(const j of planner.journeys){if(j.archivedAt||!["needs_booking","cancellation_needed"].includes(j.status)||j.date<todayIST(now))continue;
    // Retain a bounded recovery window; older schedules never auto-send externally.
    for(const time of scheduledReminders(planner,j,now)){const dueAt=new Date(time);if(dueAt.getTime()<now.getTime()-30*86400000)continue;
      const message=j.status==="cancellation_needed"?`Cancel your ticket from ${j.from} to ${j.to} for ${formatDay(j.date,{day:"numeric",month:"long",year:"numeric"})} through IRCTC, then confirm cancellation in RailWatch.`:`Book your train from ${j.from} to ${j.to} for ${formatDay(j.date,{day:"numeric",month:"long",year:"numeric"})}. Booking opens ${formatDay(bookingDay(j))} at ${bookingTimeLabel(j)}.`;
      for(const channel of [...deviceIds.map(id=>"PUSH:"+id),"IN_APP",...(planner.settings.emailEnabled&&emailRecipient?["EMAIL"]:[]),...(planner.settings.whatsappEnabled?["WHATSAPP"]:[]),...(planner.settings.telegramEnabled?["TELEGRAM"]:[])]){
        const kind=channel.startsWith("PUSH:")?"PUSH":channel,deviceId=kind==="PUSH"?channel.slice(5):undefined;
        const identity=JSON.stringify([j.status==="cancellation_needed"?`${j.id}:cancel`:j.id,j.from,j.to,j.date,time,kind,kind==="PUSH"?deviceId:kind==="EMAIL"?emailRecipient:kind==="WHATSAPP"?planner.settings.whatsappNumber:kind==="TELEGRAM"?[planner.settings.telegramProviderId,planner.settings.telegramChatId]:""]);
        result.push({key:createHash("sha256").update(identity).digest("hex"),kind,dueAt,journeyId:j.id,message,deviceId});
      }
    }
  }return result;
}
/** Polls Telegram, refreshes workspaces, leases due reminders, and synchronizes calendars. */
export async function processRailWatch(now=new Date()){
  // A pod can stop during its final permitted attempt; do not leave its job stuck.
  await prisma.railJob.updateMany({where:{state:"SENDING",attempts:{gte:5},leaseUntil:{lt:now}},data:{state:"FAILED",lease:null,leaseUntil:null,lastError:"Delivery was interrupted on its final automatic attempt. Review before retrying."}});
  await pollTelegram();
  const policy=await getFeaturePolicy();const config=await getProviderConfiguration();const telegramProviderId=telegramConfigured(config)?config.telegram!.id:undefined;
  const workspaces=await prisma.railWorkspace.findMany({select:{userId:true,user:{select:{isActive:true,email:true,emailVerifiedAt:true}}}});
  for(const {userId,user} of workspaces){const deviceIds=(await prisma.railPush.findMany({where:{userId},select:{id:true}})).map(d=>d.id);const {planner}=await loadWorkspace(userId,now);if(!user.isActive){await prisma.railJob.updateMany({where:{userId,state:{in:["PENDING","FAILED","MISSED"]}},data:{state:"CANCELLED",lease:null,leaseUntil:null}});continue;}const jobs=policy.remindersEnabled?reminderJobs(planner,now,user.emailVerifiedAt?user.email:undefined,deviceIds).filter(j=>(j.kind!=="WHATSAPP"||policy.whatsappEnabled)&&(j.kind!=="TELEGRAM"||policy.telegramEnabled)):[];
    await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;const current=await tx.railWorkspace.findUniqueOrThrow({where:{userId}});const owner=await tx.user.findUniqueOrThrow({where:{id:userId}});const effective=applyAccountSettings(decodeWorkspace(current.payload),policy,owner.phoneNumber??"",await tx.railTelegram.findUnique({where:{userId}}),telegramProviderId);const actual=policy.remindersEnabled?reminderJobs(effective,now,owner.emailVerifiedAt?owner.email:undefined,deviceIds).filter(j=>(j.kind!=="WHATSAPP"||policy.whatsappEnabled)&&(j.kind!=="TELEGRAM"||policy.telegramEnabled)):[];
      await tx.railReminderPause.deleteMany({where:{userId,until:{lte:now}}});
      await tx.railJob.updateMany({where:{userId,state:{in:["PENDING","FAILED","MISSED"]},key:{notIn:actual.map(j=>j.key)}},data:{state:"CANCELLED",lease:null,leaseUntil:null}});
      await tx.railJob.updateMany({where:{userId,state:"CANCELLED",key:{in:actual.map(j=>j.key)}},data:{state:"PENDING",attempts:0,lastError:null,lease:null,leaseUntil:null,retryRequestedAt:null,deferredUntil:null}});
      const missedKeys=actual.filter(j=>j.dueAt.getTime()<now.getTime()-86400000).map(j=>j.key);
      await tx.railJob.updateMany({where:{userId,state:{in:["PENDING","FAILED"]},retryRequestedAt:null,deferredUntil:null,key:{in:missedKeys}},data:{state:"MISSED",lease:null,leaseUntil:null,lastError:"The scheduled time passed before this reminder could be delivered."}});
      await tx.railJob.createMany({data:jobs.filter(j=>actual.some(a=>a.key===j.key)).map(({key,kind,dueAt,message,journeyId})=>({userId,key,kind,dueAt,state:missedKeys.includes(key)?"MISSED":"PENDING",payload:encryptSecret(JSON.stringify({message,journeyId,reminderType:message.startsWith("Cancel your ticket")?"cancellation":"booking"}))})),skipDuplicates:true});
    });
  }
  const available={dueAt:{lte:now},attempts:{lt:5},OR:[{state:"PENDING"},{state:"FAILED"},{state:"SENDING",leaseUntil:{lt:now}}]};
  const jobs=await prisma.railJob.findMany({where:available,orderBy:{dueAt:"asc"},take:100});let sent=0;
  for(const job of jobs){const lease=randomUUID();const claim=await prisma.railJob.updateMany({where:{id:job.id,...available},data:{state:"SENDING",lease,leaseUntil:new Date(Math.max(Date.now(),now.getTime())+120000),attempts:{increment:1}}});if(!claim.count)continue;
    try{
      const currentPolicy=await getFeaturePolicy();const currentConfig=await getProviderConfiguration();const workspace=await prisma.railWorkspace.findUnique({where:{userId:job.userId},include:{user:{select:{isActive:true,phoneNumber:true,email:true,emailVerifiedAt:true}}}});const planner=workspace?applyAccountSettings(decodeWorkspace(workspace.payload),currentPolicy,workspace.user.phoneNumber??"",await prisma.railTelegram.findUnique({where:{userId:job.userId}}),telegramConfigured(currentConfig)?currentConfig.telegram!.id:undefined):undefined;
      const actual=currentPolicy.remindersEnabled&&(job.kind!=="WHATSAPP"||currentPolicy.whatsappEnabled)&&(job.kind!=="TELEGRAM"||currentPolicy.telegramEnabled)&&planner&&workspace?.user.isActive?reminderJobs(planner,now,workspace.user.emailVerifiedAt?workspace.user.email:undefined,(await prisma.railPush.findMany({where:{userId:job.userId},select:{id:true}})).map(d=>d.id)).find(j=>j.key===job.key):undefined;
      if(!actual){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"CANCELLED",lease:null,leaseUntil:null}});continue;}
      if(!job.retryRequestedAt&&!job.deferredUntil&&actual.dueAt.getTime()<now.getTime()-86400000){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"MISSED",lease:null,leaseUntil:null}});continue;}
      const pause=await prisma.railReminderPause.findUnique({where:{userId_journeyId:{userId:job.userId,journeyId:actual.journeyId}}});
      const quiet=job.kind!=="IN_APP"?quietHoursResume(planner!.settings.quietHours,now):null;
      const resume=Math.max(pause?.until.getTime()??0,quiet?.getTime()??0);
      if(resume>now.getTime()){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"PENDING",attempts:{decrement:1},dueAt:new Date(resume),deferredUntil:new Date(resume),lease:null,leaseUntil:null,lastError:null}});logger.info("reminder.deferred",{jobId:job.id,kind:job.kind,reason:pause&&pause.until>now?"snooze":"quiet_hours"});continue;}
      if(job.kind==="WHATSAPP"&&!await whatsappReady()){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"PENDING",attempts:{decrement:1},dueAt:new Date(now.getTime()+300000),lastError:"WhatsApp setup is incomplete.",lease:null,leaseUntil:null}});continue;}
      if(job.kind==="EMAIL"&&!(await getDeliveryConfiguration()).smtpUrl){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"PENDING",attempts:{decrement:1},dueAt:new Date(now.getTime()+300000),lastError:"Email setup is incomplete.",lease:null,leaseUntil:null}});continue;}
      if(job.kind==="IN_APP"){if(await recordInAppReminder({id:job.id,userId:job.userId,lease,journeyId:actual.journeyId,dueAt:actual.dueAt,reminderType:actual.message.startsWith("Cancel your ticket")?"cancellation":"booking"},now))sent++;continue;}
      const journey=planner!.journeys.find(j=>j.id===actual.journeyId)!;
      if(job.kind==="PUSH")await sendBrowserPush(job.userId,actual.deviceId!,actual.message,"railwatch-journey-"+actual.journeyId);
      if(job.kind==="EMAIL"){const result=await sendBookingEmail(workspace!.user.email,journey);if(!result.sent)throw new Error("Email setup is incomplete.");}
      const providerId=job.kind==="WHATSAPP"?await sendWhatsApp(planner!.settings.whatsappNumber,journey):job.kind==="TELEGRAM"?await sendTelegram(planner!.settings.telegramChatId,telegramBookingMessage(journey),planner!.settings.telegramProviderId,`${process.env.APP_URL??"http://localhost:3000"}/journeys`):undefined;
      await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"SENT",sentAt:now,providerId,lastError:null,deferredUntil:null,lease:null,leaseUntil:null}});sent++;logger.info("reminder.delivered",{jobId:job.id,kind:job.kind});
    }catch(error){logger.error("reminder.delivery_failed",{jobId:job.id,kind:job.kind,attempt:job.attempts,errorType:error instanceof Error?error.name:"UnknownError"});await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"FAILED",dueAt:new Date(now.getTime()+Math.min(60,2**(job.attempts+1))*60000),lastError:"Delivery failed. Check the provider configuration.",lease:null,leaseUntil:null}});}
  }
  const calendars=await syncGoogleCalendars();return {accounts:workspaces.length,sent,calendars};
}
