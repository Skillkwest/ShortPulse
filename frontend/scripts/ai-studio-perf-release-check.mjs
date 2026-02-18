#!/usr/bin/env node
/* global process, console, fetch, setTimeout */
import { spawn } from "node:child_process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const port = Number.parseInt(process.env.AI_STUDIO_PERF_PORT || "3100", 10);
const skipBuild = process.env.AI_STUDIO_PERF_SKIP_BUILD === "true";
const baseUrl = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${port}`;
const auditEmail = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();

if (!auditEmail) {
  console.error("[ai-studio-perf-release-check] PLAYWRIGHT_AUDIT_EMAIL is required.");
  process.exit(1);
}
if (/@example\.com$/i.test(auditEmail)) {
  console.error("[ai-studio-perf-release-check] PLAYWRIGHT_AUDIT_EMAIL cannot be an @example.com address.");
  process.exit(1);
}
if (!Number.isFinite(port) || port < 1 || port > 65535) {
  console.error(`[ai-studio-perf-release-check] Invalid AI_STUDIO_PERF_PORT value: ${process.env.AI_STUDIO_PERF_PORT}`);
  process.exit(1);
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: process.env,
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function waitForServerReady(url, attempts = 60, delayMs = 1000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${url}/auth?next=/ai-studio`, { method: "GET" });
      if (response.ok) return;
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Server did not become ready at ${url} within ${attempts * delayMs}ms`);
}

let serverProcess = null;
const cleanup = () => {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
};

process.on("SIGINT", () => {
  cleanup();
  process.exit(130);
});
process.on("SIGTERM", () => {
  cleanup();
  process.exit(143);
});

async function main() {
  try {
    if (!skipBuild) {
      console.log("[ai-studio-perf-release-check] Building production app with perf runtime enabled...");
      await runCommand(npmCommand, ["run", "build"], {
        env: {
          ...process.env,
          NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME: "true",
        },
      });
    } else {
      console.log("[ai-studio-perf-release-check] Skipping build (AI_STUDIO_PERF_SKIP_BUILD=true).");
    }

    console.log(`[ai-studio-perf-release-check] Starting production server on port ${port}...`);
    serverProcess = spawn(npmCommand, ["run", "start"], {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_AI_STUDIO_PERF_AUDIT_RUNTIME: "true",
        PORT: String(port),
      },
    });

    serverProcess.on("error", (error) => {
      console.error("[ai-studio-perf-release-check] Failed to start server:", error);
      process.exitCode = 1;
    });

    await waitForServerReady(baseUrl);
    console.log(`[ai-studio-perf-release-check] Running AI Studio perf audit at ${baseUrl}...`);
    await runCommand(npmCommand, ["run", "test:perf:ai-studio"], {
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: baseUrl,
      },
    });

    console.log("[ai-studio-perf-release-check] Completed successfully.");
  } catch (error) {
    console.error("[ai-studio-perf-release-check] Failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    cleanup();
  }
}

main();
