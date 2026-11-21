import { spawn } from "node:child_process";
import path from "node:path";
import { loadEnvFile } from "./env.js";

loadEnvFile();
if (!process.env.SECUREMARK_SECRET)
    throw new Error("SECUREMARK_SECRET is required to start the production server.");
if (!process.env.SIGNING_KEY_PEM)
    throw new Error("SIGNING_KEY_PEM is required to start the production server.");

const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const next = spawn(process.execPath, [nextBin, "start", ...process.argv.slice(2)], { stdio: "inherit", env: process.env });
next.on("error", error => { throw error; });
next.on("exit", (code, signal) => {
    process.exitCode = signal ? 1 : (code ?? 1);
});
