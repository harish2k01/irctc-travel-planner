import { createHash,randomUUID } from "node:crypto";
import { encryptSecret } from "./crypto";
import { prisma } from "./db";
import { decodeWorkspace,loadWorkspace } from "./railplan-store";
import { effectiveReminders,reminderPreview,todayIST,formatDay,bookingDay,type Planner } from "./travel-planner";
import { sendWhatsApp,whatsappReady } from "./railplan-providers";
import { syncGoogleCalendars } from "./railplan-google";
export function reminderJobs(planner:Planner,now:Date){
  const result:{key:string;kind:string;dueAt:Date;journeyId:string;message:string}[]=[];
  for(const j of planner.journeys){if(j.archivedAt||j.status!=="needs_booking"||j.date<todayIST(now))continue;
    const pref=effectiveReminders(planner,j);
    for(const time of reminderPreview(j,pref.times,pref.clock)){const dueAt=new Date(time);if(dueAt.getTime()<now.getTime()-86400000)continue;
      const message=`Book your train from ${j.from} to ${j.to} for ${formatDay(j.date,{day:"numeric",month:"long",year:"numeric"})}. Booking opens ${formatDay(bookingDay(j))} at 8:00 AM IST.`;
      for(const kind of ["IN_APP",...(planner.settings.whatsappEnabled?["WHATSAPP"]:[])]){
        const identity=JSON.stringify([j.id,j.from,j.to,j.date,time,kind,kind==="WHATSAPP"?planner.settings.whatsappNumber:""]);
        result.push({key:createHash("sha256").update(identity).digest("hex"),kind,dueAt,journeyId:j.id,message});
      }
    }
  }return result;
}
export async function processRailplan(now=new Date()){
  const workspaces=await prisma.railWorkspace.findMany({where:{user:{isActive:true}},select:{userId:true}});
  for(const {userId} of workspaces){const {planner}=await loadWorkspace(userId,now);const jobs=reminderJobs(planner,now);
    await prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;const current=await tx.railWorkspace.findUniqueOrThrow({where:{userId}});const actual=reminderJobs(decodeWorkspace(current.payload),now);
      await tx.railJob.updateMany({where:{userId,state:{in:["PENDING","FAILED"]},key:{notIn:actual.map(j=>j.key)}},data:{state:"CANCELLED",lease:null,leaseUntil:null}});
      await tx.railJob.updateMany({where:{userId,state:"CANCELLED",key:{in:actual.map(j=>j.key)}},data:{state:"PENDING",attempts:0,lastError:null,lease:null,leaseUntil:null}});
      await tx.railJob.createMany({data:jobs.filter(j=>actual.some(a=>a.key===j.key)).map(({key,kind,dueAt,message,journeyId})=>({userId,key,kind,dueAt,payload:encryptSecret(JSON.stringify({message,journeyId}))})),skipDuplicates:true});
    });
  }
  const available={dueAt:{lte:now},attempts:{lt:5},OR:[{state:"PENDING"},{state:"FAILED"},{state:"SENDING",leaseUntil:{lt:now}}]};
  const jobs=await prisma.railJob.findMany({where:available,orderBy:{dueAt:"asc"},take:100});let sent=0;
  for(const job of jobs){const lease=randomUUID();const claim=await prisma.railJob.updateMany({where:{id:job.id,...available},data:{state:"SENDING",lease,leaseUntil:new Date(Date.now()+120000),attempts:{increment:1}}});if(!claim.count)continue;
    try{
      const workspace=await prisma.railWorkspace.findUnique({where:{userId:job.userId},include:{user:{select:{isActive:true}}}});const planner=workspace?decodeWorkspace(workspace.payload):undefined;
      const actual=planner&&workspace?.user.isActive?reminderJobs(planner,now).find(j=>j.key===job.key):undefined;
      if(!actual){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"CANCELLED",lease:null,leaseUntil:null}});continue;}
      if(job.kind==="WHATSAPP"&&!whatsappReady()){await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"PENDING",attempts:{decrement:1},dueAt:new Date(now.getTime()+300000),lastError:"WhatsApp setup is incomplete.",lease:null,leaseUntil:null}});continue;}
      const journey=planner!.journeys.find(j=>j.id===actual.journeyId)!;
      const providerId=job.kind==="WHATSAPP"?await sendWhatsApp(planner!.settings.whatsappNumber,journey):undefined;
      await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"SENT",sentAt:now,providerId,lastError:null,lease:null,leaseUntil:null}});sent++;
    }catch{await prisma.railJob.updateMany({where:{id:job.id,lease},data:{state:"FAILED",dueAt:new Date(now.getTime()+Math.min(60,2**(job.attempts+1))*60000),lastError:"Delivery failed. Check the provider configuration.",lease:null,leaseUntil:null}});}
  }
  const calendars=await syncGoogleCalendars();return {accounts:workspaces.length,sent,calendars};
}
