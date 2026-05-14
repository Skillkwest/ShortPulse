#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import path from "node:path";
import process from "node:process";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../scripts/lib/load_local_env.mjs";

const SCRIPT_FILE = fileURLToPath(import.meta.url);
const FRONTEND_ROOT = path.resolve(path.dirname(SCRIPT_FILE), "..");
const REPO_ROOT = path.resolve(FRONTEND_ROOT, "..");

const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [
    path.join(REPO_ROOT, ".env.agent.local"),
    path.join(FRONTEND_ROOT, ".env.local"),
    path.join(REPO_ROOT, ".env.local"),
  ],
});

const DEFAULT_BASE_URL = process.env.SHORTPULSE_STAGING_BASE_URL?.trim() || "";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_SAMPLES = 6;
const DEFAULT_WARMUP = 2;
const DEFAULT_SURFACE = "media-library-panel";
const DEFAULT_MEDIA_KIND = "all";
const DEFAULT_PROFILE = "expanded";
const DEFAULT_ROUTE_LIMIT = 60;
const DEFAULT_SURFACE_LIMIT = 36;
const DEFAULT_OUTPUT_FILE = path.join(
  os.tmpdir(),
  "media-library-phase0-bundle.latest.md"
);
const SURFACE_PRESETS = {
  panel: {
    surface: "media-library-panel",
    mediaKind: "all",
    profile: "expanded",
  },
  route: {
    surface: "media-library-route",
    mediaKind: "all",
    profile: "expanded",
  },
  modal: {
    surface: "media-library-modal",
    mediaKind: "all",
    profile: "expanded",
  },
  images: {
    surface: "media-library-panel",
    mediaKind: "images",
    profile: "minimal",
  },
  videos: {
    surface: "media-library-panel",
    mediaKind: "videos",
    profile: "minimal",
  },
  audio: {
    surface: "media-library-panel",
    mediaKind: "audio",
    profile: "expanded",
  },
};

const CHECKLIST_LINES = [
  "Phase 0 Checklist",
  "1. Lock the browse contract for grid preview, full-view asset, and allowed fallback.",
  "2. Reconcile doc/runtime drift for folder-canvas behavior and performance tuning docs.",
  "3. Capture baseline metrics: first visible media paint, first decoded image, first visible video frame, sign-batch calls per open, resolve-previews rate, storage-download fallback rate, repeat-open latency.",
  "4. Capture derivative coverage: image thumbs, video posters, video hover previews, backlog size, terminal failure classes.",
  "5. Run the route/runtime audit on a real large library and preserve the output packet.",
  "6. Record which runtime knobs are real controls versus hard-coded behavior.",
];

const SQL_DIAGNOSTICS = [
  "sql/check_media_preview_variant_coverage_and_size.sql",
  "sql/check_media_derivative_processing_backlog.sql",
  "sql/check_media_derivative_terminal_failures.sql",
  "sql/check_media_all_media_completeness_drift.sql",
];

const E2E_COMMANDS = [
  "npm -C frontend run test:e2e:media-library-runtime",
  "npm -C frontend run test:e2e:media-library-runtime -- --help",
];

const AbortControllerGlobal = globalThis.AbortController;
const fetchGlobal = globalThis.fetch;
const setTimeoutGlobal = globalThis.setTimeout;
const clearTimeoutGlobal = globalThis.clearTimeout;
const URLGlobal = globalThis.URL;

const normalizePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const normalizeString = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizePreset = (value) => {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) return "";
  return normalized;
};

export const resolveSurfacePreset = (preset) => {
  const normalizedPreset = normalizePreset(preset);
  if (!normalizedPreset) return null;
  return SURFACE_PRESETS[normalizedPreset] ?? null;
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

  const preset = normalizePreset(readValue("--preset"));
  const presetConfig = resolveSurfacePreset(preset);
  if (preset && !presetConfig) {
    throw new Error(
      `Unknown --preset value: ${preset}. Expected one of ${Object.keys(SURFACE_PRESETS).join(", ")}.`
    );
  }

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    runProbe: argv.includes("--run-probe"),
    baseUrl: normalizeString(readValue("--base-url")) || DEFAULT_BASE_URL,
    token: normalizeString(readValue("--token")) || "",
    timeoutMs: normalizePositiveInteger(readValue("--timeout-ms"), DEFAULT_TIMEOUT_MS),
    samples: normalizePositiveInteger(readValue("--samples"), DEFAULT_SAMPLES),
    warmup: normalizePositiveInteger(readValue("--warmup"), DEFAULT_WARMUP),
    preset,
    surface:
      normalizeString(readValue("--surface")) || presetConfig?.surface || DEFAULT_SURFACE,
    mediaKind:
      normalizeString(readValue("--media-kind")) || presetConfig?.mediaKind || DEFAULT_MEDIA_KIND,
    profile:
      normalizeString(readValue("--profile")) || presetConfig?.profile || DEFAULT_PROFILE,
    limit: normalizePositiveInteger(readValue("--limit"), 0),
    output: normalizeString(readValue("--output")) || DEFAULT_OUTPUT_FILE,
    jsonOutput: normalizeString(readValue("--json-output")) || "",
    writeFile: !argv.includes("--no-write"),
    writeJson: argv.includes("--json-stdout"),
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_library_phase0_bundle.mjs [options]",
      "",
      "Options:",
      "  --run-probe              Run live authenticated probes for /api/media/list, /api/media/sign-batch, /api/media/resolve-previews.",
      `  --base-url <url>         App base URL. Default env: SHORTPULSE_STAGING_BASE_URL (${DEFAULT_BASE_URL || "unset"}).`,
      "  --token <token>          Bearer token for a real user with media rows. Required for --run-probe.",
      `  --preset <name>          Preset probe shape: ${Object.keys(SURFACE_PRESETS).join(", ")}.`,
      `  --surface <value>        Probe surface. Default: ${DEFAULT_SURFACE}.`,
      `  --media-kind <value>     Probe media kind. Default: ${DEFAULT_MEDIA_KIND}.`,
      `  --profile <value>        Probe list profile. Default: ${DEFAULT_PROFILE}.`,
      "  --limit <n>              Probe list page size. Defaults to the current surface-specific browse limit.",
      `  --samples <n>            Timed sample count per endpoint. Default: ${DEFAULT_SAMPLES}.`,
      `  --warmup <n>             Warmup count per endpoint. Default: ${DEFAULT_WARMUP}.`,
      `  --timeout-ms <n>         Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}.`,
      `  --output <path>          Markdown summary output path. Default: ${DEFAULT_OUTPUT_FILE}.`,
      "  --json-output <path>     Optional JSON summary output path.",
      "  --json-stdout            Print the JSON summary after the markdown report.",
      "  --no-write               Print summary only; do not write a markdown file.",
      "  --help                   Show this message.",
      "",
    ].join("\n")
  );
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(Math.max(idx, 0), sorted.length - 1)];
};

const summarizeStatuses = (statuses) => {
  const counts = new Map();
  for (const status of statuses) {
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([status, count]) => `${status}:${count}`)
    .join(", ");
};

const fetchJson = async ({ baseUrl, routePath, token, method = "POST", body, timeoutMs }) => {
  const controller = new AbortControllerGlobal();
  const timeout = setTimeoutGlobal(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetchGlobal(new URLGlobal(routePath, baseUrl), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-shortpulse-phase0-bundle": "true",
      },
      body: body == null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const elapsedMs = performance.now() - started;
    const payload = await response.json().catch(() => null);
    return {
      elapsedMs,
      status: response.status,
      ok: response.ok,
      payload,
    };
  } finally {
    clearTimeoutGlobal(timeout);
  }
};

export const buildListRequestBody = ({ surface, mediaKind, profile, limit }) => {
  const effectiveLimit =
    limit > 0 ? limit : surface === "media-library-route" ? DEFAULT_ROUTE_LIMIT : DEFAULT_SURFACE_LIMIT;

  return {
    tab: undefined,
    mediaKind,
    query: "",
    cursor: null,
    limit: effectiveLimit,
    surface,
    profile,
    includeLibraryTotalCount: surface === "media-library-panel",
  };
};

const isVideoFileType = (fileType) => typeof fileType === "string" && fileType.startsWith("video");

export const collectProbePathsFromRows = (rows) => {
  const paths = [];
  for (const row of rows) {
    const posterVariantPath = normalizeString(row?.poster_variant_path);
    const previewVariantPath = normalizeString(row?.preview_variant_path);
    const thumbVariantPath = normalizeString(row?.thumb_variant_path);
    const storagePath = normalizeString(row?.storage_path);
    if (isVideoFileType(row?.file_type)) {
      if (posterVariantPath) paths.push(posterVariantPath);
      else if (previewVariantPath) paths.push(previewVariantPath);
      else if (storagePath) paths.push(storagePath);
      continue;
    }
    if (thumbVariantPath) paths.push(thumbVariantPath);
    else if (storagePath) paths.push(storagePath);
  }
  return Array.from(new Set(paths.filter(Boolean))).slice(0, 8);
};

export const collectProbeIdsFromRows = (rows) =>
  Array.from(
    new Set(
      rows
        .map((row) => normalizeString(row?.id))
        .filter(Boolean)
    )
  ).slice(0, 8);

export const buildProbeWarnings = (probe) => {
  const warnings = [];
  if (!probe) return warnings;
  if (probe.sampleRowCount === 0) {
    warnings.push(
      "Prime /api/media/list probe returned zero rows. Use a token for a real populated library before trusting the latency packet."
    );
  }
  if (probe.samplePathCount === 0) {
    warnings.push(
      "No sign-batch candidate paths were derived from the sampled rows. Review derivative coverage or probe a richer surface."
    );
  }
  if (probe.sampleIdCount === 0) {
    warnings.push(
      "No media ids were derived for resolve-previews sampling. The resolver lane was not exercised by this packet."
    );
  }
  if (probe.results.some((result) => !result.allOk)) {
    warnings.push(
      "One or more sampled endpoints returned non-2xx statuses. Treat the packet as environment evidence, not a clean baseline."
    );
  }
  return warnings;
};

const runSamples = async ({ label, requestFactory, warmup, samples }) => {
  const warmupStatuses = [];
  for (let index = 0; index < warmup; index += 1) {
    const response = await requestFactory();
    warmupStatuses.push(response.status);
  }

  const durations = [];
  const statuses = [];
  for (let index = 0; index < samples; index += 1) {
    const response = await requestFactory();
    durations.push(response.elapsedMs);
    statuses.push(response.status);
  }

  return {
    label,
    samples,
    warmup,
    p50Ms: Number(percentile(durations, 50).toFixed(1)),
    p95Ms: Number(percentile(durations, 95).toFixed(1)),
    minMs: Number(Math.min(...durations).toFixed(1)),
    maxMs: Number(Math.max(...durations).toFixed(1)),
    statusSummary: summarizeStatuses(statuses),
    warmupStatusSummary: summarizeStatuses(warmupStatuses),
    allOk: statuses.every((status) => status >= 200 && status < 300),
  };
};

export const buildMarkdownReport = ({ args, probe }) => {
  const warnings = buildProbeWarnings(probe);
  const lines = [];
  lines.push("# Media Library Phase 0 Bundle");
  lines.push("");
  lines.push(`- Generated: ${new Date().toISOString()}`);
  lines.push(`- Preset: ${args.preset || "custom"}`);
  lines.push(`- Surface: ${args.surface}`);
  lines.push(`- Media kind: ${args.mediaKind}`);
  lines.push(`- Profile: ${args.profile}`);
  lines.push(`- List limit: ${buildListRequestBody(args).limit}`);
  lines.push(`- Live probe run: ${probe ? "yes" : "no"}`);
  lines.push(`- Env files loaded: ${LOADED_ENV_FILES.length > 0 ? LOADED_ENV_FILES.join(", ") : "none"}`);
  lines.push("");
  lines.push("## Checklist");
  lines.push("");
  for (const line of CHECKLIST_LINES) {
    lines.push(`- ${line}`);
  }
  lines.push("");
  lines.push("## SQL Diagnostics");
  lines.push("");
  for (const file of SQL_DIAGNOSTICS) {
    lines.push(`- \`${file}\``);
  }
  lines.push("");
  lines.push("## E2E Audit Commands");
  lines.push("");
  for (const command of E2E_COMMANDS) {
    lines.push(`- \`${command}\``);
  }
  if (warnings.length > 0) {
    lines.push("");
    lines.push("## Probe Warnings");
    lines.push("");
    for (const warning of warnings) {
      lines.push(`- ${warning}`);
    }
  }
  if (probe) {
    lines.push("");
    lines.push("## Live Probe");
    lines.push("");
    lines.push(`- Sample rows observed: ${probe.sampleRowCount}`);
    lines.push(`- Probe storage paths: ${probe.samplePathCount}`);
    lines.push(`- Probe media ids: ${probe.sampleIdCount}`);
    lines.push("");
    lines.push("| Endpoint | Samples | p50 ms | p95 ms | Min ms | Max ms | Statuses |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const result of probe.results) {
      lines.push(
        `| ${result.label} | ${result.samples} | ${result.p50Ms} | ${result.p95Ms} | ${result.minMs} | ${result.maxMs} | ${result.statusSummary} |`
      );
    }
  }
  lines.push("");
  lines.push("## Suggested Next Commands");
  lines.push("");
  lines.push("- `cd frontend && npm run test:e2e:media-library-runtime`");
  lines.push(
    "- `cd frontend && npm run media:phase0:probe -- --preset panel --base-url <url> --token <token> --json-output /tmp/media-library-phase0.json`"
  );
  lines.push("- `supabase db remote commit --help`");
  return `${lines.join("\n")}\n`;
};

export const buildJsonReport = ({ args, probe }) => ({
  generatedAt: new Date().toISOString(),
  args: {
    preset: args.preset || null,
    surface: args.surface,
    mediaKind: args.mediaKind,
    profile: args.profile,
    limit: buildListRequestBody(args).limit,
    runProbe: args.runProbe,
    samples: args.samples,
    warmup: args.warmup,
    timeoutMs: args.timeoutMs,
  },
  envFilesLoaded: LOADED_ENV_FILES,
  checklist: CHECKLIST_LINES,
  sqlDiagnostics: SQL_DIAGNOSTICS,
  e2eCommands: E2E_COMMANDS,
  warnings: buildProbeWarnings(probe),
  probe,
});

const writeReport = (outputPath, content) => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, content, "utf8");
};

const runProbe = async (args) => {
  if (!args.baseUrl) {
    throw new Error("Missing --base-url (or SHORTPULSE_STAGING_BASE_URL) for --run-probe.");
  }
  if (!args.token) {
    throw new Error("Missing --token for --run-probe. Use a real user with media rows.");
  }

  const listBody = buildListRequestBody(args);
  const primeListResponse = await fetchJson({
    baseUrl: args.baseUrl,
    routePath: "/api/media/list",
    token: args.token,
    body: listBody,
    timeoutMs: args.timeoutMs,
  });
  if (!primeListResponse.ok) {
    throw new Error(`Prime list probe failed with status ${primeListResponse.status}.`);
  }
  const primeRows = Array.isArray(primeListResponse.payload?.rows) ? primeListResponse.payload.rows : [];
  const probePaths = collectProbePathsFromRows(primeRows);
  const probeIds = collectProbeIdsFromRows(primeRows);

  const results = [];
  results.push(
    await runSamples({
      label: "POST /api/media/list",
      warmup: args.warmup,
      samples: args.samples,
      requestFactory: () =>
        fetchJson({
          baseUrl: args.baseUrl,
          routePath: "/api/media/list",
          token: args.token,
          body: listBody,
          timeoutMs: args.timeoutMs,
        }),
    })
  );

  if (probePaths.length > 0) {
    results.push(
      await runSamples({
        label: "POST /api/media/sign-batch",
        warmup: args.warmup,
        samples: args.samples,
        requestFactory: () =>
          fetchJson({
            baseUrl: args.baseUrl,
            routePath: "/api/media/sign-batch",
            token: args.token,
            body: {
              bucket: "media_library",
              paths: probePaths,
              surface: args.surface,
            },
            timeoutMs: args.timeoutMs,
          }),
      })
    );
  }

  if (probeIds.length > 0) {
    results.push(
      await runSamples({
        label: "POST /api/media/resolve-previews",
        warmup: args.warmup,
        samples: args.samples,
        requestFactory: () =>
          fetchJson({
            baseUrl: args.baseUrl,
            routePath: "/api/media/resolve-previews",
            token: args.token,
            body: {
              ids: probeIds,
              surface: args.surface,
            },
            timeoutMs: args.timeoutMs,
          }),
      })
    );
  }

  return {
    sampleRowCount: primeRows.length,
    samplePathCount: probePaths.length,
    sampleIdCount: probeIds.length,
    results,
  };
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const probe = args.runProbe ? await runProbe(args) : null;
  const report = buildMarkdownReport({ args, probe });
  process.stdout.write(report);

  if (args.writeFile) {
    writeReport(args.output, report);
    process.stdout.write(`\nSaved report to ${args.output}\n`);
  }

  const jsonReport = buildJsonReport({ args, probe });
  if (args.jsonOutput) {
    writeReport(args.jsonOutput, `${JSON.stringify(jsonReport, null, 2)}\n`);
    process.stdout.write(`Saved JSON report to ${args.jsonOutput}\n`);
  }
  if (args.writeJson) {
    process.stdout.write(`\n${JSON.stringify(jsonReport, null, 2)}\n`);
  }
};

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === SCRIPT_FILE) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
