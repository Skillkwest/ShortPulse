#!/usr/bin/env node

/**
 * Captures Phase 04 canary baseline evidence (latency + recovery snapshot).
 * Validates required env/args, runs existing protected-route latency probe,
 * and writes a secret-safe markdown artifact for phase-04 evidence.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_SAMPLES = 25;
const DEFAULT_WARMUP = 5;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_OUTPUT_DIR = "docs/planning/evidence/unified-buildout/phase-04";

const usage = () => {
  console.log(`Usage:
  node scripts/capture_phase04_canary_baseline.mjs [options]

Options:
  --base-url <url>        Base URL for staging/canary app.
                          Fallback env: SHORTPULSE_STAGING_BASE_URL, APP_BASE_URL
  --token <token>         Existing user bearer token for latency probe.
                          Fallback env: SHORTPULSE_STAGING_BEARER_TOKEN
  --bootstrap-token-from-supabase
                          Use capture_protected_route_latency bootstrap mode.
  --reconciler-secret <v> Reconciler secret for /api/internal/generation-recovery/run.
                          Fallback env: SHORTPULSE_FAL_RECONCILER_CRON_SECRET, CRON_SECRET
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
  if (missing.length > 0) {
    throw new Error(`Missing required inputs:\n- ${missing.join("\n- ")}`);
  }
};

const isoDate = () => new Date().toISOString().slice(0, 10);
const isoNow = () => new Date().toISOString();

const defaultOutputPath = () =>
  path.resolve(process.cwd(), DEFAULT_OUTPUT_DIR, `${isoDate()}-phase-04-canary-baseline-capture.md`);

const runLatencyProbe = (args) => {
  const commandArgs = [
    "scripts/capture_protected_route_latency.mjs",
    "--base-url",
    args.baseUrl,
    "--path",
    "/api/fal/queue-status",
    "--path",
    "/api/media/resolve-previews",
    "--samples",
    String(args.samples),
    "--warmup",
    String(args.warmup),
    "--timeout-ms",
    String(args.timeoutMs),
  ];
  if (args.bootstrapTokenFromSupabase) {
    commandArgs.push("--bootstrap-token-from-supabase");
  } else {
    commandArgs.push("--token", args.token);
  }

  const result = spawnSync("node", commandArgs, {
    encoding: "utf8",
    cwd: process.cwd(),
    env: process.env,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
};

const requestRecoverySnapshot = async ({ baseUrl, reconcilerSecret }) => {
  const response = await fetch(`${baseUrl}/api/internal/generation-recovery/run`, {
    method: "POST",
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
    rawBody,
    parsedBody,
  };
};

const sanitizeBaseUrl = (url) => {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
};

const toPrettyJson = (value) => JSON.stringify(value, null, 2);

const renderMarkdown = ({ args, latency, recovery }) => {
  const safeBaseUrl = sanitizeBaseUrl(args.baseUrl);
  const latencyCommand = args.bootstrapTokenFromSupabase
    ? [
        "node scripts/capture_protected_route_latency.mjs \\",
        `  --base-url "${safeBaseUrl}" \\`,
        "  --path /api/fal/queue-status \\",
        "  --path /api/media/resolve-previews \\",
        `  --samples ${args.samples} \\`,
        `  --warmup ${args.warmup} \\`,
        `  --timeout-ms ${args.timeoutMs} \\`,
        "  --bootstrap-token-from-supabase",
      ].join("\n")
    : [
        "node scripts/capture_protected_route_latency.mjs \\",
        `  --base-url "${safeBaseUrl}" \\`,
        '  --token "$SHORTPULSE_STAGING_BEARER_TOKEN" \\',
        "  --path /api/fal/queue-status \\",
        "  --path /api/media/resolve-previews \\",
        `  --samples ${args.samples} \\`,
        `  --warmup ${args.warmup} \\`,
        `  --timeout-ms ${args.timeoutMs}`,
      ].join("\n");

  const recoveryCommand = [
    "curl -sS -X POST \\",
    `  "${safeBaseUrl}/api/internal/generation-recovery/run" \\`,
    '  -H "Authorization: Bearer $SHORTPULSE_FAL_RECONCILER_CRON_SECRET" \\',
    '  -H "Content-Type: application/json"',
  ].join("\n");

  return `# Phase 04 Canary Baseline Capture (Automated)

Date (UTC): ${isoNow()}
Base URL: ${safeBaseUrl}
Mode: ${args.bootstrapTokenFromSupabase ? "bootstrap-token-from-supabase" : "existing-bearer-token"}

## Latency Probe Command
\`\`\`bash
${latencyCommand}
\`\`\`

## Latency Probe Output
Exit status: ${latency.status}

### stdout
\`\`\`text
${latency.stdout.trim() || "(empty)"}
\`\`\`

### stderr
\`\`\`text
${latency.stderr.trim() || "(empty)"}
\`\`\`

## Recovery Snapshot Command
\`\`\`bash
${recoveryCommand}
\`\`\`

## Recovery Snapshot Result
HTTP status: ${recovery.status}
Request success: ${recovery.ok}

### response (json)
\`\`\`json
${recovery.parsedBody ? toPrettyJson(recovery.parsedBody) : toPrettyJson({ raw: recovery.rawBody })}
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
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      usage();
      process.exit(0);
    }
    ensureRequired(args);

    const latency = runLatencyProbe(args);
    if (latency.status !== 0) {
      throw new Error(
        `Latency probe failed (exit ${latency.status}).\n${latency.stderr.trim() || latency.stdout.trim()}`
      );
    }

    const recovery = await requestRecoverySnapshot({
      baseUrl: args.baseUrl,
      reconcilerSecret: args.reconcilerSecret,
    });
    if (!recovery.ok) {
      throw new Error(
        `Recovery snapshot failed with status ${recovery.status}. Body: ${recovery.rawBody.slice(0, 400)}`
      );
    }

    const outputPath = path.resolve(process.cwd(), args.output || defaultOutputPath());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, renderMarkdown({ args, latency, recovery }), "utf8");

    console.log(`[phase04-canary-baseline] wrote ${outputPath}`);
  } catch (error) {
    console.error(`[phase04-canary-baseline] error=${error.message}`);
    process.exit(1);
  }
};

await main();
