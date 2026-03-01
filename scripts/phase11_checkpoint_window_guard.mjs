#!/usr/bin/env node
/**
 * Phase 11 checkpoint window guard.
 * Prevents invalid early checkpoint runs by enforcing UTC checkpoint times
 * before running local no-regression gates.
 */

import { spawnSync } from "node:child_process";

const WINDOW_SCHEDULE = {
  "shadow-1": {
    startAtUtc: "2026-02-27T18:46:07Z",
    checkpointAtUtc: "2026-02-28T18:46:07Z",
    sqlStartAt: "2026-02-27 18:46:07+00",
    sqlEndAt: "2026-02-28 18:46:07+00",
  },
  "canary-1": {
    startAtUtc: "2026-03-01T18:46:07Z",
    checkpointAtUtc: "2026-03-02T18:46:07Z",
    sqlStartAt: "2026-03-01 18:46:07+00",
    sqlEndAt: "2026-03-02 18:46:07+00",
  },
  "canary-2": {
    startAtUtc: "2026-03-02T18:46:07Z",
    checkpointAtUtc: "2026-03-03T18:46:07Z",
    sqlStartAt: "2026-03-02 18:46:07+00",
    sqlEndAt: "2026-03-03 18:46:07+00",
  },
};

const usage = () => {
  console.log(`Usage:
  node scripts/phase11_checkpoint_window_guard.mjs --window <shadow-1|canary-1|canary-2>
                                                   [--mode quick|full]
                                                   [--allow-early]
                                                   [--gate-file <path>]

Examples:
  node scripts/phase11_checkpoint_window_guard.mjs --window canary-1
  node scripts/phase11_checkpoint_window_guard.mjs --window canary-2 --mode full
  node scripts/phase11_checkpoint_window_guard.mjs --window canary-1 --gate-file /tmp/phase11-canary1-gate.json
`);
};

const args = process.argv.slice(2);
const readArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return typeof value === "string" ? value : null;
};

const hasFlag = (flag) => args.includes(flag);

const formatDuration = (milliseconds) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const main = () => {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const windowLabel = readArg("--window");
  if (!windowLabel || !(windowLabel in WINDOW_SCHEDULE)) {
    console.error("[phase11-window-guard] Missing or invalid --window.");
    usage();
    process.exit(1);
  }

  const mode = readArg("--mode") ?? "quick";
  if (mode !== "quick" && mode !== "full") {
    console.error(`[phase11-window-guard] Unsupported mode: ${mode}. Use quick|full.`);
    process.exit(1);
  }

  const gateFile = readArg("--gate-file");
  const allowEarly = hasFlag("--allow-early");
  const schedule = WINDOW_SCHEDULE[windowLabel];

  const now = new Date();
  const checkpointAt = new Date(schedule.checkpointAtUtc);
  const startAt = new Date(schedule.startAtUtc);

  console.log(`[phase11-window-guard] window=${windowLabel}`);
  console.log(`[phase11-window-guard] now_utc=${now.toISOString()}`);
  console.log(`[phase11-window-guard] start_utc=${startAt.toISOString()}`);
  console.log(`[phase11-window-guard] checkpoint_utc=${checkpointAt.toISOString()}`);
  console.log(`[phase11-window-guard] sql_window=${schedule.sqlStartAt} -> ${schedule.sqlEndAt}`);

  if (now.getTime() < checkpointAt.getTime() && !allowEarly) {
    const remaining = checkpointAt.getTime() - now.getTime();
    console.log(
      `[phase11-window-guard] DEFERRED: checkpoint has not closed yet (remaining ${formatDuration(
        remaining
      )}).`
    );
    console.log(
      `[phase11-window-guard] Re-run at/after ${checkpointAt.toISOString()} or use --allow-early for dry runs only.`
    );
    process.exit(2);
  }

  const gateMode = mode === "full" ? "--full" : "--quick";
  run("bash", ["scripts/phase11_shadow_checkpoint_gate.sh", gateMode]);

  if (gateFile) {
    run("node", [
      "scripts/phase11_evaluate_gate_summary.mjs",
      "--window",
      windowLabel,
      "--file",
      gateFile,
    ]);
  } else {
    console.log(
      "[phase11-window-guard] Optional: pass --gate-file <path> to run phase11_evaluate_gate_summary.mjs automatically."
    );
  }
};

try {
  main();
} catch (error) {
  console.error(`[phase11-window-guard] ${error.message}`);
  process.exit(1);
}

