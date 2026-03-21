#!/usr/bin/env node

/**
 * Runs staging OpenAI-lane audit checks across multiple routes and aggregates results.
 * Delegates per-route execution to scripts/audit_staging_agent_fallback_rates.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const SCRIPT_NAME = "audit_staging_openai_lane_bundle";
const DEFAULT_ROUTES = ["studio-agent", "generate-prompt"];
const DESCRIBE_ROUTE = "describe-image";
const ROUTE_PATHS = Object.freeze({
  "studio-agent": "/api/ai/studio-agent",
  "generate-prompt": "/api/ai/generate-prompt",
  "describe-image": "/api/ai/describe-image",
});

const nowIsoSafe = () => new Date().toISOString().replace(/[:.]/g, "-");

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) continue;
    const trimmedKey = key.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[trimmedKey] = "true";
      continue;
    }
    parsed[trimmedKey] = next;
    index += 1;
  }
  return parsed;
};

const printUsage = () => {
  console.log(`
${SCRIPT_NAME}

Usage:
  node scripts/${SCRIPT_NAME}.mjs \\
    --base-url <staging-url> \\
    [--include-describe-image] \\
    [--describe-image-url <public-image-url>] \\
    [--lineage-precheck] \\
    [--lineage-max-age-hours <hours>] \\
    [--lineage-min-created-at <instant>] \\
    [--vercel-token <token>] \\
    [--output <json-path>] \\
    [--help]

Notes:
  - Other audit flags are passed through to the per-route script.
  - By default this runs studio-agent + generate-prompt.
  - describe-image is included only when --include-describe-image=true
    or --describe-image-url is supplied.
  - lineage precheck verifies route parity + deployment age/freshness before lane runs.
`);
};

const buildPassThroughArgs = (rawArgs) => {
  const excludedKeys = new Set([
    "help",
    "output",
    "route",
    "include-describe-image",
    "describe-image-url",
    "lineage-precheck",
    "lineage-max-age-hours",
    "lineage-min-created-at",
    "vercel-token",
  ]);

  const argv = [];
  for (const [key, value] of Object.entries(rawArgs)) {
    if (excludedKeys.has(key)) continue;
    if (value === "true") {
      argv.push(`--${key}`);
      continue;
    }
    argv.push(`--${key}`, String(value));
  }
  return argv;
};

const resolveBaseUrl = (args) => {
  const candidate =
    String(
      args["base-url"] ??
        process.env.SHORTPULSE_STAGING_BASE_URL ??
        process.env.APP_BASE_URL ??
        ""
    ).trim();
  return candidate.replace(/\/+$/, "");
};

const resolveRoutes = (args) => {
  const includeDescribe =
    args["include-describe-image"] === "true" ||
    (typeof args["describe-image-url"] === "string" && args["describe-image-url"].trim().length > 0);

  if (!includeDescribe) return DEFAULT_ROUTES;

  const describeImageUrl = String(args["describe-image-url"] ?? "").trim();
  if (!describeImageUrl) {
    throw new Error(
      "describe-image lane requested but --describe-image-url is missing."
    );
  }

  return [...DEFAULT_ROUTES, DESCRIBE_ROUTE];
};

const parseArtifactPath = (stdoutText) => {
  const lines = String(stdoutText ?? "").split(/\r?\n/);
  for (const line of lines.reverse()) {
    const marker = "artifact=";
    const markerIndex = line.indexOf(marker);
    if (markerIndex === -1) continue;
    return line.slice(markerIndex + marker.length).trim();
  }
  return null;
};

const runLineagePrecheck = ({
  repoRoot,
  routes,
  baseUrl,
  args,
}) => {
  const verifyScriptPath = path.join(repoRoot, "scripts", "verify_deployment_route_parity.mjs");
  if (!fs.existsSync(verifyScriptPath)) {
    throw new Error(`Lineage precheck script not found: ${verifyScriptPath}`);
  }

  const token =
    String(
      args["vercel-token"] ??
        process.env.SHORTPULSE_VERCEL_API_TOKEN ??
        process.env.VERCEL_API_TOKEN ??
        ""
    ).trim();
  if (!token) {
    throw new Error(
      "Lineage precheck requires --vercel-token (or SHORTPULSE_VERCEL_API_TOKEN/VERCEL_API_TOKEN)."
    );
  }
  if (!baseUrl) {
    throw new Error(
      "Lineage precheck requires --base-url (or SHORTPULSE_STAGING_BASE_URL/APP_BASE_URL)."
    );
  }

  const outputPath = path.join(
    "/tmp",
    `${SCRIPT_NAME}-lineage-precheck-${Date.now()}-${nowIsoSafe()}.json`
  );
  const requiredRoutePaths = routes
    .map((route) => ROUTE_PATHS[route])
    .filter((routePath) => typeof routePath === "string" && routePath.length > 0);

  const commandArgs = [verifyScriptPath, "--base-url", baseUrl, "--token", token, "--output", outputPath];
  for (const routePath of requiredRoutePaths) {
    commandArgs.push("--required-route", routePath);
  }
  if (typeof args["lineage-max-age-hours"] === "string" && args["lineage-max-age-hours"].trim()) {
    commandArgs.push("--max-deployment-age-hours", args["lineage-max-age-hours"].trim());
  }
  if (typeof args["lineage-min-created-at"] === "string" && args["lineage-min-created-at"].trim()) {
    commandArgs.push("--min-created-at", args["lineage-min-created-at"].trim());
  }

  console.log(`[${SCRIPT_NAME}] running lineage precheck`);
  const startedAt = Date.now();
  const result = spawnSync(process.execPath, commandArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
  });
  const durationMs = Date.now() - startedAt;

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  const exitCode = typeof result.status === "number" ? result.status : 1;
  return {
    command: [process.execPath, ...commandArgs],
    duration_ms: durationMs,
    exit_code: exitCode,
    artifact: parseArtifactPath(result.stdout) ?? outputPath,
    pass: exitCode === 0,
  };
};

const main = () => {
  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: [".env.agent.local", "frontend/.env.local"],
  });

  const args = parseArgs();
  if (args.help === "true") {
    printUsage();
    return;
  }

  const repoRoot = process.cwd();
  const routeScriptPath = path.join(repoRoot, "scripts", "audit_staging_agent_fallback_rates.mjs");
  if (!fs.existsSync(routeScriptPath)) {
    throw new Error(`Route audit script not found: ${routeScriptPath}`);
  }

  const routes = resolveRoutes(args);
  const passThroughArgs = buildPassThroughArgs(args);
  const baseUrl = resolveBaseUrl(args);
  const describeImageUrl = String(args["describe-image-url"] ?? "").trim();
  const outputPath =
    args.output ?? path.join("/tmp", `${SCRIPT_NAME}-${Date.now()}-${nowIsoSafe()}.json`);
  const lineagePrecheckEnabled = args["lineage-precheck"] === "true";

  console.log(`[${SCRIPT_NAME}] routes=${routes.join(",")}`);
  console.log(
    `[${SCRIPT_NAME}] lineage_precheck=${lineagePrecheckEnabled ? "enabled" : "disabled"}`
  );
  const bundleStartedAt = Date.now();

  const runs = [];
  let anyFailed = false;
  let precheck = null;

  if (lineagePrecheckEnabled) {
    precheck = runLineagePrecheck({
      repoRoot,
      routes,
      baseUrl,
      args,
    });
    if (!precheck.pass) {
      anyFailed = true;
      console.error(`[${SCRIPT_NAME}] lineage precheck failed; skipping route audits.`);
    }
  }

  for (const route of anyFailed && lineagePrecheckEnabled ? [] : routes) {
    const routeArgs = [
      routeScriptPath,
      "--route",
      route,
      ...passThroughArgs,
    ];
    if (route === DESCRIBE_ROUTE) {
      routeArgs.push("--describe-image-url", describeImageUrl);
    }

    console.log(`[${SCRIPT_NAME}] running route=${route}`);
    const startedAt = Date.now();
    const result = spawnSync(process.execPath, routeArgs, {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    });
    const durationMs = Date.now() - startedAt;

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    const artifact = parseArtifactPath(result.stdout);
    const exitCode = typeof result.status === "number" ? result.status : 1;
    if (exitCode !== 0) anyFailed = true;

    runs.push({
      route,
      command: [process.execPath, ...routeArgs],
      exit_code: exitCode,
      duration_ms: durationMs,
      artifact,
    });
  }

  const bundleFinishedAt = Date.now();
  const summary = {
    run_id: `${SCRIPT_NAME}-${bundleStartedAt}`,
    started_at: new Date(bundleStartedAt).toISOString(),
    finished_at: new Date(bundleFinishedAt).toISOString(),
    duration_ms: bundleFinishedAt - bundleStartedAt,
    routes,
    route_count: routes.length,
    precheck,
    failed_routes: runs.filter((run) => run.exit_code !== 0).map((run) => run.route),
    pass: !anyFailed,
  };

  const artifact = { summary, runs };
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`[${SCRIPT_NAME}] aggregate_pass=${summary.pass}`);
  console.log(`[${SCRIPT_NAME}] artifact=${outputPath}`);

  if (anyFailed) {
    process.exitCode = 1;
  }
};

try {
  main();
} catch (error) {
  console.error(
    `[${SCRIPT_NAME}] failed: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
