#!/usr/bin/env node
/**
 * Runs a methodical generation drain loop against /api/internal/generation-recovery/run.
 * Uses convergence thresholds to stop automatically when active recovery/control-plane work is drained.
 */

const DEFAULT_INTERVAL_MS = 60_000;
const DEFAULT_MAX_RUNS = 120;
const DEFAULT_CONVERGED_RUNS = 3;
const DEFAULT_MAX_CONSECUTIVE_ERRORS = 3;

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

const readIntegerArg = (name, fallback, min = 1) => {
  const raw = readArgValue(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, parsed);
};

const normalizeBaseUrl = (value) => value.replace(/\/+$/, "");

const asCount = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return 0;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const printUsageAndExit = (message) => {
  if (message) {
    console.error(`[generation-drain] ${message}`);
  }
  console.error(
    [
      "Usage:",
      "  node scripts/run_generation_drain_cycle.mjs --base-url <url> --secret <cron-secret> [options]",
      "",
      "Options:",
      "  --interval-ms <ms>                  Poll interval (default 60000)",
      "  --max-runs <n>                      Max drain passes before failing (default 120)",
      "  --converged-runs <n>                Consecutive converged passes required (default 3)",
      "  --max-consecutive-errors <n>        Fail-fast threshold for route errors (default 3)",
    ].join("\n")
  );
  process.exit(1);
};

const baseUrl =
  readArgValue("--base-url") ??
  process.env.SHORTPULSE_STAGING_BASE_URL ??
  process.env.SHORTPULSE_PUBLIC_API_BASE_URL ??
  process.env.APP_BASE_URL ??
  null;
const secret =
  readArgValue("--secret") ??
  process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET ??
  process.env.CRON_SECRET ??
  null;

if (!baseUrl) {
  printUsageAndExit("Missing --base-url and no fallback URL env var was found.");
}
if (!secret) {
  printUsageAndExit("Missing --secret and no reconciler secret env var was found.");
}

const intervalMs = readIntegerArg("--interval-ms", DEFAULT_INTERVAL_MS, 1000);
const maxRuns = readIntegerArg("--max-runs", DEFAULT_MAX_RUNS, 1);
const convergedRunsRequired = readIntegerArg("--converged-runs", DEFAULT_CONVERGED_RUNS, 1);
const maxConsecutiveErrors = readIntegerArg(
  "--max-consecutive-errors",
  DEFAULT_MAX_CONSECUTIVE_ERRORS,
  1
);

const endpoint = `${normalizeBaseUrl(baseUrl)}/api/internal/generation-recovery/run`;

console.log(
  `[generation-drain] start endpoint=${endpoint} interval_ms=${intervalMs} max_runs=${maxRuns} converged_runs=${convergedRunsRequired} max_consecutive_errors=${maxConsecutiveErrors}`
);

let convergedStreak = 0;
let consecutiveErrors = 0;

for (let run = 1; run <= maxRuns; run += 1) {
  const startedAt = Date.now();
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": secret,
        "content-type": "application/json",
      },
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(
        `route_error status=${response.status} body=${JSON.stringify(payload ?? null).slice(0, 500)}`
      );
    }

    const claimed = asCount(payload.claimed);
    const observationClaimed = asCount(payload.observationClaimed);
    const requeued = asCount(payload.requeued);
    const exhausted = asCount(payload.exhausted);
    const errors = asCount(payload.errors);
    const reservationCleanupReleased = asCount(payload.reservationCleanupReleased);

    const hasErrors = errors > 0;
    const hasActiveWork =
      claimed > 0 || observationClaimed > 0 || requeued > 0 || reservationCleanupReleased > 0;

    if (!hasActiveWork && !hasErrors) {
      convergedStreak += 1;
    } else {
      convergedStreak = 0;
    }
    consecutiveErrors = 0;

    console.log(
      `[generation-drain] run=${run} duration_ms=${Date.now() - startedAt} observationClaimed=${observationClaimed} claimed=${claimed} requeued=${requeued} exhausted=${exhausted} reservationCleanupReleased=${reservationCleanupReleased} errors=${errors} converged_streak=${convergedStreak}`
    );

    if (convergedStreak >= convergedRunsRequired) {
      console.log(`[generation-drain] converged after run ${run}.`);
      process.exit(0);
    }
  } catch (error) {
    consecutiveErrors += 1;
    console.error(
      `[generation-drain] run=${run} error=${error instanceof Error ? error.message : String(error)} consecutive_errors=${consecutiveErrors}`
    );
    if (consecutiveErrors >= maxConsecutiveErrors) {
      console.error(
        `[generation-drain] aborting after ${consecutiveErrors} consecutive errors (threshold reached).`
      );
      process.exit(1);
    }
  }

  if (run < maxRuns) {
    await sleep(intervalMs);
  }
}

console.error(
  `[generation-drain] max runs reached without convergence (max_runs=${maxRuns}, required_converged_runs=${convergedRunsRequired}).`
);
process.exit(2);
