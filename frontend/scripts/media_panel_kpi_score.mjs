#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const KPI_PACKET_VERSION = 2;
const SUPPORTED_PACKET_VERSIONS = new Set([1, 2]);

const SURFACE_PROFILES = {
  "ai-studio-panel": {
    label: "AI Studio Media Panel",
    notes:
      "Primary Libraries > Media panel inside AI Studio. Optimize for fast first paint, low resolver churn, and zero trust-breaking display errors.",
  },
  "elements-media-panel": {
    label: "Elements Embedded Media Panel",
    notes:
      "Embedded Media panel inside Elements. Optimize for the same preview/runtime contract while guarding against embed-shell overhead.",
  },
};

const METRIC_DEFS = [
  {
    key: "firstMediaPaintP95Ms",
    label: "First media paint p95",
    category: "speed",
    weight: 16,
    target: 700,
    fail: 2500,
    unit: "ms",
    min: 0,
  },
  {
    key: "loadingStateVisibleMsP95",
    label: "Loading state visible p95",
    category: "speed",
    weight: 10,
    target: 900,
    fail: 5000,
    unit: "ms",
    min: 0,
  },
  {
    key: "openToFirstMediaP95Ms",
    label: "Open to first media p95",
    category: "speed",
    weight: 14,
    target: 1100,
    fail: 4000,
    unit: "ms",
    min: 0,
  },
  {
    key: "stableContentSettleMsP95",
    label: "Stable content settle p95",
    category: "speed",
    weight: 10,
    target: 1600,
    fail: 6500,
    unit: "ms",
    min: 0,
  },
  {
    key: "signBatchP95Ms",
    label: "Sign batch p95",
    category: "speed",
    weight: 8,
    target: 180,
    fail: 900,
    unit: "ms",
    min: 0,
  },
  {
    key: "resolveCallsPerOpen",
    label: "Resolve calls per open",
    category: "efficiency",
    weight: 8,
    target: 0.15,
    fail: 1.5,
    unit: "calls/open",
    min: 0,
  },
  {
    key: "fallbackCallsPerOpen",
    label: "Fallback calls per open",
    category: "efficiency",
    weight: 6,
    target: 0.05,
    fail: 0.75,
    unit: "calls/open",
    min: 0,
  },
  {
    key: "stateFlipCountPerOpen",
    label: "Visible state flips per open",
    category: "efficiency",
    weight: 4,
    target: 0.2,
    fail: 3,
    unit: "flips/open",
    min: 0,
  },
  {
    key: "extraListCallsPerOpen",
    label: "Extra list calls per open",
    category: "efficiency",
    weight: 6,
    target: 0.1,
    fail: 1.1,
    unit: "calls/open",
    min: 0,
  },
  {
    key: "signFailedRatio",
    label: "Sign failed ratio",
    category: "reliability",
    weight: 7,
    target: 0.01,
    fail: 0.2,
    unit: "ratio",
    min: 0,
    max: 1,
  },
  {
    key: "resolveFailedRatio",
    label: "Resolve failed ratio",
    category: "reliability",
    weight: 7,
    target: 0.01,
    fail: 0.25,
    unit: "ratio",
    min: 0,
    max: 1,
  },
  {
    key: "fallbackFailedRatio",
    label: "Fallback failed ratio",
    category: "reliability",
    weight: 6,
    target: 0.01,
    fail: 0.4,
    unit: "ratio",
    min: 0,
    max: 1,
  },
  {
    key: "consoleErrorsPerOpen",
    label: "Console errors per open",
    category: "reliability",
    weight: 5,
    target: 0,
    fail: 2,
    unit: "errors/open",
    min: 0,
  },
  {
    key: "visualRegressionCount",
    label: "Visual regression count",
    category: "correctness",
    weight: 4,
    target: 0,
    fail: 2,
    unit: "count",
    min: 0,
  },
  {
    key: "missingPreviewRatio",
    label: "Missing preview ratio",
    category: "correctness",
    weight: 4,
    target: 0.01,
    fail: 0.4,
    unit: "ratio",
    min: 0,
    max: 1,
  },
  {
    key: "canonicalPreviewCoverageRatio",
    label: "Canonical preview coverage ratio",
    category: "correctness",
    weight: 8,
    target: 0.98,
    fail: 0.6,
    unit: "ratio",
    direction: "higher",
    min: 0,
    max: 1,
  },
  {
    key: "emptyStateMismatchCount",
    label: "Empty state mismatch count",
    category: "correctness",
    weight: 2,
    target: 0,
    fail: 2,
    unit: "count",
    min: 0,
  },
  {
    key: "saveRoundtripFailureRate",
    label: "Save roundtrip failure rate",
    category: "persistence",
    weight: 12,
    target: 0,
    fail: 0.25,
    unit: "ratio",
    optional: true,
    min: 0,
    max: 1,
  },
  {
    key: "saveRoundtripMismatchRate",
    label: "Save roundtrip mismatch rate",
    category: "persistence",
    weight: 5,
    target: 0,
    fail: 0.2,
    unit: "ratio",
    optional: true,
    min: 0,
    max: 1,
  },
  {
    key: "saveBrowseReadyRatio",
    label: "Save browse-ready ratio",
    category: "persistence",
    weight: 8,
    target: 0.98,
    fail: 0.7,
    unit: "ratio",
    direction: "higher",
    optional: true,
    min: 0,
    max: 1,
  },
];

const CATEGORY_ORDER = [
  ["speed", "Speed"],
  ["efficiency", "Efficiency"],
  ["reliability", "Reliability"],
  ["correctness", "Correctness"],
  ["persistence", "Persistence"],
];

const TOTAL_POSSIBLE_WEIGHT = METRIC_DEFS.reduce((sum, metric) => sum + metric.weight, 0);
const METRIC_KEYS = new Set(METRIC_DEFS.map((metric) => metric.key));

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

const toFiniteNumber = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const lowerBetterScore = ({ value, target, fail }) => {
  if (value <= target) return 100;
  if (value >= fail) return 0;
  const ratio = (value - target) / (fail - target);
  return Math.round((1 - ratio) * 100);
};

const higherBetterScore = ({ value, target, fail }) => {
  if (value >= target) return 100;
  if (value <= fail) return 0;
  const ratio = (value - fail) / (target - fail);
  return Math.round(ratio * 100);
};

export const scoreMetric = (metricDef, value) => {
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) {
    return {
      ...metricDef,
      present: false,
      value: null,
      score: null,
      weightedScore: 0,
    };
  }
  const score =
    metricDef.direction === "higher"
      ? higherBetterScore({
          value: numericValue,
          target: metricDef.target,
          fail: metricDef.fail,
        })
      : lowerBetterScore({
          value: numericValue,
          target: metricDef.target,
          fail: metricDef.fail,
        });
  return {
    ...metricDef,
    present: true,
    value: numericValue,
    score,
    weightedScore: (score / 100) * metricDef.weight,
  };
};

const gradeScore = (score10) => {
  if (score10 >= 9.4) return "A+";
  if (score10 >= 9.0) return "A";
  if (score10 >= 8.5) return "A-";
  if (score10 >= 8.0) return "B+";
  if (score10 >= 7.4) return "B";
  if (score10 >= 6.8) return "B-";
  if (score10 >= 6.2) return "C+";
  if (score10 >= 5.6) return "C";
  if (score10 >= 5.0) return "C-";
  if (score10 >= 4.0) return "D";
  return "F";
};

const readinessLabel = (score10) => {
  if (score10 >= 8.5) return "strong";
  if (score10 >= 7.0) return "usable with debt";
  if (score10 >= 5.5) return "fragile";
  return "unacceptable";
};

const evidenceLabel = (coverage, sampleCount) => {
  const coverageEvidence =
    coverage >= 0.9 ? "high" : coverage >= 0.75 ? "medium" : coverage >= 0.5 ? "low" : "insufficient";
  const sampleEvidence =
    sampleCount == null
      ? "low"
      : sampleCount >= 10
        ? "high"
        : sampleCount >= 5
          ? "medium"
          : sampleCount >= 2
            ? "low"
            : "insufficient";
  const ranking = ["insufficient", "low", "medium", "high"];
  return ranking[Math.min(ranking.indexOf(coverageEvidence), ranking.indexOf(sampleEvidence))];
};

const validateTemplateSurface = (surface) => {
  if (!SURFACE_PROFILES[surface]) {
    throw new Error(
      `Unknown template surface: ${surface || "<missing>"}. Expected one of ${Object.keys(
        SURFACE_PROFILES
      ).join(", ")}.`
    );
  }
};

const validateMetricValue = (metricDef, metricValue) => {
  if (metricValue == null) return;
  const numericValue = toFiniteNumber(metricValue);
  if (numericValue == null) {
    throw new Error(`Invalid metric value for ${metricDef.key}. Expected a finite number or null.`);
  }
  if (metricDef.min != null && numericValue < metricDef.min) {
    throw new Error(
      `Invalid metric value for ${metricDef.key}. Expected value >= ${metricDef.min}.`
    );
  }
  if (metricDef.max != null && numericValue > metricDef.max) {
    throw new Error(
      `Invalid metric value for ${metricDef.key}. Expected value <= ${metricDef.max}.`
    );
  }
};

const ensureStringOrNull = (value, fieldName) => {
  if (value == null) return null;
  const normalized = normalizeString(value);
  if (!normalized) throw new Error(`Invalid ${fieldName}. Expected a non-empty string or null.`);
  return normalized;
};

const ensureSampleCountOrNull = (value) => {
  if (value == null) return null;
  const numericValue = toFiniteNumber(value);
  if (numericValue == null || numericValue < 1) {
    throw new Error("Invalid sampleCount. Expected a positive finite number or null.");
  }
  return numericValue;
};

const validatePacket = (packet) => {
  if (!packet || typeof packet !== "object" || Array.isArray(packet)) {
    throw new Error("Invalid KPI packet. Expected a JSON object.");
  }

  const packetVersion = toFiniteNumber(packet.packetVersion);
  if (packetVersion == null || !SUPPORTED_PACKET_VERSIONS.has(packetVersion)) {
    throw new Error(
      `Unsupported packetVersion: ${packet.packetVersion ?? "<missing>"}. Expected one of ${Array.from(
        SUPPORTED_PACKET_VERSIONS
      ).join(", ")}.`
    );
  }

  const surface = normalizeString(packet.surface);
  if (!SURFACE_PROFILES[surface]) {
    throw new Error(
      `Unknown packet surface: ${surface || "<missing>"}. Expected one of ${Object.keys(
        SURFACE_PROFILES
      ).join(", ")}.`
    );
  }

  if (packet.notes != null) {
    if (!Array.isArray(packet.notes) || packet.notes.some((note) => typeof note !== "string")) {
      throw new Error("Invalid notes. Expected an array of strings.");
    }
  }

  const metrics = packet.metrics;
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    throw new Error("Invalid metrics. Expected an object keyed by metric name.");
  }

  const unknownMetricKeys = Object.keys(metrics).filter((key) => !METRIC_KEYS.has(key));
  if (unknownMetricKeys.length > 0) {
    throw new Error(`Unknown metric keys: ${unknownMetricKeys.join(", ")}.`);
  }

  for (const metricDef of METRIC_DEFS) {
    validateMetricValue(metricDef, metrics[metricDef.key]);
  }

  return {
    packetVersion,
    surface,
    measuredAt: ensureStringOrNull(packet.measuredAt, "measuredAt"),
    environment: ensureStringOrNull(packet.environment, "environment"),
    captureMode: ensureStringOrNull(packet.captureMode, "captureMode"),
    sampleCount: ensureSampleCountOrNull(packet.sampleCount),
    notes: Array.isArray(packet.notes) ? packet.notes : [],
    metrics,
  };
};

const applyScoreCaps = ({ coverage, sampleCount, scoredMetrics, rawOverallScore10 }) => {
  let cappedScore10 = rawOverallScore10;
  const capReasons = [];

  if (coverage < 0.5) {
    cappedScore10 = Math.min(cappedScore10, 4.9);
    capReasons.push("coverage below 50%");
  } else if (coverage < 0.75) {
    cappedScore10 = Math.min(cappedScore10, 6.0);
    capReasons.push("coverage below 75%");
  }

  if (sampleCount != null) {
    if (sampleCount < 2) {
      cappedScore10 = Math.min(cappedScore10, 4.9);
      capReasons.push("sample count below 2");
    } else if (sampleCount < 5) {
      cappedScore10 = Math.min(cappedScore10, 6.5);
      capReasons.push("sample count below 5");
    }
  }

  const findMetricValue = (key) =>
    scoredMetrics.find((metric) => metric.key === key && metric.present)?.value ?? null;

  if ((findMetricValue("visualRegressionCount") ?? 0) > 0) {
    cappedScore10 = Math.min(cappedScore10, 5.5);
    capReasons.push("visual regressions observed");
  }
  if ((findMetricValue("emptyStateMismatchCount") ?? 0) > 0) {
    cappedScore10 = Math.min(cappedScore10, 5.5);
    capReasons.push("empty-state mismatch observed");
  }
  if ((findMetricValue("consoleErrorsPerOpen") ?? 0) >= 1) {
    cappedScore10 = Math.min(cappedScore10, 6.0);
    capReasons.push("console errors observed");
  }
  if ((findMetricValue("saveRoundtripFailureRate") ?? 0) > 0.05) {
    cappedScore10 = Math.min(cappedScore10, 5.5);
    capReasons.push("save roundtrip failures exceeded 5%");
  }

  return {
    overallScore10: Number(cappedScore10.toFixed(2)),
    scoreCapsApplied: Array.from(new Set(capReasons)),
  };
};

export const buildTemplatePacket = (surface) => {
  validateTemplateSurface(surface);
  return {
    packetVersion: KPI_PACKET_VERSION,
    measuredAt: null,
    environment: null,
    captureMode: null,
    sampleCount: null,
    surface,
    notes: [
      "Populate this packet from live panel telemetry, browser audit output, and manual interaction observations.",
    ],
    metrics: Object.fromEntries(METRIC_DEFS.map((metric) => [metric.key, null])),
  };
};

export const scorePacket = (packet) => {
  const validated = validatePacket(packet);
  const profile = SURFACE_PROFILES[validated.surface];
  const metrics = validated.metrics;
  const scoredMetrics = METRIC_DEFS.map((metricDef) => scoreMetric(metricDef, metrics[metricDef.key]));

  const measuredWeight = scoredMetrics
    .filter((metric) => metric.present)
    .reduce((sum, metric) => sum + metric.weight, 0);
  const weightedScore = scoredMetrics.reduce((sum, metric) => sum + metric.weightedScore, 0);
  const normalizedScore100 = measuredWeight > 0 ? (weightedScore / measuredWeight) * 100 : 0;
  const rawOverallScore10 = Number((normalizedScore100 / 10).toFixed(2));
  const coverage = Number((measuredWeight / TOTAL_POSSIBLE_WEIGHT).toFixed(4));
  const evidence = evidenceLabel(coverage, validated.sampleCount);
  const { overallScore10, scoreCapsApplied } = applyScoreCaps({
    coverage,
    sampleCount: validated.sampleCount,
    scoredMetrics,
    rawOverallScore10,
  });

  const categories = CATEGORY_ORDER.map(([categoryKey, categoryLabel]) => {
    const categoryMetrics = scoredMetrics.filter((metric) => metric.category === categoryKey);
    const categoryMeasuredWeight = categoryMetrics
      .filter((metric) => metric.present)
      .reduce((sum, metric) => sum + metric.weight, 0);
    const categoryWeightedScore = categoryMetrics.reduce(
      (sum, metric) => sum + metric.weightedScore,
      0
    );
    const score100 =
      categoryMeasuredWeight > 0 ? (categoryWeightedScore / categoryMeasuredWeight) * 100 : null;
    return {
      key: categoryKey,
      label: categoryLabel,
      measuredWeight: categoryMeasuredWeight,
      score100: score100 == null ? null : Number(score100.toFixed(1)),
      score10: score100 == null ? null : Number((score100 / 10).toFixed(2)),
      metrics: categoryMetrics,
    };
  });

  const missingMetrics = scoredMetrics
    .filter((metric) => !metric.present)
    .map((metric) => metric.key);

  return {
    packetVersion: validated.packetVersion,
    measuredAt: validated.measuredAt,
    environment: validated.environment,
    captureMode: validated.captureMode,
    sampleCount: validated.sampleCount,
    surface: validated.surface,
    surfaceLabel: profile.label,
    surfaceNotes: profile.notes,
    rawOverallScore10,
    overallScore10,
    overallScore100: Number(normalizedScore100.toFixed(1)),
    grade: evidence === "insufficient" ? "I" : gradeScore(overallScore10),
    readiness: evidence === "insufficient" ? "insufficient evidence" : readinessLabel(overallScore10),
    evidence,
    coverage,
    measuredWeight,
    totalPossibleWeight: TOTAL_POSSIBLE_WEIGHT,
    scoreCapsApplied,
    missingMetrics,
    categories,
  };
};

export const buildMarkdownReport = (scored) => {
  const lines = [
    `# Media Panel KPI Report`,
    "",
    `- Surface: ${scored.surfaceLabel} (\`${scored.surface}\`)`,
    `- Packet version: ${scored.packetVersion}`,
    `- Environment: ${scored.environment ?? "not provided"}`,
    `- Capture mode: ${scored.captureMode ?? "not provided"}`,
    `- Sample count: ${scored.sampleCount ?? "not provided"}`,
    `- Overall score: ${scored.overallScore10} / 10 (${scored.grade})`,
    scored.rawOverallScore10 !== scored.overallScore10
      ? `- Raw score before caps: ${scored.rawOverallScore10} / 10`
      : `- Raw score before caps: unchanged`,
    `- Readiness: ${scored.readiness}`,
    `- Evidence quality: ${scored.evidence}`,
    `- Coverage: ${(scored.coverage * 100).toFixed(0)}%`,
    "",
    "## Category Scores",
  ];

  for (const category of scored.categories) {
    lines.push(
      `- ${category.label}: ${
        category.score10 == null ? "not measured" : `${category.score10} / 10`
      }`
    );
  }

  lines.push("", "## Score Caps");
  if (scored.scoreCapsApplied.length === 0) {
    lines.push("- none");
  } else {
    for (const reason of scored.scoreCapsApplied) {
      lines.push(`- ${reason}`);
    }
  }

  lines.push("", "## Missing Metrics");
  if (scored.missingMetrics.length === 0) {
    lines.push("- none");
  } else {
    for (const key of scored.missingMetrics) {
      lines.push(`- ${key}`);
    }
  }

  lines.push("", "## Metric Detail");
  for (const category of scored.categories) {
    lines.push(`### ${category.label}`);
    for (const metric of category.metrics) {
      lines.push(
        `- ${metric.label}: ${
          metric.present ? `${metric.value} ${metric.unit} -> ${metric.score}/100` : "not measured"
        }`
      );
    }
  }

  return lines.join("\n");
};

export const parseArgs = (argv) => {
  const readValue = (flag) => {
    const prefixed = `${flag}=`;
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === flag) return argv[index + 1] ?? "";
      if (token.startsWith(prefixed)) return token.slice(prefixed.length);
    }
    return "";
  };

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    template: argv.includes("--template"),
    input: normalizeString(readValue("--input")),
    surface: normalizeString(readValue("--surface")),
    format: normalizeString(readValue("--format")) || "text",
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_panel_kpi_score.mjs --input <packet.json> [--format text|json|markdown]",
      "  node frontend/scripts/media_panel_kpi_score.mjs --template --surface <ai-studio-panel|elements-media-panel>",
      "",
      "Notes:",
      "  - Input packets should follow the metrics schema documented in docs/sops/sop_media_panel_performance_kpi.md.",
      "  - Missing metrics are allowed; coverage will drop and the report will show what is unmeasured.",
      "",
    ].join("\n")
  );
};

const readPacketFromFile = (inputPath) => {
  const absolutePath = path.resolve(process.cwd(), inputPath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  if (args.template) {
    const surface = args.surface || "ai-studio-panel";
    process.stdout.write(`${JSON.stringify(buildTemplatePacket(surface), null, 2)}\n`);
    return;
  }
  if (!args.input) {
    throw new Error("Missing --input. Pass a KPI packet JSON file or use --template.");
  }

  const scored = scorePacket(readPacketFromFile(args.input));
  if (args.format === "json") {
    process.stdout.write(`${JSON.stringify(scored, null, 2)}\n`);
    return;
  }
  if (args.format === "markdown") {
    process.stdout.write(`${buildMarkdownReport(scored)}\n`);
    return;
  }

  process.stdout.write(
    [
      `Surface: ${scored.surfaceLabel} (${scored.surface})`,
      `Packet version: ${scored.packetVersion}`,
      `Environment: ${scored.environment ?? "not provided"}`,
      `Capture mode: ${scored.captureMode ?? "not provided"}`,
      `Sample count: ${scored.sampleCount ?? "not provided"}`,
      `Overall score: ${scored.overallScore10} / 10 (${scored.grade})`,
      scored.rawOverallScore10 !== scored.overallScore10
        ? `Raw score before caps: ${scored.rawOverallScore10} / 10`
        : "Raw score before caps: unchanged",
      `Readiness: ${scored.readiness}`,
      `Evidence quality: ${scored.evidence}`,
      `Coverage: ${(scored.coverage * 100).toFixed(0)}%`,
      ...scored.categories.map(
        (category) =>
          `${category.label}: ${
            category.score10 == null ? "not measured" : `${category.score10} / 10`
          }`
      ),
      scored.scoreCapsApplied.length > 0
        ? `Score caps: ${scored.scoreCapsApplied.join(", ")}`
        : "Score caps: none",
      scored.missingMetrics.length > 0
        ? `Missing metrics: ${scored.missingMetrics.join(", ")}`
        : "Missing metrics: none",
    ].join("\n") + "\n"
  );
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === SCRIPT_FILE) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
