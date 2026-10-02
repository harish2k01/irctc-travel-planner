import { Pool } from "pg";
import { processRailplan } from "@/lib/railplan-jobs";
import { logger } from "@/lib/logger";

export async function runScheduledWork(pool: Pool, task = processRailplan) {
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

export function startScheduler() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 });
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active: Promise<void> | undefined;
  const tick = async () => {
    try { await runScheduledWork(pool); }
    catch { logger.error("scheduler.failed", { message: "Scheduled processing failed; retrying next minute." }); }
    if (!stopped) timer = setTimeout(() => { active = tick(); }, 60_000 - Date.now() % 60_000);
  };
  active = tick();
  return async () => { stopped = true; clearTimeout(timer); await active; await pool.end(); };
}
