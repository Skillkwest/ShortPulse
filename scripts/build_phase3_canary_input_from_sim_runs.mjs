#!/usr/bin/env node
/**
 * Build a Phase 3 canary-input JSON payload from two safety-sim run outputs.
 *
 * This normalizes control/canary simulator summaries into the canonical input
 * contract consumed by `generate_phase3_canary_delta_packet.mjs`.
 *
 * Usage:
 *   node scripts/build_phase3_canary_input_from_sim_runs.mjs \
 *     --control-summary <summary.json> \
 *     --canary-summary <summary.json> \
 *     [--control-aggregates <aggregates.json>] \
 *     [--canary-aggregates <aggregates.json>] \
 *     [--ring internal_verification] \
 *     [--environment staging] \
 *     [--out <phase3-canary-input.json>]
 */

import fs from "node:fs";
import path from "node:path";

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node scripts/build_phase3_canary_input_from_sim_runs.mjs \\",
      "    --control-summary <summary.json> \\",
      "    --canary-summary <summary.json> \\",
      "    [--control-aggregates <aggregates.json>] \\",
      "    [--canary-aggregates <aggregates.json>] \\",
      "    [--ring internal_verification] \\",
      "    [--environment staging] \\",
      "    [--out <phase3-canary-input.json>]",
      "",
    ].join("\n")
  );
};

const parseArgs = (argv) => {
  const parsed = {
    controlSummary: "",
    controlAggregates: "",
    canarySummary: "",
    canaryAggregates: "",
    ring: "internal_verification",
    environment: "staging",
    out: "",
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") return { ...parsed, help: true };
    const next = argv[i + 1] ?? "";
    if (token === "--control-summary") {
      parsed.controlSummary = next;
      i += 1;
      continue;
    }
    if (token === "--control-aggregates") {
      parsed.controlAggregates = next;
      i += 1;
      continue;
    }
    if (token === "--canary-summary") {
      parsed.canarySummary = next;
      i += 1;
      continue;
    }
    if (token === "--canary-aggregates") {
      parsed.canaryAggregates = next;
      i += 1;
      continue;
    }
    if (token === "--ring") {
      parsed.ring = next || parsed.ring;
      i += 1;
      continue;
    }
    if (token === "--environment") {
      parsed.environment = next || parsed.environment;
      i += 1;
      continue;
    }
    if (token === "--out") {
      parsed.out = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }
  return parsed;
};

const readJson = (filePath) => {
  const resolved = path.resolve(process.cwd(), filePath);
  return {
    resolved,
    data: JSON.parse(fs.readFileSync(resolved, "utf8")),
  };
};

const asNumber = (value, fieldName) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected numeric field: ${fieldName}`);
  }
  return value;
};

const toIso = (value, fieldName) => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected datetime string field: ${fieldName}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid datetime in ${fieldName}`);
  }
  return parsed.toISOString();
};

const toPercent = (count, total) => {
  if (!total || total <= 0) return 0;
  return (count / total) * 100;
};

const pct = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
};

const safeReadCategoryFile = (candidatePath) => {
  try {
    const raw = fs.readFileSync(path.resolve(process.cwd(), candidatePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const summarizeRun = ({ summary, aggregates }) => {
  const totalRequests = asNumber(summary?.totals?.requests, "summary.totals.requests");
  const non200 = asNumber(summary?.totals?.non200, "summary.totals.non200");
  const fallbackFromAggregates = asNumber(aggregates?.fallback ?? 0, "aggregates.fallback");
  const missingApplyFromAggregates = asNumber(
    aggregates?.missingApplyPrompt ?? 0,
    "aggregates.missingApplyPrompt"
  );

  const categoryFiles = Array.isArray(summary?.categories) ? summary.categories : [];
  let allowTotal = 0;
  let allowRefusalCount = 0;
  let fallbackCountFromRecords = 0;
  let missingApplyCountFromRecords = 0;
  const durations = [];

  for (const category of categoryFiles) {
    const expectedOutcome =
      typeof category?.expectedOutcome === "string" ? category.expectedOutcome : "non_refusal";
    const parsedCategory = typeof category?.filePath === "string"
      ? safeReadCategoryFile(category.filePath)
      : null;
    const records = Array.isArray(parsedCategory?.records) ? parsedCategory.records : [];

    if (records.length) {
      for (const record of records) {
        const duration = Number(record?.durationMs);
        if (Number.isFinite(duration) && duration >= 0) durations.push(duration);
        if (record?.classification === "infra_fallback_200") {
          fallbackCountFromRecords += 1;
        }
        if (record?.classification === "safe_or_rewrite") {
          const applyPrompt = typeof record?.applyPrompt === "string" ? record.applyPrompt.trim() : "";
          if (!applyPrompt.length) {
            missingApplyCountFromRecords += 1;
          }
        }
        if (expectedOutcome === "non_refusal") {
          allowTotal += 1;
          if (record?.classification === "safety_refusal") {
            allowRefusalCount += 1;
          }
        }
      }
      continue;
    }

    const categoryTotal = asNumber(category?.summary?.totalRequests ?? 0, "category.summary.totalRequests");
    const refusalCount = asNumber(
      category?.summary?.classificationCounts?.safety_refusal ?? 0,
      "category.summary.classificationCounts.safety_refusal"
    );
    if (expectedOutcome === "non_refusal") {
      allowTotal += categoryTotal;
      allowRefusalCount += refusalCount;
    }
  }

  const p95LatencyMs = durations.length
    ? pct(durations, 95)
    : Math.max(
        0,
        ...categoryFiles.map((category) => Number(category?.summary?.latencyMs?.p95 ?? 0))
      );

  const fallbackCount = fallbackCountFromRecords || fallbackFromAggregates;
  const missingApplyPrompt = missingApplyCountFromRecords || missingApplyFromAggregates;

  return {
    startedAt: toIso(summary?.startedAt, "summary.startedAt"),
    finishedAt: toIso(summary?.finishedAt, "summary.finishedAt"),
    volume: totalRequests,
    metrics: {
      schema_failure_rate: toPercent(missingApplyPrompt, totalRequests),
      fallback_rate: toPercent(fallbackCount, totalRequests),
      false_refusal_rate: toPercent(allowRefusalCount, allowTotal),
      repair_rate: 0,
      p95_latency_ms: p95LatencyMs,
      error_rate: toPercent(non200, totalRequests),
    },
    derivations: {
      allow_total: allowTotal,
      allow_refusal_count: allowRefusalCount,
      missing_apply_prompt: missingApplyPrompt,
      fallback_count: fallbackCount,
      non200_count: non200,
      repair_rate_assumption: "0 (no server repair-attempt signal currently exposed in safety-sim outputs)",
    },
  };
};

const main = () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }
  if (!args.controlSummary || !args.canarySummary) {
    throw new Error("Missing required summary inputs. See --help.");
  }

  const controlSummary = readJson(args.controlSummary);
  const canarySummary = readJson(args.canarySummary);
  const controlAggregates = args.controlAggregates ? readJson(args.controlAggregates) : null;
  const canaryAggregates = args.canaryAggregates ? readJson(args.canaryAggregates) : null;

  const controlRun = summarizeRun({
    summary: controlSummary.data,
    aggregates: controlAggregates?.data ?? {},
  });
  const canaryRun = summarizeRun({
    summary: canarySummary.data,
    aggregates: canaryAggregates?.data ?? {},
  });

  const result = {
    environment: args.environment,
    ring: args.ring,
    controlWindow: {
      label: `control:${path.basename(controlSummary.resolved)}`,
      startUtc: controlRun.startedAt,
      endUtc: controlRun.finishedAt,
      volume: controlRun.volume,
    },
    canaryWindow: {
      label: `canary:${path.basename(canarySummary.resolved)}`,
      startUtc: canaryRun.startedAt,
      endUtc: canaryRun.finishedAt,
      volume: canaryRun.volume,
    },
    metrics: {
      schema_failure_rate: {
        control: controlRun.metrics.schema_failure_rate,
        canary: canaryRun.metrics.schema_failure_rate,
      },
      fallback_rate: {
        control: controlRun.metrics.fallback_rate,
        canary: canaryRun.metrics.fallback_rate,
      },
      false_refusal_rate: {
        control: controlRun.metrics.false_refusal_rate,
        canary: canaryRun.metrics.false_refusal_rate,
      },
      repair_rate: {
        control: controlRun.metrics.repair_rate,
        canary: canaryRun.metrics.repair_rate,
      },
      p95_latency_ms: {
        control: controlRun.metrics.p95_latency_ms,
        canary: canaryRun.metrics.p95_latency_ms,
      },
      error_rate: {
        control: controlRun.metrics.error_rate,
        canary: canaryRun.metrics.error_rate,
      },
    },
    derivations: {
      control: controlRun.derivations,
      canary: canaryRun.derivations,
    },
    sources: {
      control_summary: path.relative(process.cwd(), controlSummary.resolved),
      control_aggregates: controlAggregates
        ? path.relative(process.cwd(), controlAggregates.resolved)
        : null,
      canary_summary: path.relative(process.cwd(), canarySummary.resolved),
      canary_aggregates: canaryAggregates
        ? path.relative(process.cwd(), canaryAggregates.resolved)
        : null,
    },
  };

  const encoded = JSON.stringify(result, null, 2);
  if (args.out) {
    const outputPath = path.resolve(process.cwd(), args.out);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, encoded, "utf8");
    process.stdout.write(`[phase3-canary-input] wrote ${outputPath}\n`);
    return;
  }

  process.stdout.write(`${encoded}\n`);
};

try {
  main();
} catch (error) {
  process.stderr.write(
    `[phase3-canary-input] error: ${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(1);
}
