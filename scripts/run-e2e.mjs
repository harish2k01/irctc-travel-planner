import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { cp } from "node:fs/promises";

const port = process.env.E2E_PORT ?? "3102";
const baseURL = `http://127.0.0.1:${port}`;
const env = { ...process.env, E2E_URL: baseURL, APP_URL: baseURL, HOSTNAME: "127.0.0.1", PORT: port };
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
const server = spawn(process.execPath, [".next/standalone/server.js"], { env, stdio: "inherit" });
let code = 1;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null) throw new Error("Production server exited before becoming ready.");
    try { ready = (await fetch(`${baseURL}/api/health/ready`, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
    if (ready) break;
    await delay(1000);
  }
  if (!ready) throw new Error("Production server did not become ready.");
  for (const script of ["scripts/verify-railplan.mjs","scripts/verify-railwatch-accounts.mjs"]) {
    const test = spawn(process.execPath, [script], { env, stdio: "inherit" });
    code = await new Promise((resolve) => { test.once("error", () => resolve(1)); test.once("exit", (value) => resolve(value ?? 1)); });
    if (code) break;
  }
} finally {
  server.kill();
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); });
}
process.exitCode = code;
