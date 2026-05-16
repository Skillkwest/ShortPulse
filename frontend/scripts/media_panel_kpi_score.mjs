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
    ownerFiles: [
      "frontend/features/ai-studio/components/MediaLibraryPanel.tsx",
      "frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts",
      "frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts",
      "frontend/features/media-library/hooks/useMediaPreviewSigningController.ts",
      "frontend/lib/mediaPerfTelemetry.ts",
    ],
  },
  "elements-media-panel": {
    label: "Elements Embedded Media Panel",
    notes:
      "Embedded Media panel inside Elements. Optimize for the same preview/runtime contract while guarding against embed-shell overhead.",
    ownerFiles: [
      "frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx",
      "frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts",
      "frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts",
      "frontend/features/media-library/hooks/useMediaPreviewSigningController.ts",
      "frontend/lib/mediaPerfTelemetry.ts",
    ],
  },
};

const DIAGNOSTIC_DEFS = [
  {
    key: "preview-authority-canonical-coverage",
    label: "Canonical preview authority weakness",
    severity: "critical",
    lane: "preview-authority",
    description:
      "Visible rows are still leaning on original assets or non-canonical media instead of durable canonical preview-backed delivery.",
    ownerFiles: [
      "frontend/features/media-library/hooks/useMediaPreviewSigningController.ts",
      "frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts",
    ],
    when: (metric) => (metric("canonicalPreviewCoverageRatio") ?? 1) < 0.6,
  },
  {
    key: "signing-cost-hot-path",
    label: "Preview signing cost too high",
    severity: "high",
    lane: "signing-cost",
    description:
      "Preview signing is consuming too much of the open path and is likely amplifying perceived panel delay.",
    ownerFiles: [
      "frontend/features/media-library/hooks/useMediaPreviewSigningController.ts",
      "frontend/lib/mediaPerfTelemetry.ts",
    ],
    when: (metric) => (metric("signBatchP95Ms") ?? 0) >= 900,
  },
  {
    key: "open-phase-list-churn",
    label: "Open-phase list churn still present",
    severity: "high",
    lane: "list-orchestration",
    description:
      "The panel is still issuing at least one extra list request during the open phase instead of settling from the primary browse load.",
    ownerFiles: [
      "frontend/features/ai-studio/hooks/useMediaLibraryPanelDataController.ts",
      "frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts",
    ],
    when: (metric) => (metric("extraListCallsPerOpen") ?? 0) > 0.1,
  },
  {
    key: "visible-state-churn",
    label: "Visible loading churn remains high",
    severity: "medium",
    lane: "panel-state-churn",
    description:
      "The panel flips visible states too often before settling, which can make a technically successful load still feel unstable.",
    ownerFiles: [
      "frontend/features/ai-studio/components/MediaLibraryPanel.tsx",
      "frontend/features/ai-studio/components/ElementsEmbeddedMediaLibraryPanel.tsx",
      "frontend/features/media-library/runtime/useMediaLibraryPanelRuntime.ts",
    ],
    when: (metric) => (metric("stateFlipCountPerOpen") ?? 0) > 1,
  },
  {
    key: "evidence-depth-gap",
    label: "Evidence depth still weak",
    severity: "medium",
    lane: "measurement-depth",
    description:
      "The KPI packet is still missing enough direct measurements that optimization claims should stay provisional.",
    ownerFiles: [
      "frontend/scripts/media_panel_kpi_capture.mjs",
      "frontend/scripts/media_panel_kpi_score.mjs",
    ],
    when: (metric, context) =>
      context.evidence === "low" || context.evidence === "insufficient" || context.coverage < 0.75,
  },
];

const DIAGNOSTIC_SEVERITY_RANK = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
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

const compareThresholdForMetric = (metricDef) => {
  if (metricDef.unit === "ms") {
    return Math.max(75, (metricDef.fail - metricDef.target) * 0.08);
  }
  if (metricDef.unit === "ratio") return 0.03;
  if (metricDef.unit === "calls/open") return 0.12;
  if (metricDef.unit === "flips/open") return 0.2;
  if (metricDef.unit === "errors/open") return 0.5;
  if (metricDef.unit === "count") return 1;
  return 0.1;
};

const roundDelta = (value) => {
  if (!Number.isFinite(value)) return 0;
  const absolute = Math.abs(value);
  if (absolute >= 10) return Number(value.toFixed(1));
  if (absolute >= 1) return Number(value.toFixed(2));
  return Number(value.toFixed(4));
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
    coverage >= 0.9
      ? "high"
      : coverage >= 0.75
        ? "medium"
        : coverage >= 0.5
          ? "low"
          : "insufficient";
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

const severitySort = (left, right) =>
  (DIAGNOSTIC_SEVERITY_RANK[right.severity] ?? 0) - (DIAGNOSTIC_SEVERITY_RANK[left.severity] ?? 0);

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
    analysis: packet.analysis && typeof packet.analysis === "object" ? packet.analysis : null,
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
  const scoredMetrics = METRIC_DEFS.map((metricDef) =>
    scoreMetric(metricDef, metrics[metricDef.key])
  );

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

  const metricValue = (key) =>
    scoredMetrics.find((metric) => metric.key === key && metric.present)?.value ?? null;
  const diagnostics = DIAGNOSTIC_DEFS.filter((diagnostic) =>
    diagnostic.when(metricValue, {
      coverage,
      evidence,
      surface: validated.surface,
      sampleCount: validated.sampleCount,
    })
  )
    .map((diagnostic) => ({
      key: diagnostic.key,
      label: diagnostic.label,
      severity: diagnostic.severity,
      lane: diagnostic.lane,
      description: diagnostic.description,
      ownerFiles: diagnostic.ownerFiles,
    }))
    .sort(severitySort);
  const nextFocus = diagnostics[0]
    ? {
        lane: diagnostics[0].lane,
        reason: diagnostics[0].description,
        severity: diagnostics[0].severity,
        ownerFiles: diagnostics[0].ownerFiles,
      }
    : null;

  return {
    packetVersion: validated.packetVersion,
    measuredAt: validated.measuredAt,
    environment: validated.environment,
    captureMode: validated.captureMode,
    sampleCount: validated.sampleCount,
    surface: validated.surface,
    surfaceLabel: profile.label,
    surfaceNotes: profile.notes,
    analysis: validated.analysis,
    rawOverallScore10,
    overallScore10,
    overallScore100: Number(normalizedScore100.toFixed(1)),
    grade: evidence === "insufficient" ? "I" : gradeScore(overallScore10),
    readiness:
      evidence === "insufficient" ? "insufficient evidence" : readinessLabel(overallScore10),
    evidence,
    coverage,
    measuredWeight,
    totalPossibleWeight: TOTAL_POSSIBLE_WEIGHT,
    scoreCapsApplied,
    missingMetrics,
    diagnostics,
    nextFocus,
    ownerFiles: profile.ownerFiles,
    metrics: scoredMetrics,
    categories,
  };
};

const compareScoredMetric = (metricDef, olderMetric, newerMetric) => {
  const olderPresent = Boolean(olderMetric?.present);
  const newerPresent = Boolean(newerMetric?.present);
  if (!olderPresent || !newerPresent) {
    return {
      key: metricDef.key,
      label: metricDef.label,
      unit: metricDef.unit,
      status:
        olderPresent === newerPresent
          ? "not-comparable"
          : olderPresent
            ? "missing-in-newer"
            : "missing-in-older",
      meaningful: false,
      direction: "none",
      threshold: compareThresholdForMetric(metricDef),
      olderValue: olderPresent ? olderMetric.value : null,
      newerValue: newerPresent ? newerMetric.value : null,
      delta: null,
      scoreDelta: null,
    };
  }

  const delta = newerMetric.value - olderMetric.value;
  const threshold = compareThresholdForMetric(metricDef);
  const meaningful = Math.abs(delta) >= threshold;
  const improved = meaningful && (metricDef.direction === "higher" ? delta > 0 : delta < 0);
  const regressed = meaningful && (metricDef.direction === "higher" ? delta < 0 : delta > 0);

  return {
    key: metricDef.key,
    label: metricDef.label,
    unit: metricDef.unit,
    status: meaningful ? (improved ? "improved" : regressed ? "regressed" : "stable") : "stable",
    meaningful,
    direction: improved ? "improved" : regressed ? "regressed" : "none",
    threshold: roundDelta(threshold),
    olderValue: olderMetric.value,
    newerValue: newerMetric.value,
    delta: roundDelta(delta),
    scoreDelta: roundDelta((newerMetric.score ?? 0) - (olderMetric.score ?? 0)),
  };
};

export const comparePackets = (olderPacket, newerPacket) => {
  const older = scorePacket(olderPacket);
  const newer = scorePacket(newerPacket);

  if (older.surface !== newer.surface) {
    throw new Error(
      `Cannot compare packets from different surfaces: ${older.surface} vs ${newer.surface}.`
    );
  }

  const olderMetricMap = new Map(older.metrics.map((metric) => [metric.key, metric]));
  const newerMetricMap = new Map(newer.metrics.map((metric) => [metric.key, metric]));
  const metricComparisons = METRIC_DEFS.map((metricDef) =>
    compareScoredMetric(
      metricDef,
      olderMetricMap.get(metricDef.key),
      newerMetricMap.get(metricDef.key)
    )
  );

  const meaningfulImprovements = metricComparisons.filter(
    (metric) => metric.meaningful && metric.direction === "improved"
  );
  const meaningfulRegressions = metricComparisons.filter(
    (metric) => metric.meaningful && metric.direction === "regressed"
  );
  const missingInNewer = metricComparisons.filter((metric) => metric.status === "missing-in-newer");
  const missingInOlder = metricComparisons.filter((metric) => metric.status === "missing-in-older");

  const scoreDelta10 = roundDelta(newer.overallScore10 - older.overallScore10);
  const rawScoreDelta10 = roundDelta(newer.rawOverallScore10 - older.rawOverallScore10);
  const coverageDelta = roundDelta(newer.coverage - older.coverage);

  const comparisonFlags = [];
  if (older.evidence === "insufficient" || newer.evidence === "insufficient") {
    comparisonFlags.push("one or both packets have insufficient evidence");
  }
  if (scoreDelta10 <= -0.5) {
    comparisonFlags.push("overall score regressed by at least 0.5");
  }
  if (coverageDelta <= -0.1) {
    comparisonFlags.push("coverage dropped by at least 10 percentage points");
  }
  if (newer.scoreCapsApplied.length > older.scoreCapsApplied.length) {
    comparisonFlags.push("newer packet triggered more score caps");
  }

  let summary = "no meaningful change";
  if (comparisonFlags.includes("one or both packets have insufficient evidence")) {
    summary = "insufficient evidence";
  } else if (meaningfulImprovements.length > 0 && meaningfulRegressions.length > 0) {
    summary = "mixed";
  } else if (meaningfulImprovements.length > 0 || scoreDelta10 >= 0.3) {
    summary = "improved";
  } else if (meaningfulRegressions.length > 0 || scoreDelta10 <= -0.3) {
    summary = "regressed";
  }

  return {
    surface: newer.surface,
    surfaceLabel: newer.surfaceLabel,
    older,
    newer,
    summary,
    scoreDelta10,
    rawScoreDelta10,
    coverageDelta,
    comparisonFlags,
    meaningfulImprovements,
    meaningfulRegressions,
    missingInOlder,
    missingInNewer,
    metrics: metricComparisons,
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
    `- Next focus: ${
      scored.nextFocus ? `${scored.nextFocus.lane} (${scored.nextFocus.severity})` : "none"
    }`,
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

  lines.push("", "## Diagnostics");
  if (scored.diagnostics.length === 0) {
    lines.push("- none");
  } else {
    for (const diagnostic of scored.diagnostics) {
      lines.push(`- [${diagnostic.severity}] ${diagnostic.label}: ${diagnostic.description}`);
      lines.push(`  - lane: ${diagnostic.lane}`);
      lines.push(`  - owner files: ${diagnostic.ownerFiles.join(", ")}`);
    }
  }

  if (scored.analysis && typeof scored.analysis === "object") {
    const openPhaseSignTabBreakdown = Array.isArray(scored.analysis.openPhaseSignTabBreakdown)
      ? scored.analysis.openPhaseSignTabBreakdown
      : [];
    if (openPhaseSignTabBreakdown.length > 0) {
      lines.push("", "## Open-Phase Sign Breakdown");
      for (const entry of openPhaseSignTabBreakdown) {
        lines.push(
          `- ${entry.tab}: coverage=${entry.canonicalPreviewCoverageRatio ?? "n/a"}, signed=${entry.totalSigned ?? 0}, p95=${entry.signBatchP95Ms ?? "n/a"} ms`
        );
      }
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

export const buildCompareMarkdownReport = (comparison) => {
  const lines = [
    "# Media Panel KPI Comparison",
    "",
    `- Surface: ${comparison.surfaceLabel} (\`${comparison.surface}\`)`,
    `- Summary: ${comparison.summary}`,
    `- Older score: ${comparison.older.overallScore10} / 10 (${comparison.older.grade})`,
    `- Newer score: ${comparison.newer.overallScore10} / 10 (${comparison.newer.grade})`,
    `- Score delta: ${comparison.scoreDelta10}`,
    `- Coverage delta: ${comparison.coverageDelta}`,
    "",
    "## Comparison Flags",
  ];

  if (comparison.comparisonFlags.length === 0) {
    lines.push("- none");
  } else {
    for (const flag of comparison.comparisonFlags) {
      lines.push(`- ${flag}`);
    }
  }

  lines.push("", "## Meaningful Improvements");
  if (comparison.meaningfulImprovements.length === 0) {
    lines.push("- none");
  } else {
    for (const metric of comparison.meaningfulImprovements) {
      lines.push(`- ${metric.label}: ${metric.delta} ${metric.unit}`);
    }
  }

  lines.push("", "## Meaningful Regressions");
  if (comparison.meaningfulRegressions.length === 0) {
    lines.push("- none");
  } else {
    for (const metric of comparison.meaningfulRegressions) {
      lines.push(`- ${metric.label}: ${metric.delta} ${metric.unit}`);
    }
  }

  lines.push("", "## Metric Availability Changes");
  if (comparison.missingInOlder.length === 0 && comparison.missingInNewer.length === 0) {
    lines.push("- none");
  } else {
    for (const metric of comparison.missingInOlder) {
      lines.push(`- ${metric.label}: missing in older packet`);
    }
    for (const metric of comparison.missingInNewer) {
      lines.push(`- ${metric.label}: missing in newer packet`);
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

  const compareIndex = argv.indexOf("--compare");

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    template: argv.includes("--template"),
    compare: compareIndex >= 0,
    compareOlder: compareIndex >= 0 ? normalizeString(argv[compareIndex + 1]) : "",
    compareNewer: compareIndex >= 0 ? normalizeString(argv[compareIndex + 2]) : "",
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
      "  node frontend/scripts/media_panel_kpi_score.mjs --compare <older.json> <newer.json> [--format text|json|markdown]",
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
  if (args.compare) {
    if (!args.compareOlder || !args.compareNewer) {
      throw new Error("Missing compare packet paths. Pass --compare <older.json> <newer.json>.");
    }
    const comparison = comparePackets(
      readPacketFromFile(args.compareOlder),
      readPacketFromFile(args.compareNewer)
    );
    if (args.format === "json") {
      process.stdout.write(`${JSON.stringify(comparison, null, 2)}\n`);
      return;
    }
    if (args.format === "markdown") {
      process.stdout.write(`${buildCompareMarkdownReport(comparison)}\n`);
      return;
    }

    process.stdout.write(
      [
        `Surface: ${comparison.surfaceLabel} (${comparison.surface})`,
        `Summary: ${comparison.summary}`,
        `Older score: ${comparison.older.overallScore10} / 10 (${comparison.older.grade})`,
        `Newer score: ${comparison.newer.overallScore10} / 10 (${comparison.newer.grade})`,
        `Score delta: ${comparison.scoreDelta10}`,
        `Coverage delta: ${comparison.coverageDelta}`,
        comparison.comparisonFlags.length > 0
          ? `Flags: ${comparison.comparisonFlags.join(", ")}`
          : "Flags: none",
        comparison.meaningfulImprovements.length > 0
          ? `Improvements: ${comparison.meaningfulImprovements.map((metric) => metric.key).join(", ")}`
          : "Improvements: none",
        comparison.meaningfulRegressions.length > 0
          ? `Regressions: ${comparison.meaningfulRegressions.map((metric) => metric.key).join(", ")}`
          : "Regressions: none",
      ].join("\n") + "\n"
    );
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
      scored.nextFocus
        ? `Next focus: ${scored.nextFocus.lane} (${scored.nextFocus.severity})`
        : "Next focus: none",
      ...scored.categories.map(
        (category) =>
          `${category.label}: ${
            category.score10 == null ? "not measured" : `${category.score10} / 10`
          }`
      ),
      scored.diagnostics.length > 0
        ? `Diagnostics: ${scored.diagnostics.map((diagnostic) => diagnostic.key).join(", ")}`
        : "Diagnostics: none",
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
