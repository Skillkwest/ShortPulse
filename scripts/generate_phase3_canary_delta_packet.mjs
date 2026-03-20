#!/usr/bin/env node
/**
 * Phase 3 canary delta packet generator.
 *
 * Converts a structured control-vs-canary metric JSON payload into a markdown
 * decision packet using the canonical threshold contract.
 *
 * Usage:
 *   node scripts/generate_phase3_canary_delta_packet.mjs \
 *     --input <json-file> \
 *     [--out <markdown-file>] \
 *     [--fail-on-decision hold,rollback]
 */

import fs from "node:fs";
import path from "node:path";

const METRIC_KEYS = [
  "schema_failure_rate",
  "fallback_rate",
  "false_refusal_rate",
  "repair_rate",
  "p95_latency_ms",
  "error_rate",
];

const THRESHOLD_CONTRACT = {
  schema_failure_rate: { warn: 0.2, hold: 0.35, rollback: 0.5, mode: "delta_pp" },
  fallback_rate: { warn: 0.5, hold: 1.0, rollback: 1.5, mode: "delta_pp" },
  false_refusal_rate: { warn: 0.75, hold: 1.25, rollback: 1.75, mode: "delta_pp" },
  repair_rate: { warn: 0.75, hold: 1.25, rollback: 1.75, mode: "delta_pp" },
  p95_latency_ms: { warn: 15, hold: 25, rollback: 35, mode: "delta_relative_percent" },
  error_rate: { warn: 0.6, hold: 0.8, rollback: 1.0, mode: "absolute" },
};

const RING_REQUIREMENTS = {
  internal_verification: { minWindowMinutes: 60, minVolume: 200 },
  preview_canary: { minWindowMinutes: 240, minVolume: 1000 },
  production_canary: { minWindowMinutes: 1440, minVolume: 5000 },
  broad_rollout_stabilization: { minWindowMinutes: 2880, minVolume: 20000 },
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/generate_phase3_canary_delta_packet.mjs --input <json-file> [--out <markdown-file>] [--fail-on-decision hold,rollback]",
      "",
      "Input fields:",
      "  ring: internal_verification|preview_canary|production_canary|broad_rollout_stabilization",
      "  environment: e.g. staging",
      "  controlWindow: { label, startUtc, endUtc, volume }",
      "  canaryWindow:  { label, startUtc, endUtc, volume }",
      "  metrics: { <metric_key>: { control, canary } }",
      "",
    ].join("\n")
  );
};

const parseArgs = (argv) => {
  const args = {
    input: "",
    out: "",
    failOnDecision: new Set(),
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      return { ...args, help: true };
    }
    if (token === "--input") {
      args.input = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--out") {
      args.out = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--fail-on-decision") {
      const raw = argv[i + 1] ?? "";
      i += 1;
      raw
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
        .forEach((v) => args.failOnDecision.add(v));
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return args;
};

const readJsonFile = (value) => {
  const resolved = path.resolve(process.cwd(), value);
  const content = fs.readFileSync(resolved, "utf8");
  return { resolved, payload: JSON.parse(content) };
};

const toUtcIso = (value, fieldName) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required string field: ${fieldName}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime field: ${fieldName}`);
  }
  return parsed.toISOString();
};

const toNumber = (value, fieldName) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing required numeric field: ${fieldName}`);
  }
  return value;
};

const computeComparedValue = ({ key, control, canary }) => {
  const threshold = THRESHOLD_CONTRACT[key];
  if (threshold.mode === "absolute") return canary;
  if (threshold.mode === "delta_pp") return canary - control;
  if (control <= 0) return canary <= 0 ? 0 : Number.POSITIVE_INFINITY;
  return ((canary - control) / control) * 100;
};

const breachLevel = ({ key, comparedValue }) => {
  const threshold = THRESHOLD_CONTRACT[key];
  if (comparedValue > threshold.rollback) return "rollback";
  if (comparedValue > threshold.hold) return "hold";
  if (comparedValue > threshold.warn) return "warn";
  return "none";
};

const formatMetricValue = ({ key, value }) => {
  if (!Number.isFinite(value)) return "inf";
  if (key === "p95_latency_ms") return `${value.toFixed(2)}%`;
  if (THRESHOLD_CONTRACT[key]?.mode === "absolute") return `${value.toFixed(3)}%`;
  return `${value.toFixed(3)}pp`;
};

const formatRawMetric = ({ key, value }) => {
  if (key === "p95_latency_ms") return `${Math.round(value)} ms`;
  return `${value.toFixed(3)}%`;
};

const evaluateDecision = ({ ring, observedWindowMinutes, observedVolume, rows }) => {
  const requirement = RING_REQUIREMENTS[ring];
  const windowMet = observedWindowMinutes >= requirement.minWindowMinutes;
  const volumeMet = observedVolume >= requirement.minVolume;
  if (!windowMet || !volumeMet) {
    return {
      decision: "insufficient_data",
      requirement,
      windowMet,
      volumeMet,
    };
  }
  if (rows.some((row) => row.breach === "rollback")) {
    return { decision: "rollback", requirement, windowMet, volumeMet };
  }
  if (rows.some((row) => row.breach === "hold")) {
    return { decision: "hold", requirement, windowMet, volumeMet };
  }
  if (rows.some((row) => row.breach === "warn")) {
    return { decision: "warn", requirement, windowMet, volumeMet };
  }
  return { decision: "promote", requirement, windowMet, volumeMet };
};

const renderMarkdown = ({ payload, inputPath, rows, decisionResult, observedWindowMinutes }) => {
  const capturedAt = new Date().toISOString();
  const metricRows = rows
    .map((row) => {
      const threshold = THRESHOLD_CONTRACT[row.key];
      const thresholdLabel =
        threshold.mode === "absolute"
          ? `warn>${threshold.warn.toFixed(2)}% hold>${threshold.hold.toFixed(2)}% rollback>${threshold.rollback.toFixed(2)}%`
          : threshold.mode === "delta_relative_percent"
            ? `warn>${threshold.warn.toFixed(2)}% hold>${threshold.hold.toFixed(2)}% rollback>${threshold.rollback.toFixed(2)}%`
            : `warn>+${threshold.warn.toFixed(2)}pp hold>+${threshold.hold.toFixed(2)}pp rollback>+${threshold.rollback.toFixed(2)}pp`;
      return `| ${row.key} | ${formatRawMetric({ key: row.key, value: row.control })} | ${formatRawMetric({ key: row.key, value: row.canary })} | ${formatMetricValue({ key: row.key, value: row.comparedValue })} | ${row.breach} | ${thresholdLabel} |`;
    })
    .join("\n");

  return [
    "# Phase 3 Evidence - Staging Canary Delta Packet",
    "",
    `Date: ${capturedAt.slice(0, 10)}  `,
    `Captured At: ${capturedAt}  `,
    `Environment: ${payload.environment}  `,
    `Ring: ${payload.ring}  `,
    `Decision: ${decisionResult.decision}`,
    "",
    "## Observation Windows",
    `1. Control window: ${payload.controlWindow.label} (${payload.controlWindow.startUtc} -> ${payload.controlWindow.endUtc}), volume=${payload.controlWindow.volume}`,
    `2. Canary window: ${payload.canaryWindow.label} (${payload.canaryWindow.startUtc} -> ${payload.canaryWindow.endUtc}), volume=${payload.canaryWindow.volume}`,
    `3. Canary observed duration: ${observedWindowMinutes} minutes`,
    "",
    "## Gate Sufficiency",
    `1. Required window minutes: ${decisionResult.requirement.minWindowMinutes} (met=${decisionResult.windowMet})`,
    `2. Required volume: ${decisionResult.requirement.minVolume} (met=${decisionResult.volumeMet})`,
    "",
    "## Metric Deltas",
    "| Metric | Control | Canary | Compared | Breach | Contract thresholds |",
    "| --- | --- | --- | --- | --- | --- |",
    metricRows,
    "",
    "## Source",
    `1. Input file: \`${toDisplayPath(inputPath)}\``,
    "2. Threshold contract: `docs/planning/ai-studio-agent-pipeline-regression-threshold-contract-2026-03-20.md`",
    "",
    "## Notes",
    "1. This packet is generated by `scripts/generate_phase3_canary_delta_packet.mjs`.",
    "2. Promote/hold/rollback decisions are deterministic from the threshold contract.",
    "",
  ].join("\n");
};

const toDisplayPath = (candidatePath) => {
  const cwd = process.cwd();
  const relative = path.relative(cwd, candidatePath);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return relative;
  }
  return candidatePath;
};

const main = () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.input) {
    throw new Error("Missing required --input argument.");
  }
  const { resolved: inputPath, payload } = readJsonFile(args.input);

  if (!RING_REQUIREMENTS[payload.ring]) {
    throw new Error(`Invalid ring value: ${payload.ring}`);
  }
  if (typeof payload.environment !== "string" || !payload.environment.trim()) {
    throw new Error("Missing required field: environment");
  }

  const controlStart = toUtcIso(payload.controlWindow?.startUtc, "controlWindow.startUtc");
  const controlEnd = toUtcIso(payload.controlWindow?.endUtc, "controlWindow.endUtc");
  const canaryStart = toUtcIso(payload.canaryWindow?.startUtc, "canaryWindow.startUtc");
  const canaryEnd = toUtcIso(payload.canaryWindow?.endUtc, "canaryWindow.endUtc");
  const controlVolume = toNumber(payload.controlWindow?.volume, "controlWindow.volume");
  const canaryVolume = toNumber(payload.canaryWindow?.volume, "canaryWindow.volume");
  const controlLabel = String(payload.controlWindow?.label ?? "control");
  const canaryLabel = String(payload.canaryWindow?.label ?? "canary");

  const normalizedPayload = {
    ...payload,
    controlWindow: {
      ...payload.controlWindow,
      startUtc: controlStart,
      endUtc: controlEnd,
      volume: controlVolume,
      label: controlLabel,
    },
    canaryWindow: {
      ...payload.canaryWindow,
      startUtc: canaryStart,
      endUtc: canaryEnd,
      volume: canaryVolume,
      label: canaryLabel,
    },
  };

  const rows = METRIC_KEYS.map((key) => {
    const metric = normalizedPayload.metrics?.[key];
    const control = toNumber(metric?.control, `metrics.${key}.control`);
    const canary = toNumber(metric?.canary, `metrics.${key}.canary`);
    const comparedValue = computeComparedValue({ key, control, canary });
    return {
      key,
      control,
      canary,
      comparedValue,
      breach: breachLevel({ key, comparedValue }),
    };
  });

  const observedWindowMinutes = Math.max(
    0,
    Math.floor((new Date(canaryEnd).getTime() - new Date(canaryStart).getTime()) / 60000)
  );
  const decisionResult = evaluateDecision({
    ring: normalizedPayload.ring,
    observedWindowMinutes,
    observedVolume: canaryVolume,
    rows,
  });

  const markdown = renderMarkdown({
    payload: normalizedPayload,
    inputPath,
    rows,
    decisionResult,
    observedWindowMinutes,
  });

  if (args.out) {
    const outputPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown, "utf8");
    process.stdout.write(`[phase3-canary] wrote ${outputPath}\n`);
  } else {
    process.stdout.write(`${markdown}\n`);
  }

  if (args.failOnDecision.has(decisionResult.decision)) {
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  process.stderr.write(`[phase3-canary] error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
}
