#!/usr/bin/env node
/* global document, HTMLElement, performance, setTimeout, window */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { buildMarkdownReport, scorePacket } from "./media_panel_kpi_score.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_SURFACE = "ai-studio-panel";
const DEFAULT_RUNS = 5;
const DEFAULT_ROOT_TAB = "all";
const ROOT_TAB_CONFIG = {
  all: {
    label: "All Media",
    sectionId: "media-library-panel-all-media-section",
    loadingPattern: "loading saved items|loading prompts",
    emptyPattern: "no saved items found for this folder\\.|no prompts found for this folder\\.",
  },
  images: {
    label: "Images",
    sectionId: "media-library-panel-images-section",
    loadingPattern: "loading images",
    emptyPattern: "no images found for this folder\\.",
  },
  videos: {
    label: "Videos",
    sectionId: "media-library-panel-videos-section",
    loadingPattern: "loading videos",
    emptyPattern: "no videos found for this folder\\.",
  },
  audio: {
    label: "Audio",
    sectionId: "media-library-panel-audio-section",
    loadingPattern: "loading audio",
    emptyPattern: "no audio found for this folder\\.",
  },
  prompts: {
    label: "Prompts",
    sectionId: "media-library-panel-prompts-section",
    loadingPattern: "loading prompts",
    emptyPattern: "no prompts found for this folder\\.",
  },
};

const CAPTURE_SURFACES = {
  "ai-studio-panel": {
    label: "AI Studio media panel",
    panelSelector: 'section[aria-label="Media library panel"]',
    telemetrySurface: "media-library-panel",
  },
  "elements-media-panel": {
    label: "Elements embedded media panel",
    panelSelector: 'section[aria-label="Elements media library panel"]',
    telemetrySurface: "elements-media-panel",
  },
};
const DEFAULT_TELEMETRY_SURFACE = CAPTURE_SURFACES[DEFAULT_SURFACE].telemetrySurface;

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");
const toFiniteNumber = (value) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};
const percentile = (values, ratio) => {
  const normalized = values
    .map((value) => toFiniteNumber(value))
    .filter((value) => value != null)
    .sort((left, right) => left - right);
  if (!normalized.length) return null;
  if (normalized.length === 1) return normalized[0];
  const index = (normalized.length - 1) * ratio;
  const lowerIndex = Math.floor(index);
  const upperIndex = Math.ceil(index);
  const lower = normalized[lowerIndex];
  const upper = normalized[upperIndex];
  if (lower == null || upper == null) return normalized[normalized.length - 1] ?? null;
  if (lowerIndex === upperIndex) return lower;
  return lower + (upper - lower) * (index - lowerIndex);
};
const average = (values) => {
  const normalized = values.map((value) => toFiniteNumber(value)).filter((value) => value != null);
  if (!normalized.length) return null;
  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
};
const averageRounded = (values, digits = 4) => {
  const value = average(values);
  return value == null ? null : Number(value.toFixed(digits));
};
const getCaptureSamples = (capture) =>
  Array.isArray(capture?.captures)
    ? capture.captures.filter((entry) => entry && typeof entry === "object")
    : capture && typeof capture === "object"
      ? [capture]
      : [];

const getSamplePerfHandleForPhase = (sample, phase) => {
  if (!sample || typeof sample !== "object") return null;
  if (phase === "open") {
    return sample.openPhasePerfHandle ?? sample.perfHandle ?? null;
  }
  if (phase === "post-tabs") {
    return sample.postTabPerfHandle ?? sample.perfHandle ?? null;
  }
  return sample.perfHandle ?? null;
};

const loadEnvFromFileIfNeeded = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    if (!key || (process.env[key] ?? "") !== "") continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
};

const loadAuditEnv = () => {
  const frontendRoot = path.resolve(path.dirname(SCRIPT_FILE), "..");
  const repoRoot = path.resolve(frontendRoot, "..");
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.local"));
  loadEnvFromFileIfNeeded(path.join(frontendRoot, ".env.playwright.local"));
  loadEnvFromFileIfNeeded(path.join(repoRoot, ".env.agent.local"));
};

const getCaptureSurfaceSpec = (surface) => {
  return CAPTURE_SURFACES[surface] ?? null;
};

const getRootTabConfig = (rootTab) => ROOT_TAB_CONFIG[rootTab] ?? null;

const isMediaBearingRootTab = (rootTab) => rootTab !== "prompts";
const MINIMUM_VISIBLE_MEDIA_SUCCESS_RATIO = 0.8;

const resolveCaptureValidity = ({
  rootTab,
  sampleCount,
  minimumRunsForDerivedP95,
  firstVisibleMediaRunCount,
  openPhaseVisiblePreviewSummary,
}) => {
  const reasons = [];
  const visibleMediaSuccessRatio = sampleCount > 0 ? firstVisibleMediaRunCount / sampleCount : 0;
  if (sampleCount < minimumRunsForDerivedP95) {
    reasons.push("sample_count_below_minimum");
  }
  if (isMediaBearingRootTab(rootTab)) {
    const visibleMediaCardCount =
      toFiniteNumber(openPhaseVisiblePreviewSummary?.visibleMediaCardCount) ?? 0;
    if (firstVisibleMediaRunCount <= 0 || visibleMediaCardCount <= 0) {
      reasons.push("no_visible_media_observed");
    } else if (visibleMediaSuccessRatio < MINIMUM_VISIBLE_MEDIA_SUCCESS_RATIO) {
      reasons.push("visible_media_success_ratio_below_minimum");
    }
  }
  return {
    valid: reasons.length === 0,
    reasons,
    visibleMediaSuccessRatio,
  };
};

export const selectRepresentativeOpenPhaseListSummary = (summaries) => {
  const normalized = Array.isArray(summaries)
    ? summaries.filter((summary) => summary && typeof summary === "object")
    : [];
  if (normalized.length === 0) return null;
  return normalized.reduce((best, candidate) => {
    if (!best) return candidate;
    const bestRowCount = Number.isFinite(best?.rowCount) && best.rowCount > 0 ? best.rowCount : 0;
    const candidateRowCount =
      Number.isFinite(candidate?.rowCount) && candidate.rowCount > 0 ? candidate.rowCount : 0;
    if (candidateRowCount > bestRowCount) return candidate;
    if (candidateRowCount === bestRowCount) return candidate;
    return best;
  }, null);
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_panel_kpi_capture.mjs [options]",
      "",
      "Options:",
      "  --surface <ai-studio-panel|elements-media-panel>   Default ai-studio-panel",
      "  --root-tab <all|images|videos|audio|prompts>       Default all",
      "  --base-url <url>                                   Default PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL or http://localhost:3000",
      "  --runs <count>                                     Default 5 repeated panel opens",
      "  --format <json|packet|markdown|text>              Default json",
      "  --headless <true|false>                            Default env PLAYWRIGHT_HEADLESS or true",
      "  --write-packet <path>                              Optional output file for the derived KPI packet",
      "",
      "Environment:",
      "  PLAYWRIGHT_AUDIT_EMAIL                             Required real audit account email",
      "  PLAYWRIGHT_AUDIT_PASSWORD                          Optional audit password override",
      "  PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL                  Default base URL",
      "  PLAYWRIGHT_HEADLESS                                Set to false to watch the run",
      "",
    ].join("\n")
  );
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
    surface: normalizeString(readValue("--surface")) || DEFAULT_SURFACE,
    rootTab: normalizeString(readValue("--root-tab")) || DEFAULT_ROOT_TAB,
    baseUrl: normalizeString(readValue("--base-url")),
    runs: normalizeString(readValue("--runs")),
    format: normalizeString(readValue("--format")) || "json",
    headless: normalizeString(readValue("--headless")),
    writePacket: normalizeString(readValue("--write-packet")),
  };
};

const resolveRuns = (value) => {
  const normalized = normalizeString(value);
  if (!normalized) return DEFAULT_RUNS;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new Error("Invalid --runs value. Expected an integer >= 1.");
  }
  return parsed;
};

const resolveHeadless = (value) => {
  const normalized = normalizeString(value || process.env.PLAYWRIGHT_HEADLESS);
  if (!normalized) return true;
  return normalized !== "false";
};

const resolveRootTab = (value) => {
  const normalized = normalizeString(value).toLowerCase() || DEFAULT_ROOT_TAB;
  if (getRootTabConfig(normalized)) return normalized;
  throw new Error(
    `Unsupported --root-tab value: ${value}. Supported root tabs: ${Object.keys(ROOT_TAB_CONFIG).join(", ")}.`
  );
};

const shouldIgnoreConsole = (text) =>
  /\[hmr\]\s+invalid message|\[hmr\]\s+connected|\[fast refresh\]|\breact devtools\b|favicon\.ico/i.test(
    text
  );

const buildCaptureModeLabel = (capture) => {
  const hasPerfHandle = getCaptureSamples(capture).some((sample) => sample?.perfHandle?.available);
  return hasPerfHandle ? "playwright-panel-audit+live-perf-handle" : "playwright-panel-audit";
};

const countConsoleErrors = (entries) =>
  Array.isArray(entries)
    ? entries.filter(
        (entry) => entry?.type === "error" && !shouldIgnoreConsole(String(entry?.text ?? ""))
      ).length
    : 0;

const collectSignBucketsBySample = (capture, phase = "open") =>
  getCaptureSamples(capture).map((sample) =>
    Array.isArray(getSamplePerfHandleForPhase(sample, phase)?.signStats)
      ? getSamplePerfHandleForPhase(sample, phase).signStats.filter(
          (bucket) =>
            bucket?.surface ===
            (sample?.telemetrySurface ?? capture?.telemetrySurface ?? DEFAULT_TELEMETRY_SURFACE)
        )
      : []
  );

const aggregateSignStats = (capture, phase = "open") => {
  const bucketsBySample = collectSignBucketsBySample(capture, phase);
  const buckets = bucketsBySample.flatMap((entry) => entry);
  if (!buckets.length) return null;

  const totals = buckets.reduce(
    (sum, bucket) => {
      sum.samples += toFiniteNumber(bucket.samples) ?? 0;
      sum.totalSigned += toFiniteNumber(bucket.total_signed) ?? 0;
      sum.totalFailed += toFiniteNumber(bucket.total_failed) ?? 0;
      sum.totalResolvedDurable += toFiniteNumber(bucket.total_resolved_durable) ?? 0;
      sum.totalResolvedOriginal += toFiniteNumber(bucket.total_resolved_original) ?? 0;
      sum.totalPrimaryDurable += toFiniteNumber(bucket.total_primary_durable) ?? 0;
      sum.totalPrimaryOriginal += toFiniteNumber(bucket.total_primary_original) ?? 0;
      sum.maxP95 = Math.max(sum.maxP95, toFiniteNumber(bucket.p95_duration_ms) ?? 0);
      return sum;
    },
    {
      samples: 0,
      totalSigned: 0,
      totalFailed: 0,
      totalResolvedDurable: 0,
      totalResolvedOriginal: 0,
      totalPrimaryDurable: 0,
      totalPrimaryOriginal: 0,
      maxP95: 0,
    }
  );

  const signFailedRatio =
    totals.totalSigned + totals.totalFailed > 0
      ? totals.totalFailed / (totals.totalSigned + totals.totalFailed)
      : 0;

  const canonicalPreviewCoverageRatio =
    totals.totalPrimaryDurable > 0
      ? totals.totalResolvedDurable / totals.totalPrimaryDurable
      : null;

  return {
    signBatchP95Ms: totals.maxP95 || null,
    signFailedRatio: Number(signFailedRatio.toFixed(4)),
    canonicalPreviewCoverageRatio:
      canonicalPreviewCoverageRatio == null
        ? null
        : Number(canonicalPreviewCoverageRatio.toFixed(4)),
  };
};

const buildSignTabBreakdown = (capture, phase = "open") => {
  const buckets = collectSignBucketsBySample(capture, phase).flatMap((entry) => entry);
  if (!buckets.length) return [];

  const byTab = new Map();
  for (const bucket of buckets) {
    const tab = normalizeString(bucket?.tab) || "unknown";
    const entry = byTab.get(tab) ?? {
      tab,
      samples: 0,
      totalSigned: 0,
      totalFailed: 0,
      totalPrimaryDurable: 0,
      totalPrimaryOriginal: 0,
      totalResolvedDurable: 0,
      totalResolvedOriginal: 0,
      maxP95DurationMs: 0,
    };
    entry.samples += toFiniteNumber(bucket?.samples) ?? 0;
    entry.totalSigned += toFiniteNumber(bucket?.total_signed) ?? 0;
    entry.totalFailed += toFiniteNumber(bucket?.total_failed) ?? 0;
    entry.totalPrimaryDurable += toFiniteNumber(bucket?.total_primary_durable) ?? 0;
    entry.totalPrimaryOriginal += toFiniteNumber(bucket?.total_primary_original) ?? 0;
    entry.totalResolvedDurable += toFiniteNumber(bucket?.total_resolved_durable) ?? 0;
    entry.totalResolvedOriginal += toFiniteNumber(bucket?.total_resolved_original) ?? 0;
    entry.maxP95DurationMs = Math.max(
      entry.maxP95DurationMs,
      toFiniteNumber(bucket?.p95_duration_ms) ?? 0
    );
    byTab.set(tab, entry);
  }

  return Array.from(byTab.values())
    .map((entry) => {
      return {
        tab: entry.tab,
        samples: entry.samples,
        signBatchP95Ms: entry.maxP95DurationMs || null,
        totalSigned: entry.totalSigned,
        totalFailed: entry.totalFailed,
        totalPrimaryDurable: entry.totalPrimaryDurable ?? 0,
        totalPrimaryOriginal: entry.totalPrimaryOriginal ?? 0,
        totalResolvedDurable: entry.totalResolvedDurable,
        totalResolvedOriginal: entry.totalResolvedOriginal,
        canonicalPreviewCoverageRatio:
          (entry.totalPrimaryDurable ?? 0) > 0
            ? Number((entry.totalResolvedDurable / entry.totalPrimaryDurable).toFixed(4))
            : null,
      };
    })
    .sort((left, right) => {
      const leftCoverage = left.canonicalPreviewCoverageRatio ?? -1;
      const rightCoverage = right.canonicalPreviewCoverageRatio ?? -1;
      if (leftCoverage !== rightCoverage) return leftCoverage - rightCoverage;
      return (right.totalSigned ?? 0) - (left.totalSigned ?? 0);
    });
};

const aggregateResolveStats = (capture) => {
  const samples = getCaptureSamples(capture);
  const bucketsBySample = samples.map((sample) =>
    Array.isArray(sample?.perfHandle?.resolveStats)
      ? sample.perfHandle.resolveStats.filter(
          (bucket) =>
            bucket?.surface ===
            (sample?.telemetrySurface ?? capture?.telemetrySurface ?? DEFAULT_TELEMETRY_SURFACE)
        )
      : []
  );
  const buckets = bucketsBySample.flatMap((entry) => entry);
  if (!buckets.length) {
    const averageInitialResolveRequests = average(
      samples.map((sample) =>
        Math.max(
          0,
          Math.round(
            toFiniteNumber(sample?.initialResolveRequestCount ?? sample?.resolveRequestCount) ?? 0
          )
        )
      )
    );
    return {
      resolveCallsPerOpen:
        averageInitialResolveRequests == null
          ? null
          : Number(averageInitialResolveRequests.toFixed(4)),
      resolveFailedRatio: null,
    };
  }

  const callsPerOpen = average(
    bucketsBySample.map((entry) =>
      entry.reduce((sum, bucket) => sum + (toFiniteNumber(bucket.samples) ?? 0), 0)
    )
  );
  const totalResolved = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_resolved) ?? 0),
    0
  );
  const totalFailed = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_failed) ?? 0),
    0
  );

  return {
    resolveCallsPerOpen: callsPerOpen == null ? null : Number(callsPerOpen.toFixed(4)),
    resolveFailedRatio:
      totalResolved + totalFailed > 0
        ? Number((totalFailed / (totalResolved + totalFailed)).toFixed(4))
        : 0,
  };
};

const aggregateFallbackStats = (capture) => {
  const bucketsBySample = getCaptureSamples(capture).map((sample) =>
    Array.isArray(sample?.perfHandle?.fallbackStats)
      ? sample.perfHandle.fallbackStats.filter(
          (bucket) =>
            bucket?.surface ===
            (sample?.telemetrySurface ?? capture?.telemetrySurface ?? DEFAULT_TELEMETRY_SURFACE)
        )
      : []
  );
  const buckets = bucketsBySample.flatMap((entry) => entry);
  if (!buckets.length) {
    return {
      fallbackCallsPerOpen: null,
      fallbackFailedRatio: null,
    };
  }

  const callsPerOpen = average(
    bucketsBySample.map((entry) =>
      entry.reduce((sum, bucket) => sum + (toFiniteNumber(bucket.samples) ?? 0), 0)
    )
  );
  const totalSucceeded = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_succeeded) ?? 0),
    0
  );
  const totalFailed = buckets.reduce(
    (sum, bucket) => sum + (toFiniteNumber(bucket.total_failed) ?? 0),
    0
  );

  return {
    fallbackCallsPerOpen: callsPerOpen == null ? null : Number(callsPerOpen.toFixed(4)),
    fallbackFailedRatio:
      totalSucceeded + totalFailed > 0
        ? Number((totalFailed / (totalSucceeded + totalFailed)).toFixed(4))
        : 0,
  };
};

const countRowsByKind = (rows) => {
  const counts = {
    image: 0,
    video: 0,
    audio: 0,
    other: 0,
  };
  for (const row of Array.isArray(rows) ? rows : []) {
    const fileType = normalizeString(row?.file_type).toLowerCase();
    if (fileType.startsWith("image")) {
      counts.image += 1;
      continue;
    }
    if (fileType.startsWith("video")) {
      counts.video += 1;
      continue;
    }
    if (fileType.startsWith("audio")) {
      counts.audio += 1;
      continue;
    }
    counts.other += 1;
  }
  return counts;
};

const summarizeMediaListResponse = ({ requestBody, payload }) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const countsByKind = countRowsByKind(rows);
  const withThumbVariantCount = rows.filter(
    (row) => normalizeString(row?.thumb_variant_path).length > 0
  ).length;
  const withPosterVariantCount = rows.filter(
    (row) => normalizeString(row?.poster_variant_path).length > 0
  ).length;
  const withPreviewVariantCount = rows.filter(
    (row) => normalizeString(row?.preview_variant_path).length > 0
  ).length;

  return {
    mediaKind: normalizeString(requestBody?.mediaKind) || "all",
    profile: normalizeString(requestBody?.profile) || "minimal",
    rowCount: rows.length,
    includeLibraryTotalCount: requestBody?.includeLibraryTotalCount === true,
    countsByKind,
    withThumbVariantCount,
    withPosterVariantCount,
    withPreviewVariantCount,
    withAnyDurablePreviewCount: rows.filter(
      (row) =>
        normalizeString(row?.thumb_variant_path).length > 0 ||
        normalizeString(row?.poster_variant_path).length > 0 ||
        normalizeString(row?.preview_variant_path).length > 0
    ).length,
    signedSeedCount:
      payload?.signedById && typeof payload.signedById === "object"
        ? Object.values(payload.signedById).filter(
            (value) => typeof value === "string" && value.trim().length > 0
          ).length
        : 0,
    firstRowsSample: rows.slice(0, 6).map((row) => ({
      fileType: normalizeString(row?.file_type) || "unknown",
      source: normalizeString(row?.source) || "unknown",
      hasThumbVariant: normalizeString(row?.thumb_variant_path).length > 0,
      hasPosterVariant: normalizeString(row?.poster_variant_path).length > 0,
      hasPreviewVariant: normalizeString(row?.preview_variant_path).length > 0,
    })),
  };
};

const aggregateOpenPhaseListSummary = (capture) => {
  const summaries = getCaptureSamples(capture)
    .map((sample) => sample?.openPhaseListSummary ?? null)
    .filter((summary) => summary && typeof summary === "object");
  if (!summaries.length) return null;

  const signatureCounts = new Map();
  for (const summary of summaries) {
    const signature = `${normalizeString(summary.mediaKind) || "all"}|${normalizeString(summary.profile) || "minimal"}|${summary.includeLibraryTotalCount === true ? "count" : "no-count"}`;
    signatureCounts.set(signature, (signatureCounts.get(signature) ?? 0) + 1);
  }
  const dominantSignature =
    Array.from(signatureCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "all|minimal|no-count";
  const [dominantMediaKind, dominantProfile, dominantCountMode] = dominantSignature.split("|");

  return {
    samples: summaries.length,
    dominantMediaKind: dominantMediaKind || "all",
    dominantProfile: dominantProfile || "minimal",
    includeLibraryTotalCount: dominantCountMode === "count",
    averageRowCount: averageRounded(
      summaries.map((summary) => summary.rowCount),
      2
    ),
    averageSignedSeedCount: averageRounded(
      summaries.map((summary) => summary.signedSeedCount),
      2
    ),
    averageWithThumbVariantCount: averageRounded(
      summaries.map((summary) => summary.withThumbVariantCount),
      2
    ),
    averageWithPosterVariantCount: averageRounded(
      summaries.map((summary) => summary.withPosterVariantCount),
      2
    ),
    averageWithPreviewVariantCount: averageRounded(
      summaries.map((summary) => summary.withPreviewVariantCount),
      2
    ),
    averageWithAnyDurablePreviewCount: averageRounded(
      summaries.map((summary) => summary.withAnyDurablePreviewCount),
      2
    ),
    averageCountsByKind: {
      image: averageRounded(
        summaries.map((summary) => summary.countsByKind?.image ?? 0),
        2
      ),
      video: averageRounded(
        summaries.map((summary) => summary.countsByKind?.video ?? 0),
        2
      ),
      audio: averageRounded(
        summaries.map((summary) => summary.countsByKind?.audio ?? 0),
        2
      ),
      other: averageRounded(
        summaries.map((summary) => summary.countsByKind?.other ?? 0),
        2
      ),
    },
    representativeFirstRows: Array.isArray(summaries[0]?.firstRowsSample)
      ? summaries[0].firstRowsSample
      : [],
  };
};

const aggregateOpenPhaseVisiblePreviewSummary = (capture) => {
  const summaries = getCaptureSamples(capture)
    .map((sample) => sample?.openPhaseVisiblePreviewSummary ?? null)
    .filter((summary) => summary && typeof summary === "object");
  if (!summaries.length) return null;

  const totals = summaries.reduce(
    (sum, summary) => {
      sum.samples += 1;
      sum.visibleMediaCardCount += toFiniteNumber(summary.visibleMediaCardCount) ?? 0;
      sum.visiblePreviewReadyCount += toFiniteNumber(summary.visiblePreviewReadyCount) ?? 0;
      sum.visibleMissingPreviewCount += toFiniteNumber(summary.visibleMissingPreviewCount) ?? 0;
      return sum;
    },
    {
      samples: 0,
      visibleMediaCardCount: 0,
      visiblePreviewReadyCount: 0,
      visibleMissingPreviewCount: 0,
    }
  );

  const missingPreviewRatio =
    totals.visibleMediaCardCount > 0
      ? totals.visibleMissingPreviewCount / totals.visibleMediaCardCount
      : null;

  return {
    samples: totals.samples,
    visibleMediaCardCount: totals.visibleMediaCardCount,
    visiblePreviewReadyCount: totals.visiblePreviewReadyCount,
    visibleMissingPreviewCount: totals.visibleMissingPreviewCount,
    missingPreviewRatio:
      missingPreviewRatio == null ? null : Number(missingPreviewRatio.toFixed(4)),
  };
};

export const buildPacketFromPanelCapture = (capture, options = {}) => {
  const captureSamples = getCaptureSamples(capture);
  const sampleCount = captureSamples.length;
  const minimumRunsForDerivedP95 = 5;
  const firstVisibleMediaSamples = captureSamples
    .filter((sample) => sample?.firstVisibleKind === "media")
    .map((sample) => sample?.firstVisibleMs);
  const loadingStateSamples = captureSamples.map((sample) => {
    const observedLoadingMs = toFiniteNumber(sample?.loadingStateVisibleMs);
    if (observedLoadingMs != null) return observedLoadingMs;
    const reachedTerminalOpenState =
      sample?.firstVisibleKind === "media" || sample?.firstVisibleKind === "empty";
    return reachedTerminalOpenState ? 0 : null;
  });
  const stableSettleSamples = captureSamples.map((sample) => sample?.stableContentSettleMs);
  const stateFlipCount = average(captureSamples.map((sample) => sample?.stateFlipCount));
  const extraListCallsPerOpen = average(
    captureSamples.map((sample) =>
      Math.max(
        0,
        Math.round(
          toFiniteNumber(sample?.initialListRequestCount ?? sample?.listRequestCount) ?? 0
        ) - 1
      )
    )
  );
  const signAggregate = aggregateSignStats(capture, "open");
  const openPhaseSignTabBreakdown = buildSignTabBreakdown(capture, "open");
  const postTabSignTabBreakdown = buildSignTabBreakdown(capture, "post-tabs");
  const openPhaseListSummary = aggregateOpenPhaseListSummary(capture);
  const openPhaseVisiblePreviewSummary = aggregateOpenPhaseVisiblePreviewSummary(capture);
  const resolveAggregate = aggregateResolveStats(capture);
  const fallbackAggregate = aggregateFallbackStats(capture);
  const firstMediaPaintP95Ms =
    firstVisibleMediaSamples.length >= minimumRunsForDerivedP95
      ? percentile(firstVisibleMediaSamples, 0.95)
      : null;
  const openToFirstMediaP95Ms =
    firstVisibleMediaSamples.length >= minimumRunsForDerivedP95
      ? percentile(firstVisibleMediaSamples, 0.95)
      : null;
  const loadingStateVisibleMsP95 =
    loadingStateSamples.filter((value) => toFiniteNumber(value) != null).length >=
    minimumRunsForDerivedP95
      ? percentile(loadingStateSamples, 0.95)
      : null;
  const stableContentSettleMsP95 =
    stableSettleSamples.filter((value) => toFiniteNumber(value) != null).length >=
    minimumRunsForDerivedP95
      ? percentile(stableSettleSamples, 0.95)
      : null;

  const surfaceSpec = getCaptureSurfaceSpec(options.surface ?? DEFAULT_SURFACE);
  const surfaceLabel = surfaceSpec?.label ?? "media panel";
  const rootTab = resolveRootTab(options.rootTab ?? DEFAULT_ROOT_TAB);
  const rootTabConfig = getRootTabConfig(rootTab) ?? ROOT_TAB_CONFIG.all;
  const captureValidity = resolveCaptureValidity({
    rootTab,
    sampleCount,
    minimumRunsForDerivedP95,
    firstVisibleMediaRunCount: firstVisibleMediaSamples.length,
    openPhaseVisiblePreviewSummary,
  });
  const captureValidityNotes = captureValidity.valid
    ? []
    : [
        `INVALID_CAPTURE: ${captureValidity.reasons.join(", ")}.`,
        "This packet should not be treated as baseline evidence until the invalid-capture reasons are cleared.",
      ];

  return {
    packetVersion: 2,
    measuredAt: options.measuredAt ?? new Date().toISOString(),
    environment: options.environment ?? "unknown",
    captureMode: options.captureMode ?? buildCaptureModeLabel(capture),
    sampleCount,
    surface: options.surface ?? DEFAULT_SURFACE,
    notes: [
      `Derived automatically from the ${surfaceLabel} KPI capture helper.`,
      `Open-phase measurement targeted the ${rootTabConfig.label} root tab.`,
      sampleCount >= minimumRunsForDerivedP95
        ? `${sampleCount} repeated browser captures were aggregated, so direct panel timing p95 fields are derived from repeated-run evidence.`
        : `${sampleCount} repeated browser capture${sampleCount === 1 ? "" : "s"} collected. Direct panel timing p95 fields stay null until at least ${minimumRunsForDerivedP95} runs are captured.`,
      firstVisibleMediaSamples.length > 0
        ? `${firstVisibleMediaSamples.length} of ${sampleCount} capture runs reached a visible media card during the open-phase measurement.`
        : "No capture run reached a visible media card during the open-phase measurement.",
      loadingStateSamples.some((value) => value === 0)
        ? "Runs that reached a terminal media or empty state without observing loading copy count loading-state visible time as 0ms."
        : "Loading-state visible time was derived from observed loading copy during the open-phase measurement.",
      openToFirstMediaP95Ms == null
        ? "Open-to-first-media p95 was not derivable because too few runs reached visible media."
        : "Open-to-first-media p95 was derived from repeated open-phase visible-media observations.",
      signAggregate?.canonicalPreviewCoverageRatio == null
        ? "Canonical preview coverage was not derivable from open-phase panel sign stats in this run."
        : "Canonical preview coverage was derived from open-phase panel sign stats using resolved durable vs resolved original counts when available.",
      ...captureValidityNotes,
    ],
    analysis: {
      requestedRootTab: rootTab,
      captureValidity: {
        ...captureValidity,
        minimumRunsForDerivedP95,
        minimumVisibleMediaSuccessRatio: MINIMUM_VISIBLE_MEDIA_SUCCESS_RATIO,
        firstVisibleMediaRunCount: firstVisibleMediaSamples.length,
        visibleMediaCardCount: openPhaseVisiblePreviewSummary?.visibleMediaCardCount ?? 0,
      },
      signStatsPhaseUsed: signAggregate ? "open" : "none",
      openPhaseListSummary,
      openPhaseVisiblePreviewSummary,
      openPhaseSignTabBreakdown,
      postTabSignTabBreakdown,
    },
    metrics: {
      firstMediaPaintP95Ms: firstMediaPaintP95Ms == null ? null : Math.round(firstMediaPaintP95Ms),
      loadingStateVisibleMsP95:
        loadingStateVisibleMsP95 == null ? null : Math.round(loadingStateVisibleMsP95),
      openToFirstMediaP95Ms:
        openToFirstMediaP95Ms == null ? null : Math.round(openToFirstMediaP95Ms),
      stableContentSettleMsP95:
        stableContentSettleMsP95 == null ? null : Math.round(stableContentSettleMsP95),
      signBatchP95Ms: signAggregate?.signBatchP95Ms ?? null,
      resolveCallsPerOpen: resolveAggregate.resolveCallsPerOpen,
      fallbackCallsPerOpen: fallbackAggregate.fallbackCallsPerOpen,
      stateFlipCountPerOpen: stateFlipCount == null ? null : Number(stateFlipCount.toFixed(4)),
      extraListCallsPerOpen:
        extraListCallsPerOpen == null ? null : Number(extraListCallsPerOpen.toFixed(4)),
      signFailedRatio: signAggregate?.signFailedRatio ?? null,
      resolveFailedRatio: resolveAggregate.resolveFailedRatio,
      fallbackFailedRatio: fallbackAggregate.fallbackFailedRatio,
      consoleErrorsPerOpen:
        sampleCount > 0
          ? Number(
              (
                captureSamples.reduce(
                  (sum, sample) => sum + countConsoleErrors(sample?.consoleEntries),
                  0
                ) / sampleCount
              ).toFixed(4)
            )
          : null,
      visualRegressionCount: null,
      missingPreviewRatio: openPhaseVisiblePreviewSummary?.missingPreviewRatio ?? null,
      canonicalPreviewCoverageRatio: signAggregate?.canonicalPreviewCoverageRatio ?? null,
      emptyStateMismatchCount: null,
      saveRoundtripFailureRate: null,
      saveRoundtripMismatchRate: null,
      saveBrowseReadyRatio: null,
    },
  };
};

const loadAuditCredentials = () => {
  const email = (process.env.PLAYWRIGHT_AUDIT_EMAIL || "").trim();
  const password = (process.env.PLAYWRIGHT_AUDIT_PASSWORD || "").trim() || "AuditPass!12345";
  return { email, password };
};

const waitForDelay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function signIn(page, email, password) {
  const signInTab = page.getByRole("tab", { name: /^sign in$/i }).first();
  if (
    (await signInTab.isVisible().catch(() => false)) &&
    (await signInTab.getAttribute("aria-selected").catch(() => null)) !== "true"
  ) {
    await signInTab.click();
  }
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.locator("button.auth-submit").click();
}

async function waitForNonAuthRoute(page, timeoutMs) {
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

async function satisfyMediaComplianceIfPresent(page) {
  const gateHeading = page.getByRole("heading", { name: /^confirm media rights$/i }).first();
  const gateVisible = await gateHeading.isVisible().catch(() => false);
  if (!gateVisible) return;

  const agreementCheckbox = page
    .getByLabel(/^i confirm that the media i use in shortpulse follows these rules\.$/i)
    .first();
  const continueButton = page.getByRole("button", { name: /^continue$/i }).first();
  await agreementCheckbox.check({ force: true });
  await continueButton.click({ timeout: 10_000 });
  await gateHeading.waitFor({ state: "hidden", timeout: 20_000 });
}

async function ensureSignedIn(page, baseUrl, email, password) {
  await page.goto(`${baseUrl}/auth?next=%2Fai-studio`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await waitForDelay(1_000);

  if (page.url().includes("/auth")) {
    await signIn(page, email, password);
    const reached = await waitForNonAuthRoute(page, 20_000);
    if (!reached) {
      throw new Error(`Auth did not reach protected route for /ai-studio on ${baseUrl}`);
    }
  }

  await page.goto(`${baseUrl}/ai-studio`, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  await satisfyMediaComplianceIfPresent(page);
}

async function openAiStudioMediaPanel(page) {
  const panel = page.locator('section[aria-label="Media library panel"]').first();
  if (await panel.isVisible().catch(() => false)) return panel;

  const mediaButton = page.getByRole("button", { name: /^media$/i }).first();
  const expandPanelButton = page
    .getByRole("button", { name: /^expand media library panel$/i })
    .first();
  const retryProjectButton = page
    .getByRole("button", { name: /^retry (project|workspace) load$/i })
    .first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await panel.isVisible().catch(() => false)) return panel;
    if (await retryProjectButton.isVisible().catch(() => false)) {
      throw new Error(
        "AI Studio did not finish loading: retry project/workspace state is visible."
      );
    }
    if (await expandPanelButton.isVisible().catch(() => false)) {
      await expandPanelButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    if (await mediaButton.isVisible().catch(() => false)) {
      await mediaButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    await waitForDelay(500);
  }

  throw new Error("Timed out waiting for the AI Studio media panel to become ready.");
}

async function openElementsMediaPanel(page) {
  const panel = page.locator(CAPTURE_SURFACES["elements-media-panel"].panelSelector).first();
  if (await panel.isVisible().catch(() => false)) return panel;

  const elementsButton = page.getByRole("button", { name: /^elements$/i }).first();
  const elementsHeading = page.getByRole("heading", { name: /^elements library$/i }).first();
  const deadline = Date.now() + 45_000;

  while (Date.now() < deadline) {
    if (await panel.isVisible().catch(() => false)) return panel;
    if (await elementsHeading.isVisible().catch(() => false)) {
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    if (await elementsButton.isVisible().catch(() => false)) {
      await elementsButton.click({ timeout: 10_000 });
      await panel.waitFor({ timeout: 20_000 });
      return panel;
    }
    await waitForDelay(500);
  }

  throw new Error("Timed out waiting for the Elements embedded media panel to become ready.");
}

async function selectRootTab(panel, rootTab) {
  const rootTabConfig = getRootTabConfig(rootTab);
  if (!rootTabConfig || rootTab === DEFAULT_ROOT_TAB) return;
  const tab = panel.getByRole("tab", { name: new RegExp(`^${rootTabConfig.label}$`, "i") }).first();
  if (!(await tab.isVisible().catch(() => false))) {
    throw new Error(`Could not find ${rootTabConfig.label} tab in media panel.`);
  }
  const selected = (await tab.getAttribute("aria-selected").catch(() => null)) === "true";
  if (!selected) {
    await tab.click({ timeout: 10_000 });
  }
}

const clearPerfHandle = async (page) => {
  await page.evaluate(() => {
    window.__shortpulseMediaPerf?.clear?.();
  });
};

async function measurePanelOpenState(page, panelSelector, rootTab = DEFAULT_ROOT_TAB) {
  const rootTabConfig = getRootTabConfig(rootTab) ?? getRootTabConfig(DEFAULT_ROOT_TAB);
  return page.evaluate(
    async ({ selector, sectionId, loadingPattern, emptyPattern }) => {
      const panel = document.querySelector(selector);
      if (!(panel instanceof HTMLElement)) {
        return {
          firstVisibleKind: "missing",
          firstVisibleMs: null,
          loadingStateVisibleMs: null,
          stableContentSettleMs: null,
          stateFlipCount: null,
        };
      }

      const start = performance.now();
      const settleWindowMs = 400;
      const loadingRegex = new RegExp(loadingPattern, "i");
      const emptyRegex = new RegExp(emptyPattern, "i");
      let previousState = "shell";
      let stateFlipCount = 0;
      let sawLoading = false;
      let lastLoadingAt = null;
      let firstVisibleKind = null;
      let firstVisibleMs = null;
      let stableSinceMs = null;

      const readState = () => {
        const section = panel.querySelector(`#${sectionId}`);
        if (!(section instanceof HTMLElement)) return "shell";
        const text = section.textContent || "";
        const hasCard = Boolean(
          section.querySelector(
            ".media-library-panel-card, .media-library-media-card, .media-library-panel-media-card-shell"
          )
        );
        if (loadingRegex.test(text)) return "loading";
        if (hasCard) return "media";
        if (emptyRegex.test(text)) return "empty";
        return "shell";
      };

      while (performance.now() - start < 20_000) {
        const elapsedMs = Math.round(performance.now() - start);
        const nextState = readState();
        if (nextState !== previousState) {
          stateFlipCount += 1;
          previousState = nextState;
          if (nextState === firstVisibleKind) {
            stableSinceMs = elapsedMs;
          } else {
            stableSinceMs = null;
          }
        }
        if (nextState === "loading") {
          sawLoading = true;
          lastLoadingAt = elapsedMs;
        }
        if ((nextState === "media" || nextState === "empty") && firstVisibleKind == null) {
          firstVisibleKind = nextState;
          firstVisibleMs = elapsedMs;
          stableSinceMs = elapsedMs;
        }
        if (
          firstVisibleKind != null &&
          nextState === firstVisibleKind &&
          stableSinceMs != null &&
          elapsedMs - stableSinceMs >= settleWindowMs
        ) {
          return {
            firstVisibleKind,
            firstVisibleMs,
            loadingStateVisibleMs: sawLoading ? lastLoadingAt : null,
            stableContentSettleMs: elapsedMs,
            stateFlipCount,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      return {
        firstVisibleKind: firstVisibleKind ?? "timeout",
        firstVisibleMs,
        loadingStateVisibleMs: sawLoading ? lastLoadingAt : null,
        stableContentSettleMs: null,
        stateFlipCount,
      };
    },
    {
      selector: panelSelector,
      sectionId: rootTabConfig?.sectionId ?? ROOT_TAB_CONFIG.all.sectionId,
      loadingPattern: rootTabConfig?.loadingPattern ?? ROOT_TAB_CONFIG.all.loadingPattern,
      emptyPattern: rootTabConfig?.emptyPattern ?? ROOT_TAB_CONFIG.all.emptyPattern,
    }
  );
}

async function captureVisiblePreviewSummary(page, panelSelector, rootTab = DEFAULT_ROOT_TAB) {
  const rootTabConfig = getRootTabConfig(rootTab) ?? getRootTabConfig(DEFAULT_ROOT_TAB);
  return page.evaluate(
    ({ selector, sectionId }) => {
      const panel = document.querySelector(selector);
      if (!(panel instanceof HTMLElement)) return null;
      const section = panel.querySelector(`#${sectionId}`);
      if (!(section instanceof HTMLElement)) return null;

      const panelRect = panel.getBoundingClientRect();
      const cards = Array.from(
        section.querySelectorAll(".media-library-panel-media-card-shell")
      ).filter((node) => node instanceof HTMLElement);

      const visibleCards = cards.filter((node) => {
        const rect = node.getBoundingClientRect();
        return (
          rect.bottom > panelRect.top &&
          rect.top < panelRect.bottom &&
          rect.width > 0 &&
          rect.height > 0
        );
      });

      const summary = visibleCards.reduce(
        (sum, card) => {
          sum.visibleMediaCardCount += 1;
          const isAudioShell = card.classList.contains("media-library-panel-audio-card-shell");
          const hasRenderedVisual = Boolean(
            card.querySelector("img.media-thumb, video.media-thumb")
          );
          const hasRenderedAudioShell = Boolean(
            card.querySelector(".reference-card-audio-shell, .reference-audio-player")
          );
          const hasPreviewRepresentation = isAudioShell
            ? hasRenderedAudioShell || hasRenderedVisual
            : hasRenderedVisual;
          if (hasPreviewRepresentation) {
            sum.visiblePreviewReadyCount += 1;
          } else {
            sum.visibleMissingPreviewCount += 1;
          }
          return sum;
        },
        {
          visibleMediaCardCount: 0,
          visiblePreviewReadyCount: 0,
          visibleMissingPreviewCount: 0,
        }
      );

      return summary;
    },
    {
      selector: panelSelector,
      sectionId: rootTabConfig?.sectionId ?? ROOT_TAB_CONFIG.all.sectionId,
    }
  );
}

async function captureTabResults(page, panel) {
  const tabNames = ["All Media", "Images", "Prompts"];
  const results = [];

  for (const tabName of tabNames) {
    const tab = panel.getByRole("tab", { name: new RegExp(`^${tabName}$`, "i") }).first();
    if (!(await tab.isVisible().catch(() => false))) continue;
    const startedAt = Date.now();
    await tab.click();
    await waitForDelay(700);
    const visibleMs = Date.now() - startedAt;
    const text = await panel.evaluate((node) => node.textContent || "");
    results.push({
      tabName,
      visibleMs,
      sawEmpty: /No prompts found for this folder\.|No media found/i.test(text),
    });
  }

  return results;
}

const readPerfHandle = async (page) =>
  page.evaluate(() => {
    const handle = window.__shortpulseMediaPerf;
    if (!handle) return { available: false };
    return {
      available: true,
      durationStats: typeof handle.durationStats === "function" ? handle.durationStats() : null,
      signStats: typeof handle.signStats === "function" ? handle.signStats() : null,
      resolveStats: typeof handle.resolveStats === "function" ? handle.resolveStats() : null,
      fallbackStats: typeof handle.fallbackStats === "function" ? handle.fallbackStats() : null,
    };
  });

async function runPanelCapture({ baseUrl, headless, surface, rootTab }) {
  const surfaceSpec = getCaptureSurfaceSpec(surface);
  if (!surfaceSpec) {
    throw new Error(
      `Unsupported capture surface: ${surface}. Supported surfaces: ${Object.keys(CAPTURE_SURFACES).join(", ")}.`
    );
  }

  const creds = loadAuditCredentials();
  if (!creds.email) {
    throw new Error("PLAYWRIGHT_AUDIT_EMAIL is required.");
  }
  if (/@example\.com$/i.test(creds.email)) {
    throw new Error(
      "PLAYWRIGHT_AUDIT_EMAIL cannot use @example.com. Use a dedicated real test account."
    );
  }

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ viewport: { width: 1720, height: 980 } });
  const page = await context.newPage();

  const consoleEntries = [];
  const listRequests = [];
  const resolveRequests = [];
  const openPhaseListSummaries = [];
  const requestPhaseByRequest = new WeakMap();
  const pendingResponseTasks = [];
  let capturePhase = rootTab === DEFAULT_ROOT_TAB ? "open" : "bootstrap";
  page.on("console", (message) => {
    const text = message.text();
    if (shouldIgnoreConsole(text)) return;
    consoleEntries.push({ type: message.type(), text });
  });
  page.on("request", (request) => {
    requestPhaseByRequest.set(request, capturePhase);
    const url = request.url();
    if (url.includes("/api/media/list")) {
      listRequests.push({ url, method: request.method(), phase: capturePhase });
    }
    if (url.includes("/api/media/resolve-previews")) {
      resolveRequests.push({ url, method: request.method(), phase: capturePhase });
    }
  });
  page.on("response", (response) => {
    const task = (async () => {
      const url = response.url();
      if (!url.includes("/api/media/list")) return;
      const request = response.request();
      const phase = requestPhaseByRequest.get(request) ?? "unknown";
      if (phase !== "open") return;
      let requestBody = null;
      try {
        requestBody = request.postDataJSON?.() ?? null;
      } catch {
        requestBody = null;
      }
      try {
        const payload = await response.json();
        openPhaseListSummaries.push(
          summarizeMediaListResponse({
            requestBody,
            payload,
          })
        );
      } catch {
        // Ignore non-JSON or unreadable payloads; KPI capture stays best-effort.
      }
    })();
    pendingResponseTasks.push(task);
  });

  try {
    await ensureSignedIn(page, baseUrl, creds.email, creds.password);
    const panel =
      surface === "elements-media-panel"
        ? await openElementsMediaPanel(page)
        : await openAiStudioMediaPanel(page);
    if (rootTab !== DEFAULT_ROOT_TAB) {
      listRequests.length = 0;
      resolveRequests.length = 0;
      openPhaseListSummaries.length = 0;
      await clearPerfHandle(page);
      capturePhase = "open";
      await selectRootTab(panel, rootTab);
    }
    const openState = await measurePanelOpenState(page, surfaceSpec.panelSelector, rootTab);
    await waitForDelay(1_200);
    const openPhaseVisiblePreviewSummary = await captureVisiblePreviewSummary(
      page,
      surfaceSpec.panelSelector,
      rootTab
    );
    const openPhasePerfHandle = await readPerfHandle(page);
    capturePhase = "tabs";
    const tabResults = await captureTabResults(page, panel);
    capturePhase = "post-tabs";
    const postTabPerfHandle = await readPerfHandle(page);
    await Promise.allSettled(pendingResponseTasks);

    return {
      ok: countConsoleErrors(consoleEntries) === 0,
      baseUrl,
      finalUrl: page.url(),
      rootTab,
      telemetrySurface: surfaceSpec.telemetrySurface,
      firstVisibleKind: openState.firstVisibleKind,
      firstVisibleMs: openState.firstVisibleMs,
      loadingStateVisibleMs: openState.loadingStateVisibleMs,
      stableContentSettleMs: openState.stableContentSettleMs,
      stateFlipCount: openState.stateFlipCount,
      tabResults,
      listRequestCount: listRequests.length,
      initialListRequestCount: listRequests.filter((entry) => entry.phase === "open").length,
      resolveRequestCount: resolveRequests.length,
      initialResolveRequestCount: resolveRequests.filter((entry) => entry.phase === "open").length,
      consoleEntries,
      openPhasePerfHandle,
      openPhaseListSummary: selectRepresentativeOpenPhaseListSummary(openPhaseListSummaries),
      openPhaseVisiblePreviewSummary,
      postTabPerfHandle,
      perfHandle: postTabPerfHandle,
    };
  } finally {
    await context.close();
    await browser.close();
  }
}

const collectPanelCaptures = async ({ baseUrl, headless, surface, rootTab, runs }) => {
  const captures = [];
  for (let runIndex = 0; runIndex < runs; runIndex += 1) {
    captures.push(await runPanelCapture({ baseUrl, headless, surface, rootTab }));
  }
  return {
    baseUrl,
    surface,
    rootTab: rootTab ?? DEFAULT_ROOT_TAB,
    telemetrySurface: getCaptureSurfaceSpec(surface)?.telemetrySurface ?? DEFAULT_TELEMETRY_SURFACE,
    finalUrl: captures[captures.length - 1]?.finalUrl ?? null,
    captures,
  };
};

const writeJsonFile = (outputPath, value) => {
  const absolutePath = path.resolve(process.cwd(), outputPath);
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

const buildInvalidCaptureNotice = (packet) => {
  const validity = packet?.analysis?.captureValidity;
  if (!validity || validity.valid !== false) return null;
  return `Invalid capture: ${validity.reasons.join(", ")}.`;
};

const main = async () => {
  loadAuditEnv();
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const baseUrl =
    args.baseUrl || (process.env.PLAYWRIGHT_MEDIA_LIBRARY_BASE_URL || DEFAULT_BASE_URL).trim();
  const headless = resolveHeadless(args.headless);
  const runs = resolveRuns(args.runs);
  const rootTab = resolveRootTab(args.rootTab);
  const capture = await collectPanelCaptures({
    baseUrl,
    headless,
    surface: args.surface,
    rootTab,
    runs,
  });
  const packet = buildPacketFromPanelCapture(capture, {
    environment: /localhost|127\.0\.0\.1/i.test(baseUrl) ? "development" : "production",
    captureMode: buildCaptureModeLabel(capture),
    surface: args.surface,
    rootTab,
  });
  const scored = scorePacket(packet);
  const report = {
    capture,
    packet,
    scored,
  };
  const invalidCaptureNotice = buildInvalidCaptureNotice(packet);

  if (args.writePacket) {
    writeJsonFile(args.writePacket, packet);
  }

  if (args.format === "packet") {
    process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    if (invalidCaptureNotice) process.exitCode = 2;
    return;
  }
  if (args.format === "markdown") {
    process.stdout.write(
      `${invalidCaptureNotice ? `${invalidCaptureNotice}\n\n` : ""}${buildMarkdownReport(scored)}\n`
    );
    if (invalidCaptureNotice) process.exitCode = 2;
    return;
  }
  if (args.format === "text") {
    process.stdout.write(
      [
        invalidCaptureNotice,
        `Surface: ${scored.surfaceLabel} (${scored.surface})`,
        `Overall score: ${scored.overallScore10} / 10 (${scored.grade})`,
        `Readiness: ${scored.readiness}`,
        `Evidence quality: ${scored.evidence}`,
        `Coverage: ${(scored.coverage * 100).toFixed(0)}%`,
        `Capture URL: ${capture.finalUrl ?? baseUrl}`,
      ]
        .filter(Boolean)
        .join("\n") + "\n"
    );
    if (invalidCaptureNotice) process.exitCode = 2;
    return;
  }

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (invalidCaptureNotice) process.exitCode = 2;
};

if (path.resolve(process.argv[1] || "") === SCRIPT_FILE) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
