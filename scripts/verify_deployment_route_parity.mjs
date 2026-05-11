#!/usr/bin/env node

/**
 * Verifies that a deployment behind a target URL/alias exposes required internal routes.
 * Hard-fails when any required route is missing from Vercel inspect build output.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const execFileAsync = promisify(execFile);

const DEFAULT_REQUIRED_ROUTES = [
  "/api/internal/admin-user-health-fleet/run",
  "/api/internal/generation-recovery/run",
  "/api/internal/media-derivatives/run",
];

const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [".env.agent.local", "frontend/.env.local"],
});

const usage = () => {
  console.log(`Usage:
  node scripts/verify_deployment_route_parity.mjs [options]

Options:
  --base-url <url>        Deployment alias/URL to inspect.
                          Fallback env: SHORTPULSE_STAGING_BASE_URL, APP_BASE_URL
  --required-route <path> Required route path (repeatable). If omitted, defaults to:
${DEFAULT_REQUIRED_ROUTES.map((route) => `                          - ${route}`).join("\n")}
  --token <token>         Vercel API token.
                          Optional. Falls back to authenticated \`vercel\` CLI state when omitted.
                          Env fallback: SHORTPULSE_VERCEL_API_TOKEN, VERCEL_API_TOKEN
  --max-deployment-age-hours <hours>
                          Optional deployment-age gate (fail if older than this value).
  --min-created-at <instant>
                          Optional deployment-created-at gate (ISO timestamp or epoch seconds/ms).
  --output <json-path>    Optional machine-readable summary output path.
  --env-file <path>       Optional env file path (repeatable). Parsed by shared loader.
  --help                  Show this message.
`);
};

const readArgValue = (argv, index, label) => {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${label} requires a value`);
  }
  return value;
};

const sanitizeBaseUrl = (value) => value.trim().replace(/\/+$/, "");

const normalizePathLike = (rawValue) => {
  const raw = rawValue.trim();
  if (!raw) return "";

  let candidate = raw;
  if (/^https?:\/\//i.test(candidate)) {
    try {
      candidate = new URL(candidate).pathname;
    } catch {
      // Keep raw value if URL parsing fails; downstream normalization still applies.
    }
  }

  const noQuery = candidate.split("?")[0]?.split("#")[0] ?? candidate;
  const trimmed = noQuery.trim();
  if (!trimmed) return "";

  return `/${trimmed
    .replace(/^\.?\//, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .toLowerCase()}`;
};

const parseArgs = (argv) => {
  const parsed = {
    baseUrl:
      process.env.SHORTPULSE_STAGING_BASE_URL?.trim() ?? process.env.APP_BASE_URL?.trim() ?? "",
    token:
      process.env.SHORTPULSE_VERCEL_API_TOKEN?.trim() ??
      process.env.VERCEL_API_TOKEN?.trim() ??
      "",
    requiredRoutes: [],
    maxDeploymentAgeHours: null,
    minCreatedAt: "",
    output: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = readArgValue(argv, index, "--base-url").trim();
      index += 1;
      continue;
    }
    if (arg === "--required-route") {
      parsed.requiredRoutes.push(readArgValue(argv, index, "--required-route"));
      index += 1;
      continue;
    }
    if (arg === "--token") {
      parsed.token = readArgValue(argv, index, "--token").trim();
      index += 1;
      continue;
    }
    if (arg === "--max-deployment-age-hours") {
      parsed.maxDeploymentAgeHours = readArgValue(argv, index, "--max-deployment-age-hours").trim();
      index += 1;
      continue;
    }
    if (arg === "--min-created-at") {
      parsed.minCreatedAt = readArgValue(argv, index, "--min-created-at").trim();
      index += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.output = readArgValue(argv, index, "--output").trim();
      index += 1;
      continue;
    }
    if (arg === "--env-file") {
      // Handled by shared env loader.
      readArgValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.baseUrl = sanitizeBaseUrl(parsed.baseUrl);
  parsed.requiredRoutes =
    parsed.requiredRoutes.length > 0 ? parsed.requiredRoutes : [...DEFAULT_REQUIRED_ROUTES];
  return parsed;
};

const ensureRequiredInputs = ({ baseUrl, requiredRoutes }) => {
  const missing = [];
  if (!baseUrl) {
    missing.push("SHORTPULSE_STAGING_BASE_URL or APP_BASE_URL (or --base-url)");
  }
  const normalized = requiredRoutes.map((route) => normalizePathLike(route)).filter(Boolean);
  if (normalized.length === 0) {
    missing.push("at least one valid --required-route value");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required inputs:\n- ${missing.join("\n- ")}`);
  }
};

const parsePositiveNumber = (value, label) => {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return numeric;
};

const parseInspectJson = (stdout) => {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error("vercel inspect returned empty output.");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error("vercel inspect output was not valid JSON.");
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
};

const summarizeExecFailure = (error) => {
  const stderr =
    typeof error?.stderr === "string" && error.stderr.trim() ? error.stderr.trim() : "";
  const stdout =
    typeof error?.stdout === "string" && error.stdout.trim() ? error.stdout.trim() : "";

  if (stderr) return stderr;
  if (stdout) return stdout;
  return "vercel inspect failed.";
};

const asIsoTimestamp = (value) => {
  if (value === undefined || value === null || value === "") return "unknown";
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 10_000_000_000 ? value : value * 1_000;
    return new Date(ms).toISOString();
  }
  const fromString = Date.parse(String(value));
  if (!Number.isNaN(fromString)) {
    return new Date(fromString).toISOString();
  }
  return String(value);
};

const asEpochMs = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1_000;
  }
  const parsed = Date.parse(String(value));
  if (!Number.isNaN(parsed)) {
    return parsed;
  }
  return null;
};

const toDeploymentUrl = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  return `https://${raw.replace(/\/+$/, "")}`;
};

const extractResolvedDeploymentUrl = (inspectResult, baseUrl) => {
  const candidates = [
    inspectResult?.url,
    inspectResult?.inspectorUrl,
    inspectResult?.aliasAssigned?.[0],
    inspectResult?.meta?.url,
  ];
  for (const candidate of candidates) {
    const normalized = toDeploymentUrl(candidate);
    if (normalized) return normalized;
  }
  return toDeploymentUrl(baseUrl);
};

const normalizeOutputPath = (pathValue) => {
  const normalized = normalizePathLike(pathValue);
  if (!normalized) return "";
  return normalized.replace(/\.func$/i, "");
};

const collectBuildOutputPaths = (inspectResult) => {
  const discovered = new Set();
  const visited = new Set();

  const visit = (node) => {
    if (node === null || node === undefined) return;
    if (typeof node !== "object") return;
    if (visited.has(node)) return;
    visited.add(node);

    if (Array.isArray(node)) {
      for (const value of node) visit(value);
      return;
    }

    const rawPath = typeof node.path === "string" ? node.path : "";
    const normalized = rawPath ? normalizeOutputPath(rawPath) : "";
    if (normalized) {
      discovered.add(normalized);
    }

    for (const value of Object.values(node)) {
      visit(value);
    }
  };

  visit(inspectResult?.builds);
  return discovered;
};

const pathMatchesRequired = (requiredRoute, candidatePath) => {
  if (candidatePath === requiredRoute) return true;
  if (candidatePath.startsWith(`${requiredRoute}.`)) return true;
  if (candidatePath.startsWith(`${requiredRoute}/`)) return true;
  return false;
};

const run = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }

  ensureRequiredInputs(args);

  const requiredRoutes = args.requiredRoutes
    .map((route) => normalizePathLike(route))
    .filter(Boolean);
  const maxDeploymentAgeHours = parsePositiveNumber(
    args.maxDeploymentAgeHours,
    "--max-deployment-age-hours"
  );
  const minCreatedAtMs = args.minCreatedAt ? asEpochMs(args.minCreatedAt) : null;
  if (args.minCreatedAt && minCreatedAtMs === null) {
    throw new Error(`Invalid --min-created-at: ${args.minCreatedAt}`);
  }

  const inspectArgs = ["inspect", args.baseUrl, "--format=json"];
  const usingCliAuth = !args.token;
  if (args.token) {
    inspectArgs.push("--token", args.token);
  }
  let stdout = "";
  let stderr = "";
  try {
    const result = await execFileAsync("vercel", inspectArgs, {
      maxBuffer: 10 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    throw new Error(summarizeExecFailure(error));
  }

  const inspectResult = parseInspectJson(stdout);
  const resolvedDeploymentUrl = extractResolvedDeploymentUrl(inspectResult, args.baseUrl);
  const createdAtRaw = inspectResult?.createdAt ?? inspectResult?.meta?.createdAt ?? inspectResult?.created;
  const createdAt = asIsoTimestamp(createdAtRaw);
  const createdAtMs = asEpochMs(createdAtRaw);

  const buildPaths = collectBuildOutputPaths(inspectResult);
  const missingRoutes = requiredRoutes.filter((requiredRoute) => {
    for (const candidatePath of buildPaths) {
      if (pathMatchesRequired(requiredRoute, candidatePath)) {
        return false;
      }
    }
    return true;
  });

  console.log(`[route-parity] target: ${args.baseUrl}`);
  console.log(`[route-parity] resolved deployment: ${resolvedDeploymentUrl || "unknown"}`);
  console.log(`[route-parity] created at: ${createdAt}`);
  console.log(
    `[route-parity] auth mode: ${usingCliAuth ? "vercel-cli-session" : "token"}`
  );
  console.log(`[route-parity] loaded env files: ${LOADED_ENV_FILES.length}`);
  console.log(`[route-parity] route entries inspected: ${buildPaths.size}`);
  if (maxDeploymentAgeHours !== null) {
    console.log(`[route-parity] max deployment age hours: ${maxDeploymentAgeHours}`);
  }
  if (minCreatedAtMs !== null) {
    console.log(`[route-parity] minimum created at: ${new Date(minCreatedAtMs).toISOString()}`);
  }
  console.log("[route-parity] required routes:");
  for (const route of requiredRoutes) {
    console.log(`  - ${route}`);
  }

  const nowMs = Date.now();
  const lineageFailures = [];
  let deploymentAgeHours = null;
  if (createdAtMs === null) {
    if (maxDeploymentAgeHours !== null || minCreatedAtMs !== null) {
      lineageFailures.push("created_at_unavailable");
    }
  } else {
    deploymentAgeHours = (nowMs - createdAtMs) / (60 * 60 * 1000);
    if (maxDeploymentAgeHours !== null && deploymentAgeHours > maxDeploymentAgeHours) {
      lineageFailures.push(
        `deployment_age_exceeds_limit(actual=${deploymentAgeHours.toFixed(2)}h limit=${maxDeploymentAgeHours}h)`
      );
    }
    if (minCreatedAtMs !== null && createdAtMs < minCreatedAtMs) {
      lineageFailures.push(
        `deployment_created_before_minimum(actual=${new Date(createdAtMs).toISOString()} minimum=${new Date(minCreatedAtMs).toISOString()})`
      );
    }
  }

  const summary = {
    target: args.baseUrl,
    resolved_deployment: resolvedDeploymentUrl || null,
    created_at: createdAt,
    created_at_epoch_ms: createdAtMs,
    deployment_age_hours: deploymentAgeHours,
    loaded_env_files: LOADED_ENV_FILES,
    route_entries_inspected: buildPaths.size,
    required_routes: requiredRoutes,
    missing_routes: missingRoutes,
    max_deployment_age_hours: maxDeploymentAgeHours,
    min_created_at_epoch_ms: minCreatedAtMs,
    lineage_failures: lineageFailures,
    pass: missingRoutes.length === 0 && lineageFailures.length === 0,
    checked_at: new Date().toISOString(),
  };

  if (args.output) {
    const outputPath = path.resolve(process.cwd(), args.output);
    fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    console.log(`[route-parity] artifact=${outputPath}`);
  }

  if (missingRoutes.length > 0) {
    console.error("[route-parity] FAIL: missing required routes:");
    for (const missingRoute of missingRoutes) {
      console.error(`  - ${missingRoute}`);
    }
    if (stderr?.trim()) {
      console.error(`[route-parity] vercel stderr: ${stderr.trim()}`);
    }
  }

  if (lineageFailures.length > 0) {
    console.error("[route-parity] FAIL: lineage gates:");
    for (const failure of lineageFailures) {
      console.error(`  - ${failure}`);
    }
  }

  if (!summary.pass) {
    process.exit(1);
  }

  console.log("[route-parity] PASS: required route parity verified.");
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[route-parity] ERROR: ${message}`);
  process.exit(1);
});
