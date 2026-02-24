#!/usr/bin/env node
// Generates a standardized Phase 5 rollout gate snapshot section from structured input.
// Usage:
//   node scripts/generate_phase5_rollout_snapshot.js --input <json-file> [--append-to <md-file>] [--write <md-file>] [--fail-on-freeze]
const fs = require("fs");
const path = require("path");

const METRIC_THRESHOLDS = {
  p95MsMax: 4500,
  p99MsMax: 8000,
  error5xxPctMax: 1.0,
  timeoutPctMax: 1.0,
  refusalDeltaPpMax: 2.0,
  continuitySliPctMin: 99.5,
};

const toAbsolutePath = (value) => {
  if (!value) return "";
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};

const parseArgs = (argv) => {
  const args = {
    input: "",
    appendTo: "",
    write: "",
    failOnFreeze: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") {
      args.input = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--append-to") {
      args.appendTo = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--write") {
      args.write = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--fail-on-freeze") {
      args.failOnFreeze = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      return { ...args, help: true };
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
};

const usage = () => {
  return [
    "Usage:",
    "  node scripts/generate_phase5_rollout_snapshot.js --input <json-file> [--append-to <md-file>] [--write <md-file>] [--fail-on-freeze]",
    "",
    "Options:",
    "  --input          Required. JSON input file for snapshot data.",
    "  --append-to      Optional. Append generated markdown to an existing file.",
    "  --write          Optional. Write generated markdown to a target file.",
    "  --fail-on-freeze Optional. Exit 1 when decision resolves to FREEZE.",
  ].join("\n");
};

const readRequiredNumber = (value, fieldName) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Invalid or missing numeric field: ${fieldName}`);
  }
  return value;
};

const readRequiredString = (value, fieldName) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Invalid or missing string field: ${fieldName}`);
  }
  return value.trim();
};

const readRequiredBoolean = (value, fieldName) => {
  if (typeof value !== "boolean") {
    throw new Error(`Invalid or missing boolean field: ${fieldName}`);
  }
  return value;
};

const formatPct = (value) => `${value.toFixed(3)}%`;
const formatMs = (value) => `${Math.round(value)} ms`;

const evaluateSnapshot = (payload) => {
  const ring = readRequiredString(payload.ring, "ring");
  const environment = readRequiredString(payload.environment, "environment");
  const startUtc = readRequiredString(payload.startUtc, "startUtc");
  const endUtc = readRequiredString(payload.endUtc, "endUtc");

  const metrics = payload.metrics ?? {};
  const p95Ms = readRequiredNumber(metrics.p95Ms, "metrics.p95Ms");
  const p99Ms = readRequiredNumber(metrics.p99Ms, "metrics.p99Ms");
  const error5xxPct = readRequiredNumber(metrics.error5xxPct, "metrics.error5xxPct");
  const timeoutPct = readRequiredNumber(metrics.timeoutPct, "metrics.timeoutPct");
  const refusalDeltaPp = readRequiredNumber(metrics.refusalDeltaPp, "metrics.refusalDeltaPp");
  const continuitySliPct = readRequiredNumber(metrics.continuitySliPct, "metrics.continuitySliPct");

  const gates = payload.gates ?? {};
  const requiredChecksGreen = readRequiredBoolean(
    gates.requiredChecksGreen,
    "gates.requiredChecksGreen"
  );
  const contractAndContinuityGreen = readRequiredBoolean(
    gates.contractAndContinuityGreen,
    "gates.contractAndContinuityGreen"
  );
  const noSev1Sev2 = readRequiredBoolean(gates.noSev1Sev2, "gates.noSev1Sev2");
  const rollbackVerified = readRequiredBoolean(gates.rollbackVerified, "gates.rollbackVerified");

  const outcomeClassCounts =
    payload.outcomeClassCounts && typeof payload.outcomeClassCounts === "object"
      ? payload.outcomeClassCounts
      : {};
  const outcomeKeys = [
    "success_prompt",
    "refusal_model",
    "refusal_safety",
    "upstream_error",
    "route_error",
  ];

  const normalizedOutcomeCounts = outcomeKeys.reduce((acc, key) => {
    const raw = outcomeClassCounts[key];
    const count = typeof raw === "number" && raw >= 0 ? raw : 0;
    return { ...acc, [key]: count };
  }, {});
  const outcomeTotal = Object.values(normalizedOutcomeCounts).reduce((sum, value) => sum + value, 0);

  const metricChecks = [
    {
      name: "p95 latency",
      actual: p95Ms,
      threshold: METRIC_THRESHOLDS.p95MsMax,
      pass: p95Ms <= METRIC_THRESHOLDS.p95MsMax,
      formatter: formatMs,
    },
    {
      name: "p99 latency",
      actual: p99Ms,
      threshold: METRIC_THRESHOLDS.p99MsMax,
      pass: p99Ms <= METRIC_THRESHOLDS.p99MsMax,
      formatter: formatMs,
    },
    {
      name: "5xx rate",
      actual: error5xxPct,
      threshold: METRIC_THRESHOLDS.error5xxPctMax,
      pass: error5xxPct <= METRIC_THRESHOLDS.error5xxPctMax,
      formatter: formatPct,
    },
    {
      name: "timeout rate",
      actual: timeoutPct,
      threshold: METRIC_THRESHOLDS.timeoutPctMax,
      pass: timeoutPct <= METRIC_THRESHOLDS.timeoutPctMax,
      formatter: formatPct,
    },
    {
      name: "refusal delta",
      actual: refusalDeltaPp,
      threshold: METRIC_THRESHOLDS.refusalDeltaPpMax,
      pass: refusalDeltaPp <= METRIC_THRESHOLDS.refusalDeltaPpMax,
      formatter: formatPct,
    },
    {
      name: "continuity SLI",
      actual: continuitySliPct,
      threshold: METRIC_THRESHOLDS.continuitySliPctMin,
      pass: continuitySliPct >= METRIC_THRESHOLDS.continuitySliPctMin,
      formatter: formatPct,
      reverseThreshold: true,
    },
  ];

  const controlChecks = [
    { name: "required checks green", pass: requiredChecksGreen },
    { name: "contract + continuity suites green", pass: contractAndContinuityGreen },
    { name: "no open Sev-1/Sev-2", pass: noSev1Sev2 },
    { name: "rollback verified", pass: rollbackVerified },
  ];

  const allMetricChecksPass = metricChecks.every((check) => check.pass);
  const allControlChecksPass = controlChecks.every((check) => check.pass);
  const decision = allMetricChecksPass && allControlChecksPass ? "PASS" : "FREEZE";

  const links =
    payload.links && typeof payload.links === "object"
      ? {
          dashboard: typeof payload.links.dashboard === "string" ? payload.links.dashboard : "",
          ciRun: typeof payload.links.ciRun === "string" ? payload.links.ciRun : "",
          tracker: typeof payload.links.tracker === "string" ? payload.links.tracker : "",
        }
      : { dashboard: "", ciRun: "", tracker: "" };

  const approver = typeof payload.approver === "string" ? payload.approver.trim() : "";
  const operator = typeof payload.operator === "string" ? payload.operator.trim() : "";

  return {
    ring,
    environment,
    startUtc,
    endUtc,
    metricChecks,
    controlChecks,
    decision,
    normalizedOutcomeCounts,
    outcomeTotal,
    links,
    approver,
    operator,
  };
};

const renderSnapshotMarkdown = (evaluation) => {
  const generatedAt = new Date().toISOString();
  const metricRows = evaluation.metricChecks
    .map((check) => {
      const thresholdLabel = check.reverseThreshold
        ? `>= ${check.formatter(check.threshold)}`
        : `<= ${check.formatter(check.threshold)}`;
      return `| ${check.name} | ${check.formatter(check.actual)} | ${thresholdLabel} | ${check.pass ? "Pass" : "Fail"} |`;
    })
    .join("\n");

  const controlRows = evaluation.controlChecks
    .map((check) => `| ${check.name} | ${check.pass ? "Pass" : "Fail"} |`)
    .join("\n");

  const outcomeRows = Object.entries(evaluation.normalizedOutcomeCounts)
    .map(([key, value]) => {
      const share = evaluation.outcomeTotal > 0 ? (value / evaluation.outcomeTotal) * 100 : 0;
      return `| ${key} | ${value} | ${share.toFixed(2)}% |`;
    })
    .join("\n");

  const decisionReason = evaluation.decision === "PASS" ? "all metric and control gates passed" : "one or more gates failed";
  const linksSection = [
    `- Dashboard: ${evaluation.links.dashboard || "N/A"}`,
    `- CI run: ${evaluation.links.ciRun || "N/A"}`,
    `- Tracker: ${evaluation.links.tracker || "N/A"}`,
  ].join("\n");

  return [
    `## Automated Gate Snapshot: ${evaluation.ring}`,
    "",
    `- Generated at (UTC): ${generatedAt}`,
    `- Environment: ${evaluation.environment}`,
    `- Window: ${evaluation.startUtc} -> ${evaluation.endUtc}`,
    `- Operator: ${evaluation.operator || "N/A"}`,
    `- Approver: ${evaluation.approver || "TBD"}`,
    "",
    "### Metric Gates",
    "| Metric | Actual | Threshold | Status |",
    "| --- | --- | --- | --- |",
    metricRows,
    "",
    "### Control Gates",
    "| Gate | Status |",
    "| --- | --- |",
    controlRows,
    "",
    "### Outcome Class Mix",
    "| Outcome Class | Count | Share |",
    "| --- | --- | --- |",
    outcomeRows,
    "",
    `### Decision: ${evaluation.decision}`,
    `Reason: ${decisionReason}.`,
    "",
    "### Evidence Links",
    linksSection,
    "",
  ].join("\n");
};

const writeOutput = ({ markdown, appendTo, write }) => {
  if (write) {
    const writePath = toAbsolutePath(write);
    fs.mkdirSync(path.dirname(writePath), { recursive: true });
    fs.writeFileSync(writePath, markdown, "utf8");
  }

  if (appendTo) {
    const appendPath = toAbsolutePath(appendTo);
    fs.mkdirSync(path.dirname(appendPath), { recursive: true });
    const current = fs.existsSync(appendPath) ? fs.readFileSync(appendPath, "utf8") : "";
    const normalizedCurrent = current.trimEnd();
    const nextContent = normalizedCurrent.length
      ? `${normalizedCurrent}\n\n${markdown.trimEnd()}\n`
      : `${markdown.trimEnd()}\n`;
    fs.writeFileSync(appendPath, nextContent, "utf8");
  }

  if (!write && !appendTo) {
    process.stdout.write(`${markdown}\n`);
  }
};

const main = () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  if (!args.input) {
    throw new Error("Missing required --input argument.");
  }
  if (args.write && args.appendTo) {
    throw new Error("Use only one of --write or --append-to per invocation.");
  }

  const inputPath = toAbsolutePath(args.input);
  const raw = fs.readFileSync(inputPath, "utf8");
  const payload = JSON.parse(raw);
  const evaluation = evaluateSnapshot(payload);
  const markdown = renderSnapshotMarkdown(evaluation);
  writeOutput({
    markdown,
    appendTo: args.appendTo,
    write: args.write,
  });

  if (args.failOnFreeze && evaluation.decision === "FREEZE") {
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[phase-5-snapshot] ${message}`);
  console.error(usage());
  process.exit(1);
}
