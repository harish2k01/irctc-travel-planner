import { config } from "dotenv";
import { spawn } from "node:child_process";

const [envFile, script, ...args] = process.argv.slice(2);
if (!envFile || !script) throw new Error("Usage: node scripts/with-env.mjs <env file> <node script> [args]");
const result = config({ path: envFile, quiet: true });
if (result.error) throw new Error("Unable to load the environment file.");
const child = spawn(process.execPath, [script, ...args], { env: process.env, stdio: "inherit", windowsHide: true });
child.on("exit", (code) => process.exit(code ?? 1));
