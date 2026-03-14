#!/usr/bin/env node

/**
 * Verifies that a deployment behind a target URL/alias exposes required internal routes.
 * Hard-fails when any required route is missing from Vercel inspect build output.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const execFileAsync = promisify(execFile);

const DEFAULT_REQUIRED_ROUTES = [
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
                          - ${DEFAULT_REQUIRED_ROUTES[0]}
                          - ${DEFAULT_REQUIRED_ROUTES[1]}
  --token <token>         Vercel API token.
                          Fallback env: SHORTPULSE_VERCEL_API_TOKEN, VERCEL_API_TOKEN
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

const ensureRequiredInputs = ({ baseUrl, token, requiredRoutes }) => {
  const missing = [];
  if (!baseUrl) {
    missing.push("SHORTPULSE_STAGING_BASE_URL or APP_BASE_URL (or --base-url)");
  }
  if (!token) {
    missing.push("SHORTPULSE_VERCEL_API_TOKEN or VERCEL_API_TOKEN (or --token)");
  }
  const normalized = requiredRoutes.map((route) => normalizePathLike(route)).filter(Boolean);
  if (normalized.length === 0) {
    missing.push("at least one valid --required-route value");
  }
  if (missing.length > 0) {
    throw new Error(`Missing required inputs:\n- ${missing.join("\n- ")}`);
  }
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

  const inspectArgs = ["inspect", args.baseUrl, "--format=json", "--token", args.token];
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
  const createdAt = asIsoTimestamp(
    inspectResult?.createdAt ?? inspectResult?.meta?.createdAt ?? inspectResult?.created
  );

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
  console.log(`[route-parity] loaded env files: ${LOADED_ENV_FILES.length}`);
  console.log(`[route-parity] route entries inspected: ${buildPaths.size}`);
  console.log("[route-parity] required routes:");
  for (const route of requiredRoutes) {
    console.log(`  - ${route}`);
  }

  if (missingRoutes.length > 0) {
    console.error("[route-parity] FAIL: missing required routes:");
    for (const missingRoute of missingRoutes) {
      console.error(`  - ${missingRoute}`);
    }
    if (stderr?.trim()) {
      console.error(`[route-parity] vercel stderr: ${stderr.trim()}`);
    }
    process.exit(1);
  }

  console.log("[route-parity] PASS: required route parity verified.");
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[route-parity] ERROR: ${message}`);
  process.exit(1);
});
