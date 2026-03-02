#!/usr/bin/env node
/**
 * Wave H canary evidence packet generator.
 * Purpose: turn one-row SQL JSON + evaluator summary into a markdown packet
 * that can be appended to the canonical canary window templates.
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

const args = process.argv.slice(2);

const usage = () => {
  console.log(`Usage:
  node scripts/phase13_wave_h_capture_packet.mjs --window <canary-1|canary-2>
                                                 [--json '<json>' | --file <path>]
                                                 [--unresolved-threshold <number>]
                                                 [--recovery-threshold <number>]
                                                 [--out <markdown-path>]
                                                 [--append-template]
                                                 [--template <template-path>]

Examples:
  node scripts/phase13_wave_h_capture_packet.mjs --window canary-1 --file /tmp/canary1-gate.json
  node scripts/phase13_wave_h_capture_packet.mjs --window canary-2 --file /tmp/canary2-gate.json --out /tmp/canary2-packet.md
  node scripts/phase13_wave_h_capture_packet.mjs --window canary-1 --file /tmp/canary1-gate.json --append-template
`);
};

const readArg = (flag) => {
  const index = args.indexOf(flag);
  if (index === -1) return null;
  const value = args[index + 1];
  return typeof value === "string" ? value : null;
};

const hasFlag = (flag) => args.includes(flag);

const TEMPLATE_BY_WINDOW = {
  "canary-1": "docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-canary-window-1-template.md",
  "canary-2": "docs/planning/evidence/unified-buildout/phase-13/2026-03-02-phase-13-wave-h-canary-window-2-template.md",
};

const readInput = () => {
  const inlineJson = readArg("--json");
  if (inlineJson) return inlineJson;

  const filePath = readArg("--file");
  if (filePath) return fs.readFileSync(filePath, "utf8");

  const stdin = fs.readFileSync(0, "utf8").trim();
  if (stdin) return stdin;

  return null;
};

const isHardStopBreached = (summary) => {
  if (!summary.duplicate_settlement_pass) return true;
  if (!summary.duplicate_media_persistence_pass) return true;
  if (!summary.unresolved_no_media_pass) return true;
  if (summary.recovery_success_pass === false) return true;
  return false;
};

const buildMarkdownPacket = ({ windowLabel, row, summary }) => {
  const summaryLines = buildSummaryLines(summary).join("\n");
  const hardStopBreach = isHardStopBreached(summary) ? "yes" : "no";

  return [
    `## Auto-Captured Packet (${new Date().toISOString()})`,
    "",
    `Window label: \`${windowLabel}\``,
    `Interval: \`${summary.start_at ?? "unknown"}\` -> \`${summary.end_at ?? "unknown"}\``,
    "",
    "### SQL One-Row Summary",
    "```json",
    JSON.stringify(row, null, 2),
    "```",
    "",
    "### Evaluator Summary",
    "```text",
    summaryLines,
    "```",
    "",
    "### Evaluator JSON",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    "",
    "### Decision Snapshot",
    `1. Window recommendation: \`${summary.decision}\`.`,
    `2. Hard-stop breach present: \`${hardStopBreach}\`.`,
    "3. Two-window outcome: `pending second window` (unless this is canary-2 closeout).",
  ].join("\n");
};

const main = () => {
  if (hasFlag("--help") || hasFlag("-h")) {
    usage();
    return;
  }

  const windowLabel = readArg("--window");
  if (!windowLabel) {
    throw new Error("Missing required --window.");
  }

  const input = readInput();
  if (!input) {
    throw new Error("Missing gate input. Use --file, --json, or pipe stdin.");
  }

  const unresolvedThreshold = asNumber(
    readArg("--unresolved-threshold"),
    DEFAULT_UNRESOLVED_THRESHOLD
  );
  const recoveryThreshold = asNumber(readArg("--recovery-threshold"), DEFAULT_RECOVERY_THRESHOLD);

  const row = parseGateRowInput(input);
  const summary = summarizeGateRow({
    row,
    windowLabel,
    unresolvedThreshold,
    recoveryThreshold,
  });

  const markdown = buildMarkdownPacket({ windowLabel, row, summary });

  const outPath = readArg("--out");
  if (outPath) {
    fs.writeFileSync(outPath, `${markdown}\n`, "utf8");
    console.log(`[phase13-waveh-capture] wrote packet: ${outPath}`);
  } else {
    console.log(markdown);
  }

  if (hasFlag("--append-template")) {
    const templatePath = readArg("--template") ?? TEMPLATE_BY_WINDOW[windowLabel];
    if (!templatePath) {
      throw new Error(
        `No default template mapping for window '${windowLabel}'. Pass --template explicitly.`
      );
    }
    const current = fs.readFileSync(templatePath, "utf8");
    const next = `${current.trimEnd()}\n\n---\n\n${markdown}\n`;
    fs.writeFileSync(templatePath, next, "utf8");
    console.log(`[phase13-waveh-capture] appended packet to template: ${templatePath}`);
  }
};

try {
  main();
} catch (error) {
  console.error(`[phase13-waveh-capture] ${error.message}`);
  process.exit(1);
}
