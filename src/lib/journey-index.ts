import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { encryptSecret } from "./crypto";
import { bookingDay,bookingInstant,todayIST,type Journey,type Planner } from "./travel-planner";

/** Normalizes searchable text consistently without exposing ticket details in database indexes. */
export function journeySearchText(journey:Journey){return [journey.from,journey.to,journey.train,journey.trainName,journey.trainNumber,journey.pnr,journey.notes].filter(Boolean).join(" ").normalize("NFKC").toLowerCase();}
/** Derives account-specific search fingerprints using the configured encryption key. */
export function journeyHash(userId:string,value:string){const key=process.env.APP_ENCRYPTION_KEY;if(!key)throw new Error("APP_ENCRYPTION_KEY is required.");return createHmac("sha256",key).update(userId+"\0"+value).digest("hex");}
/** Indexes bounded three-character fragments; exact matches are verified after decryption. */
export function searchTokens(userId:string,text:string){const grams=new Set<string>();for(let i=0;i<=text.length-3;i++)grams.add(text.slice(i,i+3));return [...grams].map(g=>journeyHash(userId,g).slice(0,32));}
/** Creates one encrypted canonical/index row without re-encrypting unrelated journeys. */
export function journeyRow(userId:string,j:Journey){const serialized=JSON.stringify(j);return {userId,id:j.id,date:j.date,bookingDate:bookingDay(j),bookingAt:bookingInstant(j),status:j.status,archived:Boolean(j.archivedAt),ruleId:j.ruleId??null,hasTicket:Boolean(j.attachments?.some(a=>a.type==="application/pdf")),fingerprint:journeyHash(userId,serialized),searchTokens:searchTokens(userId,journeySearchText(j)),payload:encryptSecret(serialized)};}
/** Updates only changed index rows in bounded batches, atomically with the encrypted workspace. */
export async function syncJourneyIndex(tx:Prisma.TransactionClient,userId:string,planner:Planner,version:number,now=new Date()){
  const existing=await tx.railJourney.findMany({where:{userId},select:{id:true,fingerprint:true}});
  const fingerprints=new Map(existing.map(row=>[row.id,row.fingerprint]));
  const changed=planner.journeys.flatMap(j=>{const serialized=JSON.stringify(j),fingerprint=journeyHash(userId,serialized);return fingerprints.get(j.id)===fingerprint?[]:[{j,serialized,fingerprint}];});
  const keep=new Set(planner.journeys.map(j=>j.id));
  const remove=[...existing.filter(j=>!keep.has(j.id)).map(j=>j.id),...changed.map(row=>row.j.id)];
  for(let i=0;i<remove.length;i+=250)await tx.railJourney.deleteMany({where:{userId,id:{in:remove.slice(i,i+250)}}});
  for(let i=0;i<changed.length;i+=50)await tx.railJourney.createMany({data:changed.slice(i,i+50).map(({j,serialized,fingerprint})=>({userId,id:j.id,date:j.date,bookingDate:bookingDay(j),bookingAt:bookingInstant(j),status:j.status,archived:Boolean(j.archivedAt),ruleId:j.ruleId??null,hasTicket:Boolean(j.attachments?.some(a=>a.type==="application/pdf")),fingerprint,searchTokens:searchTokens(userId,journeySearchText(j)),payload:encryptSecret(serialized)}))});
  await tx.railWorkspace.update({where:{userId},data:{listVersion:version,listPayload:encryptSecret(JSON.stringify({...planner,journeys:[]})),listDay:todayIST(now)}});
  await tx.railFile.updateMany({where:{userId,journeyId:{not:null}},data:{journeyId:null}});
  for(const j of planner.journeys)if(j.attachments?.length)await tx.railFile.updateMany({where:{userId,id:{in:j.attachments.map(f=>f.id)}},data:{journeyId:j.id}});
}
