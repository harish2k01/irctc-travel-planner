import {prisma} from "./db";
import {ApiError} from "./http";
import {applyAccountSettings,validateWorkspace} from "./railwatch-store";
import {mergeWorkspace,sameContent,WorkspaceConflict} from "./workspace-merge";
import {storedPlanner,workspacePayload} from "./workspace-storage";
import {journeyRow} from "./journey-index";
import {expiredTicketFiles} from "./ticket-retention";
import {plannerSchema,reconcileJourneyLifecycle,todayIST,type Planner} from "./travel-planner";
import type {FeaturePolicy} from "./feature-policy";

/** Merges a partial edit and writes only changed journey rows and changed account metadata. */
export async function saveNormalizedPatch(userId:string,input:Planner,revision:number,base:unknown,policy:FeaturePolicy,telegramProviderId?:string){
  if(!base)throw new ApiError(409,"Reload the latest workspace before saving.","VERSION_CONFLICT");
  if(input.settings.emailEnabled&&!policy.remindersEnabled||input.settings.whatsappEnabled&&(!policy.whatsappEnabled||!policy.remindersEnabled))throw new ApiError(403,"These reminders are disabled by the administrator.","FEATURE_DISABLED");
  const originalInput=plannerSchema.parse(base),ids=[...new Set([...originalInput.journeys,...input.journeys].map(j=>j.id))];
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
    const row=await tx.railWorkspace.findUniqueOrThrow({where:{userId}});
    if(revision>row.version)throw new ApiError(409,"Reload the latest workspace before saving.","VERSION_CONFLICT");
    if(row.storageVersion!==2)throw new ApiError(409,"Workspace storage changed. Refresh before saving.","VERSION_CONFLICT");
    const user=await tx.user.findUniqueOrThrow({where:{id:userId}}),telegram=await tx.railTelegram.findUnique({where:{userId}});
    const apply=(p:Planner)=>validateWorkspace(applyAccountSettings(p,policy,user.phoneNumber??"",telegram,telegramProviderId));
    const latest=apply(await storedPlanner(tx,userId,row,ids));let planner:Planner;
    try{planner=apply(mergeWorkspace(apply(originalInput),apply(input),latest));}catch(e){if(e instanceof WorkspaceConflict)throw new ApiError(409,e.message,"VERSION_CONFLICT");throw e;}
    const retention=expiredTicketFiles(reconcileJourneyLifecycle(planner,todayIST()),todayIST());planner=retention.planner;
    if(retention.ids.length)await tx.railFile.deleteMany({where:{userId,id:{in:retention.ids}}});
    const before=new Map(latest.journeys.map(j=>[j.id,j])),after=new Map(planner.journeys.map(j=>[j.id,j]));
    const changed=ids.filter(id=>!sameContent(before.get(id),after.get(id)));
    const count=await tx.railJourney.count({where:{userId}});
    if(count+changed.filter(id=>!before.has(id)&&after.has(id)).length-changed.filter(id=>before.has(id)&&!after.has(id)).length>10000)throw new ApiError(400,"This workspace has reached its journey limit.","WORKSPACE_LIMIT");
    const files=planner.journeys.flatMap(j=>(j.attachments??[]).map(file=>({...file,journeyId:j.id})));
    if(new Set(files.map(f=>f.id)).size!==files.length)throw new ApiError(400,"Each attachment must belong to one journey.");
    const owned=await tx.railFile.findMany({where:{userId,id:{in:files.map(f=>f.id)}},select:{id:true,name:true,type:true,size:true,journeyId:true}});
    if(files.some(f=>!owned.some(o=>o.id===f.id&&o.name===f.name&&o.type===f.type&&o.size===f.size&&(!o.journeyId||o.journeyId===f.journeyId||changed.includes(o.journeyId)))))throw new ApiError(400,"Upload the original ticket files and keep each file linked to one journey.","MISSING_ATTACHMENT");
    await tx.railFile.updateMany({where:{userId,journeyId:{in:changed}},data:{journeyId:null}});
    for(const id of changed){const j=after.get(id);if(!j){await tx.railJourney.deleteMany({where:{userId,id}});continue;}const data=journeyRow(userId,j);await tx.railJourney.upsert({where:{userId_id:{userId,id}},create:data,update:data});if(j.attachments?.length)await tx.railFile.updateMany({where:{userId,id:{in:j.attachments.map(f=>f.id)}},data:{journeyId:id}});}
    if(!sameContent(latest.settings.quietHours,planner.settings.quietHours))await tx.railJob.updateMany({where:{userId,state:"PENDING",deferredUntil:{not:null}},data:{dueAt:new Date()}});
    const metadata={...planner,journeys:[]},metaChanged=!sameContent({...latest,journeys:[]},metadata),payload=metaChanged?workspacePayload(metadata,2):row.payload;
    const saved=await tx.railWorkspace.update({where:{userId},data:{version:{increment:1},listVersion:row.version+1,listDay:sameContent(latest.rules,planner.rules)?todayIST():"",...(metaChanged?{payload,listPayload:payload}:{})}});
    return {planner,revision:saved.version,partial:true};
  },{timeout:60000});
}
