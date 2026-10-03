import { Pool } from "pg";
import { processRailWatch } from "@/lib/railwatch-jobs";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/db";

/** Claims a PostgreSQL advisory lock so only one backend replica processes scheduled work. */
export async function runScheduledWork(pool: Pool, task = processRailWatch) {
  const connection = await pool.connect();
  let locked = false;
  try {
    // Session lock prevents overlapping work across backend replicas and restarts.
    const claim = await connection.query("SELECT pg_try_advisory_lock(726149, 1) AS acquired");
    locked = claim.rows[0].acquired;
    if (!locked) return { skipped: true };
    const result = await task();
    logger.info("scheduler.completed", result);
    return result;
  } finally {
    try { if (locked) await connection.query("SELECT pg_advisory_unlock(726149, 1)"); }
    finally { connection.release(); }
  }
}

/** Persists the leader's run outcome without recording private task results or errors. */
export async function runWithHeartbeat(task=processRailWatch) {
  const started=Date.now();
  await prisma.railOperations.upsert({where:{id:"scheduler"},create:{id:"scheduler",startedAt:new Date(started)},update:{startedAt:new Date(started)}});
  try {
    const result=await task();
    await prisma.railOperations.update({where:{id:"scheduler"},data:{succeededAt:new Date(),durationMs:Date.now()-started}});
    return result;
  } catch(error) {
    await prisma.railOperations.update({where:{id:"scheduler"},data:{failedAt:new Date(),durationMs:Date.now()-started,failureCount:{increment:1}}});
    throw error;
  }
}

/** Runs scheduled processing once per minute and returns an orderly shutdown callback. */
export function startScheduler() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  const /** Refreshes time-dependent state or runs the next scheduled processing cycle. */ tick = async () => {
    try { await runScheduledWork(pool,()=>runWithHeartbeat()); }
    catch(error) { logger.error("scheduler.failed", { errorType:error instanceof Error?error.name:"UnknownError", message: "Scheduled processing failed; retrying next minute." }); }
    if (!stopped) timer = setTimeout(() => { active = tick(); }, 60_000 - Date.now() % 60_000);
  };
  active = tick();
  return async () => { stopped = true; clearTimeout(timer); await active; await pool.end(); };
}
