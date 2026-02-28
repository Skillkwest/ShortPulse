#!/usr/bin/env node
/**
 * Phase 11 gate-summary evaluator.
 * Consumes JSON output from sql/check_phase11_shadow_canary_metrics.sql section G
 * and prints a normalized decision packet for evidence logs.
 */

import fs from "node:fs";

const DEFAULT_UNRESOLVED_THRESHOLD = 0.1;
const DEFAULT_RECOVERY_THRESHOLD = 99;

const usage = () => {
  console.log(`Usage:
  node scripts/phase11_evaluate_gate_summary.mjs [--json '<json>'] [--file <path>] [--window <label>]
                                              [--unresolved-threshold <number>] [--recovery-threshold <number>]

Examples:
  node scripts/phase11_evaluate_gate_summary.mjs --file /tmp/gate-summary.json --window shadow-1
  cat /tmp/gate-summary.json | node scripts/phase11_evaluate_gate_summary.mjs --window canary-1
`);
};

const args = process.argv.slice(2);
const readArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return typeof value === "string" ? value : null;
};

const asNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

const asBool = (value, fallback = false) => {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
};

const parseRow = (input) => {
  const parsed = JSON.parse(input);
  if (Array.isArray(parsed)) {
    if (!parsed.length) throw new Error("Input JSON array is empty.");
    return parsed[0];
  }
  if (parsed && typeof parsed === "object") return parsed;
  throw new Error("Input JSON must be an object or one-row array.");
};

const readInput = () => {
  const inlineJson = readArg("--json");
  if (inlineJson) return inlineJson;

  const filePath = readArg("--file");
  if (filePath) {
    return fs.readFileSync(filePath, "utf8");
  }

  const stdin = fs.readFileSync(0, "utf8").trim();
  if (stdin) return stdin;

  return null;
};

const summarize = ({
  row,
  windowLabel,
  unresolvedThreshold,
  recoveryThreshold,
}) => {
  const duplicateSettlementCount = asNumber(row.duplicate_settlement_count);
  const duplicateMediaCount = asNumber(row.duplicate_media_persistence_count);
  const unresolvedPercent = asNumber(row.unresolved_no_media_percent);
  const recoveryPercent = asNumber(row.recovery_success_percent);
  const recoverySampleSize = asNumber(row.recovery_success_sample_size);

  const duplicateSettlementPass = asBool(
    row.duplicate_settlement_pass,
    duplicateSettlementCount === 0
  );
  const duplicateMediaPass = asBool(row.duplicate_media_persistence_pass, duplicateMediaCount === 0);
  const unresolvedPass = asBool(
    row.unresolved_no_media_pass,
    unresolvedPercent < unresolvedThreshold
  );

  const recoveryIsNA = recoverySampleSize === 0;
  const recoveryPass = recoveryIsNA
    ? null
    : asBool(row.recovery_success_pass, recoveryPercent >= recoveryThreshold);

  const requiredPasses =
    duplicateSettlementPass && duplicateMediaPass && unresolvedPass && (recoveryPass ?? true);
  const decision = requiredPasses ? "PASS" : "HOLD";

  return {
    evaluated_at_utc: new Date().toISOString(),
    window: windowLabel,
    start_at: row.start_at ?? null,
    end_at: row.end_at ?? null,
    duplicate_settlement_count: duplicateSettlementCount,
    duplicate_settlement_pass: duplicateSettlementPass,
    duplicate_media_persistence_count: duplicateMediaCount,
    duplicate_media_persistence_pass: duplicateMediaPass,
    unresolved_no_media_percent: unresolvedPercent,
    unresolved_no_media_pass: unresolvedPass,
    recovery_success_sample_size: recoverySampleSize,
    recovery_success_percent: recoveryPercent,
    recovery_success_pass: recoveryPass,
    recovery_success_evaluation: recoveryIsNA ? "N/A (sample size 0)" : recoveryPass ? "PASS" : "FAIL",
    decision,
    threshold_unresolved_percent: unresolvedThreshold,
    threshold_recovery_percent: recoveryThreshold,
  };
};

const main = () => {
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const input = readInput();
  if (!input) {
    usage();
    process.exit(1);
  }

  const unresolvedThreshold = asNumber(
    readArg("--unresolved-threshold"),
    DEFAULT_UNRESOLVED_THRESHOLD
  );
  const recoveryThreshold = asNumber(readArg("--recovery-threshold"), DEFAULT_RECOVERY_THRESHOLD);
  const windowLabel = readArg("--window") ?? "phase11-window";

  const row = parseRow(input);
  const summary = summarize({
    row,
    windowLabel,
    unresolvedThreshold,
    recoveryThreshold,
  });

  console.log("## Phase 11 Gate Evaluation");
  console.log(`- Window: ${summary.window}`);
  console.log(`- Interval: ${summary.start_at ?? "unknown"} -> ${summary.end_at ?? "unknown"}`);
  console.log(
    `- Duplicate settlement: ${summary.duplicate_settlement_count} (${summary.duplicate_settlement_pass ? "PASS" : "FAIL"})`
  );
  console.log(
    `- Duplicate media persistence: ${summary.duplicate_media_persistence_count} (${summary.duplicate_media_persistence_pass ? "PASS" : "FAIL"})`
  );
  console.log(
    `- Unresolved no-media: ${summary.unresolved_no_media_percent}% (< ${summary.threshold_unresolved_percent}% target) => ${summary.unresolved_no_media_pass ? "PASS" : "FAIL"}`
  );
  console.log(
    `- Recovery success: sample=${summary.recovery_success_sample_size}, rate=${summary.recovery_success_percent}% (>= ${summary.threshold_recovery_percent}% target) => ${summary.recovery_success_evaluation}`
  );
  console.log(`- Recommended decision: ${summary.decision}`);
  console.log("");
  console.log("```json");
  console.log(JSON.stringify(summary, null, 2));
  console.log("```");
};

try {
  main();
} catch (error) {
  console.error(`[phase11-gate-evaluator] ${error.message}`);
  process.exit(1);
}
