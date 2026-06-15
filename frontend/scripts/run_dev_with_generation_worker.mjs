#!/usr/bin/env node
/* global console */

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";

const isWindows = process.platform === "win32";
const binSuffix = isWindows ? ".cmd" : "";
const nextBin = path.resolve(process.cwd(), "node_modules", ".bin", `next${binSuffix}`);
const nodeBin = process.execPath;
const workerScript = path.resolve(
  process.cwd(),
  "scripts",
  "run_generation_control_plane_worker.mjs"
);
const nextArgs = ["dev", ...process.argv.slice(2)];
const nextLaunchArgs = isWindows
  ? [
      "/d",
      "/s",
      "/c",
      `"${[nextBin, ...nextArgs]
        .map((value) => `"${String(value).replace(/"/g, '\\"')}"`)
        .join(" ")}"`,
    ]
  : nextArgs;

const children = new Set();
let shuttingDown = false;

const spawnChild = ({ label, command, args }) => {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });

  children.add(child);

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (shuttingDown) return;

    shuttingDown = true;
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 0}`;
    console.error(`[dev] ${label} stopped unexpectedly (${reason}); stopping local dev runtime.`);
    for (const runningChild of children) {
      runningChild.kill("SIGTERM");
    }
    process.exitCode = code ?? 1;
  });

  child.on("error", (error) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.error(`[dev] failed to start ${label}: ${error.message}`);
    for (const runningChild of children) {
      runningChild.kill("SIGTERM");
    }
    process.exitCode = 1;
  });

  return child;
};

const stop = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    child.kill("SIGTERM");
  }
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

console.info("[dev] starting Next.js and generation control-plane worker");
spawnChild({
  label: "next",
  command: isWindows ? process.env.ComSpec ?? "cmd.exe" : nextBin,
  args: nextLaunchArgs,
});
spawnChild({
  label: "generation-worker",
  command: nodeBin,
  args: [workerScript, "--env-file", ".env.development.local", "--env-file", ".env.local"],
});
