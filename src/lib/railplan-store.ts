import { getFeaturePolicy } from "./settings";
import type { FeaturePolicy } from "./feature-policy";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { encryptSecret, decryptSecret } from "./crypto";
import { ApiError } from "./http";
import { EMPTY_PLANNER, extendRoutines, migratePlanner, plannerSchema, todayIST, type Planner } from "./travel-planner";

export function decodeWorkspace(payload: string) { return migratePlanner(JSON.parse(decryptSecret(payload)!)); }
export function validateWorkspace(value: unknown): Planner {
  const planner = migratePlanner(value);
  for (const items of [planner.journeys, planner.rules, planner.holidays]) if (new Set(items.map(x => x.id)).size !== items.length) throw new ApiError(400,"Duplicate record identifiers.");
  if (planner.journeys.some(j => j.from.toLowerCase() === j.to.toLowerCase())) throw new ApiError(400,"Choose different departure and arrival stations.");
  for (const r of planner.rules) if (r.linkedRuleId) { const linked = planner.rules.find(x => x.id === r.linkedRuleId); if (!linked || linked.id === r.id || linked.linkedRuleId !== r.id || linked.from.toLowerCase() !== r.to.toLowerCase() || linked.to.toLowerCase() !== r.from.toLowerCase()) throw new ApiError(400,"Linked routines must have opposite routes and reciprocal links."); }
  if (planner.settings.whatsappEnabled && !/^\+?[1-9]\d{7,14}$/.test(planner.settings.whatsappNumber)) throw new ApiError(400,"Add an international WhatsApp number before enabling reminders.");
  const days = planner.settings.bookingWindowDays;
  return plannerSchema.parse({ ...planner, journeys: planner.journeys.map(j => ({...j,windowDays:days,originOffset:0,bookingDateOverride:undefined})), rules:planner.rules.map(r=>({...r,windowDays:days})) });
}
export function applyAccountSettings(planner:Planner,policy:FeaturePolicy,phoneNumber:string):Planner {
return {...planner,settings:{...planner.settings,bookingWindowDays:policy.bookingWindowDays,whatsappNumber:phoneNumber,whatsappEnabled:planner.settings.whatsappEnabled&&policy.remindersEnabled&&policy.whatsappEnabled&&Boolean(phoneNumber)},journeys:planner.journeys.map(j=>({...j,windowDays:policy.bookingWindowDays,originOffset:0,bookingDateOverride:undefined})),rules:planner.rules.map(r=>({...r,windowDays:policy.bookingWindowDays}))};
}
async function lock(tx: Prisma.TransactionClient, userId: string) { await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`; }
export async function loadWorkspace(userId: string, now = new Date()) {
  const policy=await getFeaturePolicy();
  return prisma.$transaction(async tx => {
    await lock(tx,userId);
    const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
    const initial=applyAccountSettings(EMPTY_PLANNER,policy,user.phoneNumber??"");
    const existing = await tx.railWorkspace.findUnique({where:{userId}});
    if (!existing) { const record = await tx.railWorkspace.create({data:{userId,payload:encryptSecret(JSON.stringify(initial))}}); return {planner:initial,revision:record.version}; }
    const planner=decodeWorkspace(existing.payload); const extended=extendRoutines(applyAccountSettings(planner,policy,user.phoneNumber??""),todayIST(now));
    if (JSON.stringify(extended) !== JSON.stringify(planner)) { const record=await tx.railWorkspace.update({where:{userId},data:{payload:encryptSecret(JSON.stringify(extended)),version:{increment:1}}}); return {planner:extended,revision:record.version}; }
    return {planner,revision:existing.version};
  },{timeout:20000});
}
export async function saveWorkspace(userId: string, value: unknown, revision: number) {
  const policy=await getFeaturePolicy();
  const input=plannerSchema.parse(value);
  if(input.settings.whatsappEnabled&&(!policy.whatsappEnabled||!policy.remindersEnabled))throw new ApiError(403,"WhatsApp reminders are disabled by the administrator.","FEATURE_DISABLED");
  return prisma.$transaction(async tx => {
    await lock(tx,userId); const user=await tx.user.findUniqueOrThrow({where:{id:userId}});
    const planner=validateWorkspace(applyAccountSettings(input,policy,user.phoneNumber??""));
    const current=await tx.railWorkspace.findUnique({where:{userId}});
    if (!current || current.version !== revision) throw new ApiError(409,"Your plans changed in another session. Reload the latest version before saving.","VERSION_CONFLICT");
    const files=planner.journeys.flatMap(j=>j.attachments??[]);
    if (new Set(files.map(f=>f.id)).size !== files.length) throw new ApiError(400,"Each attachment must belong to one journey.");
    const owned=await tx.railFile.findMany({where:{userId,id:{in:files.map(f=>f.id)}},select:{id:true,name:true,type:true,size:true}});
    if(files.some(f=>!owned.some(o=>o.id===f.id&&o.name===f.name&&o.type===f.type&&o.size===f.size)))throw new ApiError(400,"Upload the original ticket files before saving their details.","MISSING_ATTACHMENT");
    const record=await tx.railWorkspace.update({where:{userId},data:{payload:encryptSecret(JSON.stringify(planner)),version:{increment:1}}});
    return {planner,revision:record.version};
  },{timeout:20000});
}
