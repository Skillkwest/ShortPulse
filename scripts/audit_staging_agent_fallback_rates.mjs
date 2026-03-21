#!/usr/bin/env node

/**
 * Staging-only fallback-rate audit for /api/ai/studio-agent.
 * Sends safe prompt turns, aggregates machine outcomes, and reports fallback_reason rates.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("../frontend/node_modules/@supabase/supabase-js");

const SCRIPT_NAME = "audit_staging_agent_fallback_rates";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DEFAULT_PROMPTS = [
  "cinematic portrait, soft window light, shallow depth of field",
  "wide-angle city street at dusk, wet pavement reflections, high detail",
  "fashion editorial photo, neutral backdrop, crisp studio lighting",
  "landscape scene with distant mountains and volumetric morning fog",
];

const DEFAULT_SAMPLES = 60;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_TIMEOUT_MS = 20000;
const DEFAULT_RETRIES = 0;
const DEFAULT_BASE_URL = process.env.SHORTPULSE_STAGING_BASE_URL ?? "";

const nowIsoSafe = () => new Date().toISOString().replace(/[:.]/g, "-");

const parseIntArg = (value, fallback, min = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
};

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
    [--samples 60] \\
    [--concurrency 4] \\
    [--request-timeout-ms 20000] \\
    [--retry-count 0] \\
    [--bearer-token <jwt>] \\
    [--email <user-email> --password <user-password>] \\
    [--supabase-url <url> --supabase-anon-key <anon-key>] \\
    [--prompt "<single prompt override>"] \\
    [--output <json-path>] \\
    [--vercel-bypass-token <token>] \\
    [--allow-local] \\
    [--dry-run]

Notes:
  - Production domains are blocked by default.
  - If --bearer-token is not provided, this script signs in via Supabase email/password.
  - Env loading defaults: .env.agent.local, frontend/.env.local (non-overriding).
`);
};

const resolveBaseUrl = (rawBaseUrl) => {
  const normalized = String(rawBaseUrl ?? "").trim().replace(/\/+$/, "");
  if (!normalized) {
    throw new Error("Missing --base-url (or SHORTPULSE_STAGING_BASE_URL).");
  }
  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`Invalid --base-url: ${normalized}`);
  }
  return { normalized, url };
};

const assertStagingGuard = ({ url, allowLocal }) => {
  const host = url.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
  if (isLocal && !allowLocal) {
    throw new Error("Local host blocked by default. Re-run with --allow-local for local testing.");
  }
  if (host === "shortpulse.ai" || host === "www.shortpulse.ai") {
    throw new Error("Production host blocked. This audit script is staging-only.");
  }
};

const resolvePrompts = ({ prompt }) => {
  const trimmed = typeof prompt === "string" ? prompt.trim() : "";
  if (trimmed.length > 0) return [trimmed];
  return DEFAULT_PROMPTS;
};

const resolveToken = async ({
  bearerToken,
  email,
  password,
  supabaseUrl,
  supabaseAnonKey,
}) => {
  if (typeof bearerToken === "string" && bearerToken.trim().length > 0) {
    return bearerToken.trim();
  }

  const normalizedEmail = String(email ?? "").trim();
  const normalizedPassword = String(password ?? "").trim();
  if (!normalizedEmail || !normalizedPassword) {
    throw new Error(
      "Missing auth credentials. Provide --bearer-token or (--email and --password)."
    );
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase credentials. Provide --supabase-url and --supabase-anon-key (or env vars)."
    );
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: normalizedEmail,
    password: normalizedPassword,
  });
  if (error || !data?.session?.access_token) {
    throw new Error(`Supabase sign-in failed: ${error?.message ?? "missing session"}`);
  }
  return data.session.access_token;
};

const bucketBy = (items, keyBuilder) => {
  const result = new Map();
  for (const item of items) {
    const key = keyBuilder(item);
    result.set(key, (result.get(key) ?? 0) + 1);
  }
  return result;
};

const mapToSortedObject = (map) => {
  return Object.fromEntries([...map.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
};

const classifyOutcome = (record) => {
  if (record.status !== 200) return "http_error";
  if (record.outcomeClass === "fallback_infra") return "fallback";
  if (record.outcomeClass === "upstream_error") return "upstream_error";
  if (record.outcomeClass === "route_error") return "route_error";
  if (record.outcomeClass === "refusal_safety" || record.outcomeClass === "refusal_model") {
    return "refusal";
  }
  if (record.outcomeClass === "success_prompt") return "success";
  return "unknown";
};

const requestOne = async ({
  baseUrl,
  routePath,
  bearerToken,
  vercelBypassToken,
  timeoutMs,
  requestIndex,
  prompts,
  runId,
  retryCount,
}) => {
  const prompt = prompts[requestIndex % prompts.length];
  const url = vercelBypassToken
    ? `${baseUrl}${routePath}?x-vercel-protection-bypass=${encodeURIComponent(vercelBypassToken)}`
    : `${baseUrl}${routePath}`;
  const traceId = `${runId}-req-${requestIndex}`;
  const payload = {
    traceId,
    clientSessionKey: `${runId}-session`,
    messages: [{ role: "user", content: prompt }],
    context: {},
  };

  let attempt = 0;
  let lastRecord = null;
  while (attempt <= retryCount) {
    attempt += 1;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let rawBody = "";
    let networkError = null;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bearerToken}`,
          "x-shortpulse-request-id": traceId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      rawBody = await response.text();
    } catch (error) {
      networkError = error instanceof Error ? error.message : String(error);
    } finally {
      clearTimeout(timeoutId);
    }

    const latencyMs = Date.now() - startedAt;
    let parsed = null;
    if (rawBody) {
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        parsed = null;
      }
    }

    const record = {
      request_index: requestIndex,
      attempt,
      route: "studio-agent",
      path: routePath,
      prompt,
      status: response?.status ?? 0,
      decision: typeof parsed?.decision === "string" ? parsed.decision : null,
      outcomeClass: typeof parsed?.outcome_class === "string" ? parsed.outcome_class : null,
      reasonCode: typeof parsed?.reason_code === "string" ? parsed.reason_code : null,
      retryable: typeof parsed?.retryable === "boolean" ? parsed.retryable : null,
      fallbackReason: typeof parsed?.fallback_reason === "string" ? parsed.fallback_reason : null,
      latency_ms: latencyMs,
      network_error: networkError,
      message_preview: typeof parsed?.message === "string" ? parsed.message.slice(0, 120) : null,
      raw_preview: parsed ? null : rawBody.slice(0, 120),
      timestamp: new Date().toISOString(),
    };

    lastRecord = record;
    if (networkError || response?.status !== 200) {
      if (attempt <= retryCount) continue;
    }
    return record;
  }

  return lastRecord;
};

const runWithConcurrency = async ({ total, concurrency, worker }) => {
  const records = new Array(total);
  let cursor = 0;
  const takeNext = () => {
    const next = cursor;
    cursor += 1;
    return next < total ? next : null;
  };

  const runners = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
    for (;;) {
      const index = takeNext();
      if (index === null) break;
      records[index] = await worker(index);
    }
  });

  await Promise.all(runners);
  return records;
};

const main = async () => {
  loadLocalEnv({
    argv: process.argv.slice(2),
    defaultPaths: [".env.agent.local", "frontend/.env.local"],
  });

  const args = parseArgs();
  if (args.help === "true") {
    printUsage();
    return;
  }

  const { normalized: baseUrl, url } = resolveBaseUrl(args["base-url"] ?? DEFAULT_BASE_URL);
  const allowLocal = args["allow-local"] === "true";
  assertStagingGuard({ url, allowLocal });

  const samples = parseIntArg(args.samples, DEFAULT_SAMPLES);
  const concurrency = parseIntArg(args.concurrency, DEFAULT_CONCURRENCY);
  const timeoutMs = parseIntArg(args["request-timeout-ms"], DEFAULT_TIMEOUT_MS, 1000);
  const retryCount = parseIntArg(args["retry-count"], DEFAULT_RETRIES, 0);
  const routePath = "/api/ai/studio-agent";
  const prompts = resolvePrompts({ prompt: args.prompt });
  const runId = `fallback-audit-${Date.now()}`;
  const outputPath =
    args.output ??
    path.join("/tmp", `${SCRIPT_NAME}-${runId}-${nowIsoSafe()}.json`);

  const supabaseUrl = args["supabase-url"] ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseAnonKey =
    args["supabase-anon-key"] ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const email = args.email ?? process.env.STAGING_AUDIT_EMAIL ?? "";
  const password = args.password ?? process.env.STAGING_AUDIT_PASSWORD ?? "";
  const bearerToken = args["bearer-token"] ?? process.env.STAGING_AUDIT_BEARER_TOKEN ?? "";
  const vercelBypassToken =
    args["vercel-bypass-token"] ?? process.env.SHORTPULSE_VERCEL_PROTECTION_BYPASS ?? "";

  console.log(`[${SCRIPT_NAME}] base_url=${baseUrl}`);
  console.log(
    `[${SCRIPT_NAME}] samples=${samples} concurrency=${concurrency} timeout_ms=${timeoutMs} retry_count=${retryCount}`
  );
  console.log(`[${SCRIPT_NAME}] prompts=${prompts.length} route=${routePath}`);
  console.log(`[${SCRIPT_NAME}] output=${outputPath}`);

  if (args["dry-run"] === "true") {
    console.log(`[${SCRIPT_NAME}] dry-run complete (no network calls).`);
    return;
  }

  const token = await resolveToken({
    bearerToken,
    email,
    password,
    supabaseUrl,
    supabaseAnonKey,
  });

  const startedAt = Date.now();
  const records = await runWithConcurrency({
    total: samples,
    concurrency,
    worker: async (requestIndex) =>
      await requestOne({
        baseUrl,
        routePath,
        bearerToken: token,
        vercelBypassToken,
        timeoutMs,
        requestIndex,
        prompts,
        runId,
        retryCount,
      }),
  });
  const durationMs = Date.now() - startedAt;

  const outcomeBuckets = bucketBy(records, (record) => classifyOutcome(record));
  const outcomeClassBuckets = bucketBy(records, (record) => record.outcomeClass ?? "none");
  const fallbackReasonBuckets = bucketBy(records, (record) => record.fallbackReason ?? "none");
  const routePathFallbackBuckets = bucketBy(
    records,
    (record) => `${record.route}|${record.path}|${record.fallbackReason ?? "none"}`
  );

  const total = records.length;
  const fallbackCount = records.filter((record) => record.outcomeClass === "fallback_infra").length;
  const upstreamErrorCount = records.filter(
    (record) => record.outcomeClass === "upstream_error"
  ).length;
  const non200Count = records.filter((record) => record.status !== 200).length;
  const networkErrorCount = records.filter((record) => Boolean(record.network_error)).length;
  const avgLatencyMs = total
    ? Math.round(records.reduce((sum, record) => sum + record.latency_ms, 0) / total)
    : 0;

  const summary = {
    run_id: runId,
    base_url: baseUrl,
    route: "studio-agent",
    path: routePath,
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: durationMs,
    samples: total,
    concurrency,
    request_timeout_ms: timeoutMs,
    retry_count: retryCount,
    prompts,
    avg_latency_ms: avgLatencyMs,
    fallback_count: fallbackCount,
    fallback_rate: total ? fallbackCount / total : 0,
    upstream_error_count: upstreamErrorCount,
    upstream_error_rate: total ? upstreamErrorCount / total : 0,
    non_200_count: non200Count,
    non_200_rate: total ? non200Count / total : 0,
    network_error_count: networkErrorCount,
    buckets: {
      outcome: mapToSortedObject(outcomeBuckets),
      outcome_class: mapToSortedObject(outcomeClassBuckets),
      fallback_reason: mapToSortedObject(fallbackReasonBuckets),
      route_path_fallback_reason: mapToSortedObject(routePathFallbackBuckets),
    },
  };

  const artifact = { summary, records };
  fs.writeFileSync(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

  console.log(`[${SCRIPT_NAME}] completed in ${durationMs}ms`);
  console.log(
    `[${SCRIPT_NAME}] fallback_rate=${(summary.fallback_rate * 100).toFixed(2)}% (${fallbackCount}/${total})`
  );
  console.log(
    `[${SCRIPT_NAME}] upstream_error_rate=${(summary.upstream_error_rate * 100).toFixed(2)}% (${upstreamErrorCount}/${total})`
  );
  console.log(
    `[${SCRIPT_NAME}] non_200_rate=${(summary.non_200_rate * 100).toFixed(2)}% (${non200Count}/${total})`
  );
  console.log(`[${SCRIPT_NAME}] artifact=${outputPath}`);
};

main().catch((error) => {
  console.error(`[${SCRIPT_NAME}] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
