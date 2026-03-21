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

const nowIsoSafe = () => new Date().toISOString().replace(/[:.]/g, "-");

const parseIntArg = (value, fallback, min = 1) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
};

const parseRateArg = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value).trim();
  if (!raw.length) return null;
  const normalized = raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
  if (!Number.isFinite(normalized) || normalized < 0) {
    throw new Error(`Invalid rate value: ${value}`);
  }
  return normalized > 1 ? normalized / 100 : normalized;
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
    [--max-fallback-rate 0.05] \\
    [--max-upstream-error-rate 0.02] \\
    [--max-non-200-rate 0.02] \\
    [--max-missing-machine-outcome-rate 0] \\
    [--require-success-prompt] \\
    [--auto-user false] \\
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
  - If --bearer-token is not provided, this script signs in via Supabase.
  - Auto temp-user auth is enabled by default (disable with --auto-user false).
  - Env loading defaults: .env.agent.local, frontend/.env.local (non-overriding).
  - Rates can be provided as decimals (0.05) or percentages (5%).
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

const inferOutcomeClass = ({ status, parsed, explicitOutcomeClass }) => {
  if (typeof explicitOutcomeClass === "string" && explicitOutcomeClass.trim().length > 0) {
    return explicitOutcomeClass.trim();
  }
  if (status !== 200) return null;
  const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";
  const canonicalPrompt =
    typeof parsed?.canonicalPrompt === "string" ? parsed.canonicalPrompt.trim() : "";
  const applyPrompt =
    typeof parsed?.actions?.applyPrompt === "string" ? parsed.actions.applyPrompt.trim() : "";
  if (message || canonicalPrompt || applyPrompt) return "success_prompt";
  return null;
};

const resolveToken = async ({
  bearerToken,
  email,
  password,
  supabaseUrl,
  supabaseAnonKey,
  autoUser,
  runId,
}) => {
  if (typeof bearerToken === "string" && bearerToken.trim().length > 0) {
    return bearerToken.trim();
  }

  const normalizedEmail = String(email ?? "").trim();
  const normalizedPassword = String(password ?? "").trim();
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase credentials. Provide --supabase-url and --supabase-anon-key (or env vars)."
    );
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (normalizedEmail && normalizedPassword) {
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password: normalizedPassword,
    });
    if (error || !data?.session?.access_token) {
      throw new Error(`Supabase sign-in failed: ${error?.message ?? "missing session"}`);
    }
    return data.session.access_token;
  }

  if (!autoUser) {
    throw new Error(
      "Missing auth credentials. Provide --bearer-token or (--email and --password), or enable --auto-user."
    );
  }

  const tempEmail = `agent.audit.${runId}.${Date.now()}@shortpulse.test`;
  const tempPassword = `Sp!${Math.random().toString(36).slice(2)}${Date.now()}`;

  const signUp = await client.auth.signUp({
    email: tempEmail,
    password: tempPassword,
  });
  if (signUp.data?.session?.access_token) {
    return signUp.data.session.access_token;
  }

  let lastError = signUp.error?.message ?? "auth_session_missing";
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const signIn = await client.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword,
    });
    if (!signIn.error && signIn.data?.session?.access_token) {
      return signIn.data.session.access_token;
    }
    lastError = signIn.error?.message ?? lastError;
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }

  throw new Error(`Temp-user auth failed: ${lastError}`);
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
      outcomeClass: inferOutcomeClass({
        status: response?.status ?? 0,
        parsed,
        explicitOutcomeClass:
          typeof parsed?.outcome_class === "string" ? parsed.outcome_class : null,
      }),
      reasonCode: typeof parsed?.reason_code === "string" ? parsed.reason_code : null,
      retryable: typeof parsed?.retryable === "boolean" ? parsed.retryable : null,
      machine_outcome_present: typeof parsed?.outcome_class === "string",
      fallbackReason:
        typeof parsed?.fallback_reason === "string"
          ? parsed.fallback_reason
          : typeof parsed?.fallbackReason === "string"
            ? parsed.fallbackReason
            : null,
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

  const defaultBaseUrl =
    process.env.SHORTPULSE_STAGING_BASE_URL?.trim() ??
    process.env.APP_BASE_URL?.trim() ??
    "";
  const { normalized: baseUrl, url } = resolveBaseUrl(args["base-url"] ?? defaultBaseUrl);
  const allowLocal = args["allow-local"] === "true";
  assertStagingGuard({ url, allowLocal });

  const samples = parseIntArg(args.samples, DEFAULT_SAMPLES);
  const concurrency = parseIntArg(args.concurrency, DEFAULT_CONCURRENCY);
  const timeoutMs = parseIntArg(args["request-timeout-ms"], DEFAULT_TIMEOUT_MS, 1000);
  const retryCount = parseIntArg(args["retry-count"], DEFAULT_RETRIES, 0);
  const routePath = "/api/ai/studio-agent";
  const prompts = resolvePrompts({ prompt: args.prompt });
  const runId = `fallback-audit-${Date.now()}`;
  const autoUser = args["auto-user"] !== "false";
  const maxFallbackRate = parseRateArg(args["max-fallback-rate"]);
  const maxUpstreamErrorRate = parseRateArg(args["max-upstream-error-rate"]);
  const maxNon200Rate = parseRateArg(args["max-non-200-rate"]);
  const maxMissingMachineOutcomeRate = parseRateArg(args["max-missing-machine-outcome-rate"]);
  const requireSuccessPrompt = args["require-success-prompt"] === "true";
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
    args["vercel-bypass-token"] ??
    process.env.SHORTPULSE_VERCEL_PROTECTION_BYPASS ??
    process.env.SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN ??
    process.env.VERCEL_AUTOMATION_BYPASS_TOKEN ??
    "";

  console.log(`[${SCRIPT_NAME}] base_url=${baseUrl}`);
  console.log(
    `[${SCRIPT_NAME}] samples=${samples} concurrency=${concurrency} timeout_ms=${timeoutMs} retry_count=${retryCount}`
  );
  console.log(`[${SCRIPT_NAME}] prompts=${prompts.length} route=${routePath}`);
  console.log(`[${SCRIPT_NAME}] auth_mode=${bearerToken ? "bearer_token" : autoUser ? "auto_user" : "email_password"}`);
  console.log(`[${SCRIPT_NAME}] vercel_bypass=${vercelBypassToken ? "enabled" : "disabled"}`);
  console.log(
    `[${SCRIPT_NAME}] thresholds fallback<=${maxFallbackRate ?? "off"} upstream_error<=${maxUpstreamErrorRate ?? "off"} non_200<=${maxNon200Rate ?? "off"} missing_machine_outcome<=${maxMissingMachineOutcomeRate ?? "off"} require_success_prompt=${requireSuccessPrompt}`
  );
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
    autoUser,
    runId,
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
  const missingMachineOutcomeCount = records.filter(
    (record) => !record.machine_outcome_present
  ).length;
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
    missing_machine_outcome_count: missingMachineOutcomeCount,
    missing_machine_outcome_rate: total ? missingMachineOutcomeCount / total : 0,
    buckets: {
      outcome: mapToSortedObject(outcomeBuckets),
      outcome_class: mapToSortedObject(outcomeClassBuckets),
      fallback_reason: mapToSortedObject(fallbackReasonBuckets),
      route_path_fallback_reason: mapToSortedObject(routePathFallbackBuckets),
    },
  };

  const checks = [];
  if (maxFallbackRate !== null) {
    checks.push({
      name: "fallback_rate",
      threshold: maxFallbackRate,
      actual: summary.fallback_rate,
      pass: summary.fallback_rate <= maxFallbackRate,
    });
  }
  if (maxUpstreamErrorRate !== null) {
    checks.push({
      name: "upstream_error_rate",
      threshold: maxUpstreamErrorRate,
      actual: summary.upstream_error_rate,
      pass: summary.upstream_error_rate <= maxUpstreamErrorRate,
    });
  }
  if (maxNon200Rate !== null) {
    checks.push({
      name: "non_200_rate",
      threshold: maxNon200Rate,
      actual: summary.non_200_rate,
      pass: summary.non_200_rate <= maxNon200Rate,
    });
  }
  if (maxMissingMachineOutcomeRate !== null) {
    checks.push({
      name: "missing_machine_outcome_rate",
      threshold: maxMissingMachineOutcomeRate,
      actual: summary.missing_machine_outcome_rate,
      pass: summary.missing_machine_outcome_rate <= maxMissingMachineOutcomeRate,
    });
  }
  if (requireSuccessPrompt) {
    const nonSuccessPromptCount = records.filter(
      (record) => record.outcomeClass !== "success_prompt"
    ).length;
    checks.push({
      name: "require_success_prompt",
      threshold: 0,
      actual: nonSuccessPromptCount,
      pass: nonSuccessPromptCount === 0,
    });
  }

  const gate = {
    enabled: checks.length > 0,
    pass: checks.every((check) => check.pass),
    checks,
  };
  summary.gate = gate;

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
  if (gate.enabled) {
    for (const check of gate.checks) {
      console.log(
        `[${SCRIPT_NAME}] gate ${check.name}: actual=${check.actual} threshold=${check.threshold} pass=${check.pass}`
      );
    }
    console.log(`[${SCRIPT_NAME}] gate_result=${gate.pass ? "PASS" : "FAIL"}`);
  }
  console.log(`[${SCRIPT_NAME}] artifact=${outputPath}`);

  if (gate.enabled && !gate.pass) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error(`[${SCRIPT_NAME}] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
