import { Pool } from "pg";
import { processRailWatch } from "@/lib/railwatch-jobs";
import { logger } from "@/lib/logger";

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

/** Runs scheduled processing once per minute and returns an orderly shutdown callback. */
export function startScheduler() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  const /** Refreshes time-dependent state or runs the next scheduled processing cycle. */ tick = async () => {
    try { await runScheduledWork(pool); }
    catch(error) { logger.error("scheduler.failed", { errorType:error instanceof Error?error.name:"UnknownError", message: "Scheduled processing failed; retrying next minute." }); }
    if (!stopped) timer = setTimeout(() => { active = tick(); }, 60_000 - Date.now() % 60_000);
  };
  active = tick();
  return async () => { stopped = true; clearTimeout(timer); await active; await pool.end(); };
}
