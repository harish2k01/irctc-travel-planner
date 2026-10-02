import { spawn } from "node:child_process";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = ["dev:backend", "dev:frontend"].map(script => spawn(npm, ["run", script], { stdio: "inherit", shell: process.platform === "win32" }));
const stop = () => children.forEach(child => child.kill());
process.once("SIGINT", stop); process.once("SIGTERM", stop);
for (const child of children) child.once("exit", code => { stop(); process.exitCode = code ?? 1; });
