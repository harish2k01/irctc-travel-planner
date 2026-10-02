import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { cp } from "node:fs/promises";

const port = process.env.E2E_PORT ?? "3102";
const baseURL = `http://127.0.0.1:${port}`;
const env = { ...process.env, E2E_URL: baseURL, APP_URL: baseURL, HOSTNAME: "127.0.0.1", PORT: port };
env.BACKEND_URL = `http://127.0.0.1:${Number(port) + 1}`;
const backend = spawn(process.execPath, ["build/backend/server.mjs"], { env: { ...env, NODE_ENV: "production", BACKEND_PORT: String(Number(port) + 1), SCHEDULER_ENABLED: "false" }, stdio: "inherit" });
await cp(".next/static", ".next/standalone/.next/static", { recursive: true });
await cp("public", ".next/standalone/public", { recursive: true });
const frontendEnv = { ...env };
for (const key of ["DATABASE_URL", "APP_ENCRYPTION_KEY", "CRON_SECRET", "SMTP_URL", "GOOGLE_CLIENT_SECRET", "WHATSAPP_ACCESS_TOKEN"]) delete frontendEnv[key];
const server = spawn(process.execPath, [".next/standalone/server.js"], { env: frontendEnv, stdio: "inherit" });
let code = 1;
try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (server.exitCode !== null || backend.exitCode !== null) throw new Error("A service exited before becoming ready.");
    try { ready = (await fetch(`${baseURL}/api/health/ready`, { signal: AbortSignal.timeout(2000) })).ok; } catch {}
    if (ready) break;
    await delay(1000);
  }
  if (!ready) throw new Error("Production server did not become ready.");
  for (const script of ["scripts/verify-railwatch.mjs","scripts/verify-railwatch-accounts.mjs"]) {
    const test = spawn(process.execPath, [script], { env, stdio: "inherit" });
    code = await new Promise((resolve) => { test.once("error", () => resolve(1)); test.once("exit", (value) => resolve(value ?? 1)); });
    if (code) break;
  }
} finally {
  server.kill();
  backend.kill();
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once("exit", resolve); });
  await new Promise((resolve) => { if (backend.exitCode !== null) resolve(); else backend.once("exit", resolve); });
}
process.exitCode = code;
