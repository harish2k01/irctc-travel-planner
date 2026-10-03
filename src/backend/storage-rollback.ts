import {prisma} from "@/lib/db";
import {materializeLegacyWorkspace,normalizedStorageEnabled} from "@/lib/workspace-storage";
import {logger} from "@/lib/logger";

/** Materializes compatible snapshots only after normalized conversion is disabled on every replica. */
async function main(){
  if(normalizedStorageEnabled()||process.env.RAILWATCH_STORAGE_ROLLBACK!=="true")throw new Error("Disable normalized storage on every backend, then set RAILWATCH_STORAGE_ROLLBACK=true for this command.");
  let count=0;
  for(;;){const rows=await prisma.railWorkspace.findMany({where:{storageVersion:2},orderBy:{userId:"asc"},take:20,select:{userId:true}});if(!rows.length)break;for(const row of rows)if(await prisma.$transaction(tx=>materializeLegacyWorkspace(tx,row.userId),{timeout:60000}))count++;}
  logger.info("storage.legacy_materialized",{accounts:count});
}
try{await main();}finally{await prisma.$disconnect();}
