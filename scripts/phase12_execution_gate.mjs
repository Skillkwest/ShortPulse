#!/usr/bin/env node
/**
 * Phase 12 execution gate helper.
 * Blocks cleanup/decommission execution slices (WS-1..WS-6) until signoff
 * prerequisites are explicitly satisfied.
 */

import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const PHASE11_CHECKPOINTS = {
  canary1: "2026-03-02T18:46:07Z",
  canary2: "2026-03-03T18:46:07Z",
};

const DECISION_VALUES = new Set(["pending", "promote", "hold", "rollback"]);

const usage = () => {
  console.log(`Usage:
  node scripts/phase12_execution_gate.mjs [options]

Options:
  --phase04-signoff <true|false>            Defaults to false
  --phase11-decision <pending|promote|hold|rollback>  Defaults to pending
  --run-validation <none|quick|full>        Defaults to none
  --allow-unsafe                             Continue even when gates are blocked
  --out-file <path>                          Optional JSON output path

Examples:
  node scripts/phase12_execution_gate.mjs
  node scripts/phase12_execution_gate.mjs --phase04-signoff true --phase11-decision promote
  node scripts/phase12_execution_gate.mjs --phase04-signoff true --phase11-decision hold --run-validation quick
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

const parseBoolean = (value, fallback) => {
  if (!value) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected true|false but received "${value}"`);
};

const run = (command, commandArgs) => {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const formatUtc = (isoString) => new Date(isoString).toISOString();

const main = () => {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const phase04Signoff = parseBoolean(readArg("--phase04-signoff"), false);
  const phase11Decision = readArg("--phase11-decision") ?? "pending";
  const runValidation = readArg("--run-validation") ?? "none";
  const allowUnsafe = hasFlag("--allow-unsafe");
  const outFile = readArg("--out-file");

  if (!DECISION_VALUES.has(phase11Decision)) {
    throw new Error(
      `Unsupported --phase11-decision "${phase11Decision}". Use pending|promote|hold|rollback.`
    );
  }

  if (!["none", "quick", "full"].includes(runValidation)) {
    throw new Error(
      `Unsupported --run-validation "${runValidation}". Use none|quick|full.`
    );
  }

  const now = new Date();
  const canary1CheckpointAt = new Date(PHASE11_CHECKPOINTS.canary1);
  const canary2CheckpointAt = new Date(PHASE11_CHECKPOINTS.canary2);

  const gates = {
    phase04SignoffComplete: phase04Signoff,
    phase11CanaryWindowsClosed: now.getTime() >= canary2CheckpointAt.getTime(),
    phase11DecisionComplete: phase11Decision !== "pending",
    phase11DecisionNotRollback: phase11Decision !== "rollback",
  };

  const blockedReasons = [];
  if (!gates.phase04SignoffComplete) {
    blockedReasons.push("Phase 04 signoff is not complete.");
  }
  if (!gates.phase11CanaryWindowsClosed) {
    blockedReasons.push(
      `Phase 11 checkpoint windows are still open (canary-2 checkpoint at ${canary2CheckpointAt.toISOString()}).`
    );
  }
  if (!gates.phase11DecisionComplete) {
    blockedReasons.push("Phase 11 rollout decision is still pending.");
  }
  if (!gates.phase11DecisionNotRollback) {
    blockedReasons.push("Phase 11 rollout decision is rollback.");
  }

  const readyForWsExecution = blockedReasons.length === 0;

  const summary = {
    nowUtc: now.toISOString(),
    checkpoints: {
      canary1CheckpointUtc: formatUtc(PHASE11_CHECKPOINTS.canary1),
      canary2CheckpointUtc: formatUtc(PHASE11_CHECKPOINTS.canary2),
    },
    inputs: {
      phase04Signoff,
      phase11Decision,
      runValidation,
      allowUnsafe,
    },
    gates,
    readyForWsExecution,
    blockedReasons,
  };

  console.log("[phase12-execution-gate] now_utc=", summary.nowUtc);
  console.log(
    "[phase12-execution-gate] canary1_checkpoint_utc=",
    summary.checkpoints.canary1CheckpointUtc
  );
  console.log(
    "[phase12-execution-gate] canary2_checkpoint_utc=",
    summary.checkpoints.canary2CheckpointUtc
  );
  console.log("[phase12-execution-gate] phase04_signoff=", phase04Signoff);
  console.log("[phase12-execution-gate] phase11_decision=", phase11Decision);
  console.log(
    "[phase12-execution-gate] ready_for_ws_execution=",
    readyForWsExecution
  );

  if (blockedReasons.length > 0) {
    console.log("[phase12-execution-gate] blocked_reasons:");
    for (const reason of blockedReasons) {
      console.log(`- ${reason}`);
    }
  }

  if (outFile) {
    writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(`[phase12-execution-gate] wrote summary JSON: ${outFile}`);
  }

  if (!readyForWsExecution && !allowUnsafe) {
    console.log(
      "[phase12-execution-gate] DEFERRED: WS-1..WS-6 cleanup execution is blocked by prerequisites."
    );
    process.exit(2);
  }

  if (!readyForWsExecution && allowUnsafe) {
    console.log(
      "[phase12-execution-gate] WARNING: proceeding with --allow-unsafe while gates are blocked."
    );
  }

  if (runValidation === "none") {
    console.log("[phase12-execution-gate] validation skipped (--run-validation none).");
    return;
  }

  const validationCommand =
    runValidation === "full"
      ? ["npm", ["-C", "frontend", "run", "validate:phase11:fal-regression"]]
      : ["npm", ["-C", "frontend", "run", "test:phase11:fal-regression"]];

  console.log(
    `[phase12-execution-gate] running validation: ${validationCommand[0]} ${validationCommand[1].join(" ")}`
  );
  run(validationCommand[0], validationCommand[1]);
};

try {
  main();
} catch (error) {
  console.error(`[phase12-execution-gate] ${error.message}`);
  process.exit(1);
}
