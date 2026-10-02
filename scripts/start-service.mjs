import { spawn } from "node:child_process";
const role = process.env.RAILWATCH_SERVICE ?? "frontend";
if (!["frontend", "backend"].includes(role)) throw new Error("RAILWATCH_SERVICE must be frontend or backend.");
const child = spawn(process.execPath, [role === "backend" ? "build/backend/server.mjs" : "server.js"], { stdio: "inherit" });
process.once("SIGTERM", () => child.kill("SIGTERM"));
process.once("SIGINT", () => child.kill("SIGINT"));
child.once("exit", code => { process.exitCode = code ?? 1; });
