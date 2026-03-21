#!/usr/bin/env node

/**
 * Runs staging OpenAI-lane audit checks across multiple routes and aggregates results.
 * Delegates per-route execution to scripts/audit_staging_agent_fallback_rates.mjs.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const SCRIPT_NAME = "audit_staging_openai_lane_bundle";
const DEFAULT_ROUTES = ["studio-agent", "generate-prompt"];
const DESCRIBE_ROUTE = "describe-image";

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
    [--output <json-path>] \\
    [--help]

Notes:
  - Other audit flags are passed through to the per-route script.
  - By default this runs studio-agent + generate-prompt.
  - describe-image is included only when --include-describe-image=true
    or --describe-image-url is supplied.
`);
};

const buildPassThroughArgs = (rawArgs) => {
  const excludedKeys = new Set([
    "help",
    "output",
    "route",
    "include-describe-image",
    "describe-image-url",
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

const main = () => {
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
  const describeImageUrl = String(args["describe-image-url"] ?? "").trim();
  const outputPath =
    args.output ?? path.join("/tmp", `${SCRIPT_NAME}-${Date.now()}-${nowIsoSafe()}.json`);

  console.log(`[${SCRIPT_NAME}] routes=${routes.join(",")}`);
  const bundleStartedAt = Date.now();

  const runs = [];
  let anyFailed = false;

  for (const route of routes) {
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
