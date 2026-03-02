#!/usr/bin/env node
/**
 * Phase 11 gate-summary evaluator.
 * Consumes one-row JSON output from sql/check_phase11_shadow_canary_gate_summary_windowed.sql
 * and prints a normalized decision packet for evidence logs.
 */

import fs from "node:fs";
import {
  DEFAULT_RECOVERY_THRESHOLD,
  DEFAULT_UNRESOLVED_THRESHOLD,
  asNumber,
  parseGateRowInput,
  summarizeGateRow,
  buildSummaryLines,
} from "./lib/phase11_gate_evaluator.mjs";

const usage = () => {
  console.log(`Usage:
  node scripts/phase11_evaluate_gate_summary.mjs [--json '<json>'] [--file <path>] [--window <label>]
                                              [--unresolved-threshold <number>] [--recovery-threshold <number>]
                                              [--format text|json|both]

Examples:
  node scripts/phase11_evaluate_gate_summary.mjs --file /tmp/gate-summary.json --window shadow-1
  cat /tmp/gate-summary.json | node scripts/phase11_evaluate_gate_summary.mjs --window canary-1
  node scripts/phase11_evaluate_gate_summary.mjs --file /tmp/gate-summary.json --window canary-1 --format json
`);
};

const args = process.argv.slice(2);
const readArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return typeof value === "string" ? value : null;
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
  const outputFormat = readArg("--format") ?? "text";

  if (!["text", "json", "both"].includes(outputFormat)) {
    throw new Error(`Unsupported --format value: ${outputFormat}. Use text|json|both.`);
  }

  const row = parseGateRowInput(input);
  const summary = summarizeGateRow({
    row,
    windowLabel,
    unresolvedThreshold,
    recoveryThreshold,
  });

  if (outputFormat === "json") {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  for (const line of buildSummaryLines(summary)) {
    console.log(line);
  }

  if (outputFormat === "text") {
    console.log("");
    console.log("```json");
    console.log(JSON.stringify(summary, null, 2));
    console.log("```");
    return;
  }

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
