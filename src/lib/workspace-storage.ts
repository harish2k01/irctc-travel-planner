import type {Prisma,RailWorkspace} from "@prisma/client";
import {decryptSecret,encryptSecret} from "./crypto";
import {migratePlanner,type Planner,type Journey} from "./travel-planner";

/** Enables conversion only after every backend replica supports normalized storage. */
export function normalizedStorageEnabled(){return process.env.RAILWATCH_NORMALIZED_STORAGE==="true";}
/** Encodes metadata alone for normalized accounts and preserves the legacy format otherwise. */
export function workspacePayload(planner:Planner,storageVersion:number){return encryptSecret(JSON.stringify(storageVersion===2?{...planner,journeys:[]}:planner));}
/** Reads either storage format, selecting only requested journey rows for narrow operations. */
export async function storedPlanner(db:Pick<Prisma.TransactionClient,"railJourney">,userId:string,record:Pick<RailWorkspace,"payload"|"storageVersion">,ids?:string[]):Promise<Planner>{
  const planner=migratePlanner(JSON.parse(decryptSecret(record.payload)!));
  if(record.storageVersion!==2)return ids?{...planner,journeys:planner.journeys.filter(j=>ids.includes(j.id))}:planner;
  const rows=await db.railJourney.findMany({where:{userId,...(ids?{id:{in:ids}}:{})},orderBy:{id:"asc"},select:{payload:true}});
  return {...planner,journeys:rows.map(row=>JSON.parse(decryptSecret(row.payload)!) as Journey)};
}
/** Rebuilds a legacy snapshot under the account lock before an older backend is restored. */
export async function materializeLegacyWorkspace(db:Prisma.TransactionClient,userId:string){
  await db.$queryRaw`SELECT id FROM "User" WHERE id=${userId} FOR UPDATE`;
  const row=await db.railWorkspace.findUniqueOrThrow({where:{userId}});if(row.storageVersion!==2)return false;
  const planner=await storedPlanner(db,userId,row);
  await db.railWorkspace.update({where:{userId},data:{payload:workspacePayload(planner,1),storageVersion:1,version:{increment:1},listVersion:row.version+1}});return true;
}
