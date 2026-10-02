import { assertCronSecret } from "@/lib/auth";
import { jsonData,routeError } from "@/lib/http";
import { Pool } from "pg";
import { runScheduledWork } from "@/backend/scheduler";
export const maxDuration=300;
/** Runs authorized maintenance processing behind the configured worker secret. */
export async function POST(request:Request){try{assertCronSecret(request);const pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:5000});try{return jsonData(await runScheduledWork(pool));}finally{await pool.end();}}catch(e){return routeError(e,request);}}
