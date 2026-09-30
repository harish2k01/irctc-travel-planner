import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import pg from "pg";

assert.equal(process.env.RUN_MIGRATION_REHEARSAL, "1");
const database = process.argv[2];
assert.match(database ?? "", /^[a-z0-9_]+_test$/);
const url = new URL(process.env.DATABASE_URL);
assert.notEqual(url.pathname, `/${database}`, "Use a separate restored database, never the active test database.");
url.pathname = `/${database}`;
const client = new pg.Client({ connectionString: url.href });
await client.connect();
try {
  const tables = ["User", "Session", "AccountToken", "AppSettings", "Journey", "JourneyReminder", "ReminderDelivery", "PnrSnapshot", "Holiday", "AuditLog"];
  const columns = new Map();
  for (const table of tables) {
    const result = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position", [table]);
    columns.set(table, result.rows.map((row) => row.column_name));
  }
  const snapshot = async () => {
    const result = {};
    for (const table of tables) {
      const names = columns.get(table).map((column) => `"${column.replaceAll('"', '""')}"`).join(", ");
      const { rows } = await client.query(`SELECT ${names} FROM "${table}" ORDER BY id`);
      if (table === "ReminderDelivery") for (const row of rows) if (row.status === "SENDING") row.status = "PENDING";
      result[table] = { count: rows.length, hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
    }
    return result;
  };
  const before = await snapshot();
  const migrate = spawn(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy"], { stdio: "inherit", env: { ...process.env, DATABASE_URL: url.href } });
  assert.equal(await new Promise((resolve) => migrate.once("exit", resolve)), 0, "Migration failed");
  assert.deepEqual(await snapshot(), before, "Migration changed existing records");
  console.log(JSON.stringify({ result: "passed", preserved: Object.fromEntries(Object.entries(before).map(([table, value]) => [table, value.count])) }));
} finally { await client.end(); }
