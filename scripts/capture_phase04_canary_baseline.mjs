#!/usr/bin/env node

/**
 * Captures Phase 04 canary baseline evidence (latency + recovery snapshot).
 * Uses method-correct route probes:
 * - GET /api/fal/queue-status
 * - POST /api/media/resolve-previews (empty ids payload)
 */

import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_SAMPLES = 25;
const DEFAULT_WARMUP = 5;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_OUTPUT_DIR = "docs/planning/evidence/unified-buildout/phase-04";
const DEFAULT_TEMP_EMAIL_PREFIX = "phase04_latency_probe";

const PROBES = [
  {
    key: "fal_queue_status",
    method: "GET",
    path: "/api/fal/queue-status",
    body: null,
  },
  {
    key: "media_resolve_previews",
    method: "POST",
    path: "/api/media/resolve-previews",
    body: { ids: [], expiresInSeconds: 60 },
  },
];

const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [".env.agent.local", "frontend/.env.local"],
});

const usage = () => {
  console.log(`Usage:
  node scripts/capture_phase04_canary_baseline.mjs [options]

Options:
  --base-url <url>        Base URL for staging/canary app.
                          Fallback env: SHORTPULSE_STAGING_BASE_URL, APP_BASE_URL
  --env-file <path>       Optional env file path (repeatable). When omitted, this script
                          auto-loads ".env.agent.local" and "frontend/.env.local" if present.
  --token <token>         Existing user bearer token for route probes.
                          Fallback env: SHORTPULSE_STAGING_BEARER_TOKEN
  --bootstrap-token-from-supabase
                          Create a temporary confirmed user via Supabase auth and use its bearer token.
                          Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
  --reconciler-secret <v> Reconciler secret for /api/internal/generation-recovery/run.
                          Fallback env: SHORTPULSE_FAL_RECONCILER_CRON_SECRET, CRON_SECRET
  --temp-email-prefix <v> Prefix for temporary bootstrap user email.
                          Default: ${DEFAULT_TEMP_EMAIL_PREFIX}
  --samples <n>           Measured request count per route. Default: ${DEFAULT_SAMPLES}
  --warmup <n>            Warmup request count per route. Default: ${DEFAULT_WARMUP}
  --timeout-ms <n>        Per-request timeout. Default: ${DEFAULT_TIMEOUT_MS}
  --output <file>         Output markdown file path. Default: ${DEFAULT_OUTPUT_DIR}/<date>-phase-04-canary-baseline-capture.md
  --help                  Show this message.
`);
};

const parseInteger = (value, fallback, label) => {
  if (value === undefined) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
};

const readArgValue = (argv, index, label) => {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${label} requires a value`);
  }
  return value;
};

const parseArgs = (argv) => {
  const parsed = {
    baseUrl:
      process.env.SHORTPULSE_STAGING_BASE_URL?.trim() ?? process.env.APP_BASE_URL?.trim() ?? "",
    token: process.env.SHORTPULSE_STAGING_BEARER_TOKEN?.trim() ?? "",
    bootstrapTokenFromSupabase: false,
    reconcilerSecret:
      process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET?.trim() ??
      process.env.CRON_SECRET?.trim() ??
      "",
    tempEmailPrefix: DEFAULT_TEMP_EMAIL_PREFIX,
    samples: DEFAULT_SAMPLES,
    warmup: DEFAULT_WARMUP,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    output: "",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = readArgValue(argv, i, "--base-url").trim();
      i += 1;
      continue;
    }
    if (arg === "--env-file") {
      readArgValue(argv, i, "--env-file");
      i += 1;
      continue;
    }
    if (arg === "--token") {
      parsed.token = readArgValue(argv, i, "--token").trim();
      i += 1;
      continue;
    }
    if (arg === "--bootstrap-token-from-supabase") {
      parsed.bootstrapTokenFromSupabase = true;
      continue;
    }
    if (arg === "--reconciler-secret") {
      parsed.reconcilerSecret = readArgValue(argv, i, "--reconciler-secret").trim();
      i += 1;
      continue;
    }
    if (arg === "--temp-email-prefix") {
      parsed.tempEmailPrefix = readArgValue(argv, i, "--temp-email-prefix").trim();
      i += 1;
      continue;
    }
    if (arg === "--samples") {
      parsed.samples = parseInteger(readArgValue(argv, i, "--samples"), DEFAULT_SAMPLES, "samples");
      i += 1;
      continue;
    }
    if (arg === "--warmup") {
      parsed.warmup = parseInteger(readArgValue(argv, i, "--warmup"), DEFAULT_WARMUP, "warmup");
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = parseInteger(
        readArgValue(argv, i, "--timeout-ms"),
        DEFAULT_TIMEOUT_MS,
        "timeout-ms"
      );
      i += 1;
      continue;
    }
    if (arg === "--output") {
      parsed.output = readArgValue(argv, i, "--output").trim();
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.baseUrl = parsed.baseUrl.replace(/\/+$/, "");
  return parsed;
};

const ensureRequired = (args) => {
  const missing = [];
  if (!args.baseUrl) {
    missing.push("SHORTPULSE_STAGING_BASE_URL or APP_BASE_URL (or --base-url)");
  }
  if (!args.bootstrapTokenFromSupabase && !args.token) {
    missing.push("SHORTPULSE_STAGING_BEARER_TOKEN (or --token) when not bootstrapping");
  }
  if (!args.reconcilerSecret) {
    missing.push("SHORTPULSE_FAL_RECONCILER_CRON_SECRET or CRON_SECRET (or --reconciler-secret)");
  }
  if (args.bootstrapTokenFromSupabase) {
    const supabaseMissing = [
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
    ].filter((key) => !(process.env[key] ?? "").trim());
    if (supabaseMissing.length > 0) {
      missing.push(`bootstrap mode requires env: ${supabaseMissing.join(", ")}`);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Missing required inputs:\n- ${missing.join("\n- ")}`);
  }

  if (args.baseUrl.includes(".supabase.co")) {
    throw new Error(
      "Invalid --base-url: this helper targets ShortPulse app API routes. Use your app deployment URL, not the Supabase API URL."
    );
  }
};

const isoDate = () => new Date().toISOString().slice(0, 10);
const isoNow = () => new Date().toISOString();
const defaultOutputPath = () =>
  path.resolve(process.cwd(), DEFAULT_OUTPUT_DIR, `${isoDate()}-phase-04-canary-baseline-capture.md`);

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.min(Math.max(index, 0), sorted.length - 1);
  return sorted[clamped];
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

const randomSuffix = () =>
  `${Date.now()}_${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0")}`;

const deleteBootstrapUser = async ({ supabaseUrl, serviceRoleKey, userId }) => {
  try {
    await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
      method: "DELETE",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });
  } catch {
    // Best effort cleanup.
  }
};

const createBootstrapToken = async ({ emailPrefix }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  const suffix = randomSuffix();
  const email = `${emailPrefix}_${suffix}@example.com`;
  const password = `P4!${suffix}aA1`;

  const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });
  if (!createResponse.ok) {
    throw new Error(`Supabase user bootstrap failed with status ${createResponse.status}`);
  }

  const createdUser = await createResponse.json();
  const userId = typeof createdUser?.id === "string" ? createdUser.id : "";
  if (!userId) {
    throw new Error("Supabase user bootstrap failed: missing user id.");
  }

  const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });
  if (!loginResponse.ok) {
    await deleteBootstrapUser({ supabaseUrl, serviceRoleKey, userId });
    throw new Error(`Supabase token bootstrap failed with status ${loginResponse.status}`);
  }

  const loginData = await loginResponse.json();
  const token = typeof loginData?.access_token === "string" ? loginData.access_token : "";
  if (!token) {
    await deleteBootstrapUser({ supabaseUrl, serviceRoleKey, userId });
    throw new Error("Supabase token bootstrap failed: missing access_token.");
  }

  return {
    token,
    cleanup: () => deleteBootstrapUser({ supabaseUrl, serviceRoleKey, userId }),
  };
};

const requestRoute = async ({ baseUrl, method, routePath, token, body, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(`${baseUrl}${routePath}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body === null ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const elapsedMs = performance.now() - start;
    await response.arrayBuffer();
    return {
      elapsedMs,
      status: response.status,
      ok: response.ok,
    };
  } catch {
    const elapsedMs = performance.now() - start;
    return {
      elapsedMs,
      status: 0,
      ok: false,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const runRouteProbe = async ({ baseUrl, probe, token, warmup, samples, timeoutMs }) => {
  for (let index = 0; index < warmup; index += 1) {
    await requestRoute({
      baseUrl,
      method: probe.method,
      routePath: probe.path,
      token,
      body: probe.body,
      timeoutMs,
    });
  }

  const elapsed = [];
  const statuses = [];
  let successCount = 0;
  for (let index = 0; index < samples; index += 1) {
    const result = await requestRoute({
      baseUrl,
      method: probe.method,
      routePath: probe.path,
      token,
      body: probe.body,
      timeoutMs,
    });
    elapsed.push(result.elapsedMs);
    statuses.push(result.status);
    if (result.ok) successCount += 1;
  }

  return {
    key: probe.key,
    method: probe.method,
    path: probe.path,
    samples,
    successCount,
    successRate: samples > 0 ? (successCount / samples) * 100 : 0,
    min: Math.min(...elapsed),
    p50: percentile(elapsed, 50),
    p95: percentile(elapsed, 95),
    max: Math.max(...elapsed),
    statusesSummary: summarizeStatuses(statuses),
  };
};

const requestRecoverySnapshot = async ({ baseUrl, reconcilerSecret }) => {
  const attempt = async (method) => {
    const response = await fetch(`${baseUrl}/api/internal/generation-recovery/run`, {
      method,
      headers: {
        Authorization: `Bearer ${reconcilerSecret}`,
        "Content-Type": "application/json",
      },
    });
    const rawBody = await response.text();
    let parsedBody = null;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      parsedBody = null;
    }
    return {
      ok: response.ok,
      status: response.status,
      method,
      rawBody,
      parsedBody,
    };
  };

  const post = await attempt("POST");
  if (post.status === 405) {
    return attempt("GET");
  }
  return post;
};

const sanitizeBaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
};

const renderMarkdown = ({ args, summaries, recovery }) => {
  const safeBaseUrl = sanitizeBaseUrl(args.baseUrl);
  const summaryLines = summaries
    .map(
      (summary) =>
        `- ${summary.method} ${summary.path}: p50=${summary.p50.toFixed(2)}ms p95=${summary.p95.toFixed(
          2
        )}ms min=${summary.min.toFixed(2)}ms max=${summary.max.toFixed(
          2
        )}ms success_rate=${summary.successRate.toFixed(1)}% statuses=${summary.statusesSummary}`
    )
    .join("\n");

  return `# Phase 04 Canary Baseline Capture (Automated)

Date (UTC): ${isoNow()}
Base URL: ${safeBaseUrl}
Mode: ${args.bootstrapTokenFromSupabase ? "bootstrap-token-from-supabase" : "existing-bearer-token"}

## Route Probe Summary
${summaryLines}

## Recovery Snapshot
Method used: ${recovery.method}
HTTP status: ${recovery.status}
Request success: ${recovery.ok}

\`\`\`json
${JSON.stringify(recovery.parsedBody ?? { raw: recovery.rawBody }, null, 2)}
\`\`\`

## Follow-Up
1. Copy baseline values into:
   - \`docs/planning/evidence/unified-buildout/phase-04/2026-02-27-fal-queue-status-read-only-canary-execution-log-template.md\`
2. Flip:
   - \`SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED=false\`
3. Run two observation windows and finalize \`promote|hold|rollback\`.
`;
};

const main = async () => {
  let bootstrapCleanup = null;
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      usage();
      process.exit(0);
    }
    if (LOADED_ENV_FILES.length > 0) {
      console.log(`[phase04-canary-baseline] loaded env files: ${LOADED_ENV_FILES.join(", ")}`);
    }
    ensureRequired(args);

    let token = args.token;
    if (args.bootstrapTokenFromSupabase) {
      const bootstrap = await createBootstrapToken({ emailPrefix: args.tempEmailPrefix });
      token = bootstrap.token;
      bootstrapCleanup = bootstrap.cleanup;
    }

    const summaries = [];
    for (const probe of PROBES) {
      summaries.push(
        await runRouteProbe({
          baseUrl: args.baseUrl,
          probe,
          token,
          warmup: args.warmup,
          samples: args.samples,
          timeoutMs: args.timeoutMs,
        })
      );
    }

    for (const summary of summaries) {
      if (summary.successCount === 0) {
        throw new Error(
          `Probe ${summary.method} ${summary.path} produced zero successful responses. statuses=${summary.statusesSummary}`
        );
      }
    }

    const recovery = await requestRecoverySnapshot({
      baseUrl: args.baseUrl,
      reconcilerSecret: args.reconcilerSecret,
    });
    if (!recovery.ok) {
      throw new Error(
        `Recovery snapshot failed with status ${recovery.status} (method=${recovery.method}). Body: ${recovery.rawBody.slice(
          0,
          400
        )}`
      );
    }

    const outputPath = path.resolve(process.cwd(), args.output || defaultOutputPath());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, renderMarkdown({ args, summaries, recovery }), "utf8");
    console.log(`[phase04-canary-baseline] wrote ${outputPath}`);
  } catch (error) {
    console.error(`[phase04-canary-baseline] error=${error.message}`);
    process.exit(1);
  } finally {
    if (bootstrapCleanup) {
      await bootstrapCleanup();
    }
  }
};

await main();
