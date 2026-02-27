#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_PATH = "/api/billing/credit-packages";
const DEFAULT_SAMPLES = 30;
const DEFAULT_WARMUP = 5;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_TEMP_EMAIL_PREFIX = "latency_probe";
const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [".env.agent.local", "frontend/.env.local"],
});

const printUsage = () => {
  console.log(`Usage:
  node scripts/capture_protected_route_latency.mjs [options]

Options:
  --base-url <url>        Staging/deployed app base URL.
                          Fallback env: SHORTPULSE_STAGING_BASE_URL, APP_BASE_URL
  --env-file <path>       Optional env file path (repeatable). When omitted, this script
                          auto-loads ".env.agent.local" and "frontend/.env.local" if present.
  --token <token>         Bearer token for a real authenticated user.
                          Fallback env: SHORTPULSE_STAGING_BEARER_TOKEN
  --bootstrap-token-from-supabase
                          Create a short-lived confirmed user via Supabase admin API,
                          sign in to obtain a bearer token, then auto-delete the user.
                          Requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
                          and SUPABASE_SERVICE_ROLE_KEY.
  --temp-email-prefix <v> Prefix used for bootstrap temp-user email.
                          Default: ${DEFAULT_TEMP_EMAIL_PREFIX}
  --path <route>          Protected route path (repeatable). Default: ${DEFAULT_PATH}
  --samples <n>           Measured request count per route. Default: ${DEFAULT_SAMPLES}
  --warmup <n>            Warmup request count per route. Default: ${DEFAULT_WARMUP}
  --timeout-ms <n>        Per-request timeout in ms. Default: ${DEFAULT_TIMEOUT_MS}
  --help                  Show this message.
`);
};

const parseIntegerOption = (raw, fallback, label) => {
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${raw}`);
  }
  return parsed;
};

const percentile = (values, p) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  const clamped = Math.min(Math.max(idx, 0), sorted.length - 1);
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

const createBootstrapToken = async ({ emailPrefix }) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase env for token bootstrap. Require NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  const suffix = randomSuffix();
  const email = `${emailPrefix}_${suffix}@example.com`;
  const password = `Lp!${suffix}aA1`;

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
    throw new Error(
      `Supabase user bootstrap failed with status ${createResponse.status}`
    );
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
    userId,
    cleanup: () => deleteBootstrapUser({ supabaseUrl, serviceRoleKey, userId }),
  };
};

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
    // Best-effort cleanup. Caller keeps flow non-fatal.
  }
};

const makeRequest = async ({ url, token, timeoutMs }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "x-shortpulse-latency-probe": "true",
      },
      signal: controller.signal,
    });
    const elapsedMs = performance.now() - start;
    // Drain body to avoid socket reuse skew in subsequent requests.
    await response.arrayBuffer();
    return {
      elapsedMs,
      ok: response.ok,
      status: response.status,
    };
  } finally {
    clearTimeout(timeout);
  }
};

const parseArgs = (argv) => {
  const parsed = {
    paths: [],
    baseUrl: process.env.SHORTPULSE_STAGING_BASE_URL?.trim() ?? "",
    token: process.env.SHORTPULSE_STAGING_BEARER_TOKEN?.trim() ?? "",
    samples: DEFAULT_SAMPLES,
    warmup: DEFAULT_WARMUP,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    bootstrapTokenFromSupabase: false,
    tempEmailPrefix: DEFAULT_TEMP_EMAIL_PREFIX,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--base-url") {
      parsed.baseUrl = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--env-file") {
      if (!(argv[i + 1] ?? "").trim()) throw new Error("--env-file requires a value");
      i += 1;
      continue;
    }
    if (arg === "--token") {
      parsed.token = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (arg === "--path") {
      const path = argv[i + 1];
      if (!path) throw new Error("--path requires a value");
      parsed.paths.push(path);
      i += 1;
      continue;
    }
    if (arg === "--bootstrap-token-from-supabase") {
      parsed.bootstrapTokenFromSupabase = true;
      continue;
    }
    if (arg === "--temp-email-prefix") {
      const prefix = argv[i + 1];
      if (!prefix) throw new Error("--temp-email-prefix requires a value");
      parsed.tempEmailPrefix = prefix.trim();
      i += 1;
      continue;
    }
    if (arg === "--samples") {
      parsed.samples = parseIntegerOption(argv[i + 1], DEFAULT_SAMPLES, "samples");
      i += 1;
      continue;
    }
    if (arg === "--warmup") {
      parsed.warmup = parseIntegerOption(argv[i + 1], DEFAULT_WARMUP, "warmup");
      i += 1;
      continue;
    }
    if (arg === "--timeout-ms") {
      parsed.timeoutMs = parseIntegerOption(argv[i + 1], DEFAULT_TIMEOUT_MS, "timeout-ms");
      i += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (parsed.paths.length === 0) {
    parsed.paths = [DEFAULT_PATH];
  }
  return parsed;
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }
  if (LOADED_ENV_FILES.length > 0) {
    console.log(`[auth-staging-latency] loaded env files: ${LOADED_ENV_FILES.join(", ")}`);
  }

  const baseUrl = args.baseUrl.replace(/\/+$/, "");
  const defaultBaseUrl = process.env.APP_BASE_URL?.trim() ?? "";
  const resolvedBaseUrl = (baseUrl || defaultBaseUrl).replace(/\/+$/, "");
  let token = args.token;
  let cleanupBootstrapUser = null;
  if (!resolvedBaseUrl) {
    throw new Error(
      "Missing base URL. Provide --base-url or SHORTPULSE_STAGING_BASE_URL or APP_BASE_URL."
    );
  }
  if (resolvedBaseUrl.includes(".supabase.co")) {
    throw new Error(
      "Invalid base URL: this probe targets ShortPulse app routes. Use your app deployment URL, not the Supabase API URL."
    );
  }
  if (!token && args.bootstrapTokenFromSupabase) {
    const bootstrapResult = await createBootstrapToken({
      emailPrefix: args.tempEmailPrefix || DEFAULT_TEMP_EMAIL_PREFIX,
    });
    token = bootstrapResult.token;
    cleanupBootstrapUser = bootstrapResult.cleanup;
    console.log("[auth-staging-latency] token_source=supabase_bootstrap");
  }
  if (!token) {
    throw new Error(
      "Missing bearer token. Provide --token/SHORTPULSE_STAGING_BEARER_TOKEN or use --bootstrap-token-from-supabase."
    );
  }

  try {
    console.log(
      `[auth-staging-latency] start base_url=${resolvedBaseUrl} routes=${args.paths.join(",")} samples=${args.samples} warmup=${args.warmup} timeout_ms=${args.timeoutMs}`
    );

    for (const path of args.paths) {
      const normalizedPath = path.startsWith("/") ? path : `/${path}`;
      const url = `${resolvedBaseUrl}${normalizedPath}`;

      for (let i = 0; i < args.warmup; i += 1) {
        await makeRequest({ url, token, timeoutMs: args.timeoutMs });
      }

      const durations = [];
      const statuses = [];
      let okCount = 0;
      for (let i = 0; i < args.samples; i += 1) {
        const result = await makeRequest({ url, token, timeoutMs: args.timeoutMs });
        durations.push(result.elapsedMs);
        statuses.push(result.status);
        if (result.ok) okCount += 1;
      }

      const p50 = percentile(durations, 50);
      const p95 = percentile(durations, 95);
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const statusSummary = summarizeStatuses(statuses);
      const successRate = (okCount / args.samples) * 100;

      console.log(
        `[auth-staging-latency] route=${normalizedPath} p50=${p50.toFixed(
          2
        )}ms p95=${p95.toFixed(2)}ms min=${min.toFixed(2)}ms max=${max.toFixed(
          2
        )}ms success_rate=${successRate.toFixed(1)}% statuses=${statusSummary}`
      );
    }
  } finally {
    if (cleanupBootstrapUser) {
      await cleanupBootstrapUser();
      console.log("[auth-staging-latency] supabase_bootstrap_user_deleted=true");
    }
  }
};

main().catch((error) => {
  console.error(`[auth-staging-latency] error=${error?.message ?? String(error)}`);
  process.exit(1);
});
