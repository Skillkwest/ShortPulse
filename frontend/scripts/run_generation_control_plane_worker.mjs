#!/usr/bin/env node
/* global console */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { loadLocalEnv } from "../../scripts/lib/load_local_env.mjs";

const readArgValue = (name) => {
  const prefixed = `${name}=`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const token = process.argv[index];
    if (token === name) {
      const next = process.argv[index + 1];
      return typeof next === "string" ? next : null;
    }
    if (token.startsWith(prefixed)) {
      return token.slice(prefixed.length);
    }
  }
  return null;
};

const usageAndExit = (message) => {
  if (message) {
    console.error(`[generation-worker] ${message}`);
  }
  console.error(
    [
      "Usage:",
      "  npm run dev:generation-worker",
      "  node ./scripts/run_generation_control_plane_worker.mjs [--interval-ms <ms>] [--error-backoff-ms <ms>]",
    ].join("\n")
  );
  process.exit(1);
};

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    usageAndExit(`Missing required environment variable: ${name}`);
  }
  return value;
};

loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: ["../.env.agent.local", ".env.local"],
});

let stopped = false;
const stop = () => {
  stopped = true;
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
process.on("uncaughtException", (error) => {
  console.error(`[generation-worker] uncaught_exception=${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
  stop();
});
process.on("unhandledRejection", (reason) => {
  console.error(`[generation-worker] unhandled_rejection=${reason instanceof Error ? reason.stack ?? reason.message : String(reason)}`);
  process.exitCode = 1;
  stop();
});

const bundleDirectory = await fs.promises.mkdtemp(
  path.join(os.tmpdir(), "shortpulse-generation-worker-")
);
const bundlePath = path.join(bundleDirectory, "worker-loop.mjs");

try {
  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  await build({
    entryPoints: [path.resolve(process.cwd(), "lib/server/generationControlPlane/workerLoop.ts")],
    outfile: bundlePath,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node22",
    sourcemap: "inline",
  });

  const moduleUrl = `${pathToFileURL(bundlePath).href}?t=${Date.now()}`;
  const workerModule = await import(moduleUrl);
  const runWorkerLoop = workerModule.runGenerationControlPlaneWorkerLoop;
  const readInteger = workerModule.readInteger;
  const createDbOps = workerModule.createGenerationControlPlaneWorkerDbOps;
  const writeFileHeartbeat = workerModule.writeGenerationControlPlaneWorkerHeartbeat;

  if (
    typeof runWorkerLoop !== "function" ||
    typeof readInteger !== "function" ||
    typeof createDbOps !== "function" ||
    typeof writeFileHeartbeat !== "function"
  ) {
    usageAndExit("Failed to load generation control-plane worker bundle.");
  }

  const intervalMs = readInteger(
    readArgValue("--interval-ms") ?? process.env.SHORTPULSE_FAL_DEV_WORKER_INTERVAL_MS,
    workerModule.DEFAULT_GENERATION_CONTROL_PLANE_WORKER_INTERVAL_MS
  );
  const errorBackoffMs = readInteger(
    readArgValue("--error-backoff-ms") ?? process.env.SHORTPULSE_FAL_DEV_WORKER_ERROR_BACKOFF_MS,
    workerModule.DEFAULT_GENERATION_CONTROL_PLANE_WORKER_ERROR_BACKOFF_MS
  );
  const dbOps = createDbOps();
  const writeHeartbeat = async (payload) => {
    writeFileHeartbeat(payload);
    await dbOps.writeHeartbeat(payload);
  };

  console.info(
    `[generation-worker] bootstrap pid=${process.pid} hostname=${os.hostname()} interval_ms=${intervalMs} error_backoff_ms=${errorBackoffMs}`
  );

  await runWorkerLoop({
    intervalMs,
    errorBackoffMs,
    shouldStop: () => stopped,
    writeHeartbeat,
    runWriter: {
      startRun: dbOps.startRun,
      finishRun: dbOps.finishRun,
    },
  });
} finally {
  await fs.promises.rm(bundleDirectory, { recursive: true, force: true });
}
