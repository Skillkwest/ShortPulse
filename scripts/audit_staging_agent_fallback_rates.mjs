#!/usr/bin/env node

/**
 * Staging-only OpenAI-lane audit for AI Studio agent routes.
 * Sends safe synthetic turns, aggregates machine outcomes, and reports fallback_reason rates.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("../frontend/node_modules/@supabase/supabase-js");

const SCRIPT_NAME = "audit_staging_agent_fallback_rates";
const DEFAULT_ROUTE = "studio-agent";
const SUPPORTED_ROUTES = /** @type {const} */ ([
  "studio-agent",
  "generate-prompt",
  "describe-image",
]);

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
    [--route studio-agent|generate-prompt|describe-image] \\
    [--samples 60] \\
    [--concurrency 4] \\
    [--request-timeout-ms 20000] \\
    [--retry-count 0] \\
    [--max-fallback-rate 0.05] \\
    [--max-upstream-error-rate 0.02] \\
    [--max-non-200-rate 0.02] \\
    [--max-missing-machine-outcome-rate 0] \\
    [--require-contract-version 1] \\
    [--require-success-prompt] \\
    [--auto-user false] \\
    [--bearer-token <jwt>] \\
    [--email <user-email> --password <user-password>] \\
    [--supabase-url <url> --supabase-anon-key <anon-key>] \\
    [--prompt "<single prompt override>"] \\
    [--describe-image-url <public-image-url>] \\
    [--output <json-path>] \\
    [--vercel-bypass-token <token>] \\
    [--allow-local] \\
    [--dry-run]

Notes:
  - Production domains are blocked by default.
  - If --bearer-token is not provided, this script signs in via Supabase.
  - Auto temp-user auth is enabled by default (disable with --auto-user false).
  - Route defaults to studio-agent.
  - describe-image route requires --describe-image-url or STAGING_AUDIT_DESCRIBE_IMAGE_URL.
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

const resolveRoute = (rawRoute) => {
  const normalized = String(rawRoute ?? DEFAULT_ROUTE).trim().toLowerCase();
  if (SUPPORTED_ROUTES.includes(normalized)) return normalized;
  throw new Error(
    `Invalid --route value: ${rawRoute}. Expected one of: ${SUPPORTED_ROUTES.join(", ")}`
  );
};

const resolveRoutePath = (route) => {
  if (route === "studio-agent") return "/api/ai/studio-agent";
  if (route === "generate-prompt") return "/api/ai/generate-prompt";
  if (route === "describe-image") return "/api/ai/describe-image";
  throw new Error(`Unsupported route: ${route}`);
};

const resolveRouteContractHeaderSupport = (route) => route === "studio-agent";

const buildRoutePayload = ({ route, traceId, runId, requestIndex, prompt, describeImageUrl }) => {
  if (route === "studio-agent") {
    return {
      traceId,
      clientSessionKey: `${runId}-session`,
      messages: [{ role: "user", content: prompt }],
      context: {},
    };
  }
  if (route === "generate-prompt") {
    return { prompt };
  }
  if (route === "describe-image") {
    return { imageUrl: describeImageUrl };
  }
  throw new Error(`Unsupported route: ${route}`);
};

const resolveMessagePreview = (parsed) => {
  const previewCandidates = [
    typeof parsed?.message === "string" ? parsed.message : "",
    typeof parsed?.prompt === "string" ? parsed.prompt : "",
    typeof parsed?.description === "string" ? parsed.description : "",
    typeof parsed?.error === "string" ? parsed.error : "",
    typeof parsed?.detail === "string" ? parsed.detail : "",
    typeof parsed?.canonicalPrompt === "string" ? parsed.canonicalPrompt : "",
    typeof parsed?.actions?.applyPrompt === "string" ? parsed.actions.applyPrompt : "",
  ];
  const first = previewCandidates.find((value) => value.trim().length > 0) ?? "";
  return first.length > 0 ? first.slice(0, 120) : null;
};

const inferOutcomeClass = ({ route, status, parsed, explicitOutcomeClass }) => {
  if (typeof explicitOutcomeClass === "string" && explicitOutcomeClass.trim().length > 0) {
    return explicitOutcomeClass.trim();
  }
  if (status !== 200) return null;
  if (route === "studio-agent") {
    const message = typeof parsed?.message === "string" ? parsed.message.trim() : "";
    const canonicalPrompt =
      typeof parsed?.canonicalPrompt === "string" ? parsed.canonicalPrompt.trim() : "";
    const applyPrompt =
      typeof parsed?.actions?.applyPrompt === "string" ? parsed.actions.applyPrompt.trim() : "";
    if (message || canonicalPrompt || applyPrompt) return "success_prompt";
    return null;
  }
  if (route === "generate-prompt") {
    const nextPrompt = typeof parsed?.prompt === "string" ? parsed.prompt.trim() : "";
    if (nextPrompt) return "success_prompt";
    return null;
  }
  if (route === "describe-image") {
    const description = typeof parsed?.description === "string" ? parsed.description.trim() : "";
    if (description) return "success_prompt";
    return null;
  }
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
  route,
  baseUrl,
  routePath,
  bearerToken,
  vercelBypassToken,
  timeoutMs,
  requestIndex,
  prompts,
  describeImageUrl,
  runId,
  retryCount,
}) => {
  const prompt = prompts[requestIndex % prompts.length];
  const url = vercelBypassToken
    ? `${baseUrl}${routePath}?x-vercel-protection-bypass=${encodeURIComponent(vercelBypassToken)}`
    : `${baseUrl}${routePath}`;
  const traceId = `${runId}-req-${requestIndex}`;
  const payload = buildRoutePayload({
    route,
    traceId,
    runId,
    requestIndex,
    prompt,
    describeImageUrl,
  });

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

    const nestedMachineOutcome =
      parsed && typeof parsed.machine_outcome === "object" && parsed.machine_outcome
        ? parsed.machine_outcome
        : null;
    const explicitDecision =
      typeof parsed?.decision === "string"
        ? parsed.decision
        : typeof nestedMachineOutcome?.decision === "string"
          ? nestedMachineOutcome.decision
          : null;
    const explicitOutcomeClass =
      typeof parsed?.outcome_class === "string"
        ? parsed.outcome_class
        : typeof nestedMachineOutcome?.outcome_class === "string"
          ? nestedMachineOutcome.outcome_class
          : null;
    const explicitReasonCode =
      typeof parsed?.reason_code === "string"
        ? parsed.reason_code
        : typeof nestedMachineOutcome?.reason_code === "string"
          ? nestedMachineOutcome.reason_code
          : null;
    const explicitRetryable =
      typeof parsed?.retryable === "boolean"
        ? parsed.retryable
        : typeof nestedMachineOutcome?.retryable === "boolean"
          ? nestedMachineOutcome.retryable
          : null;

    const record = {
      request_index: requestIndex,
      attempt,
      route,
      path: routePath,
      prompt,
      ...(route === "describe-image" ? { image_url: describeImageUrl } : {}),
      status: response?.status ?? 0,
      contractVersion:
        response?.headers?.get("agent-contract-version") ??
        response?.headers?.get("x-agent-contract-version") ??
        null,
      decision: explicitDecision,
      outcomeClass: inferOutcomeClass({
        route,
        status: response?.status ?? 0,
        parsed,
        explicitOutcomeClass,
      }),
      reasonCode: explicitReasonCode,
      retryable: explicitRetryable,
      machine_outcome_present: explicitOutcomeClass !== null,
      fallbackReason:
        typeof parsed?.fallback_reason === "string"
          ? parsed.fallback_reason
          : typeof parsed?.fallbackReason === "string"
            ? parsed.fallbackReason
            : null,
      latency_ms: latencyMs,
      network_error: networkError,
      message_preview: resolveMessagePreview(parsed),
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
  const route = resolveRoute(args.route);
  const routePath = resolveRoutePath(route);
  const routeSupportsContractVersionHeader = resolveRouteContractHeaderSupport(route);
  const prompts = resolvePrompts({ prompt: args.prompt });
  const describeImageUrlRaw =
    args["describe-image-url"] ??
    process.env.STAGING_AUDIT_DESCRIBE_IMAGE_URL ??
    process.env.STAGING_AUDIT_IMAGE_URL;
  const describeImageUrl = String(describeImageUrlRaw ?? "").trim();
  if (route === "describe-image" && !describeImageUrl) {
    throw new Error(
      "Missing describe-image input URL. Provide --describe-image-url or STAGING_AUDIT_DESCRIBE_IMAGE_URL."
    );
  }
  const runId = `fallback-audit-${Date.now()}`;
  const autoUser = args["auto-user"] !== "false";
  const maxFallbackRate = parseRateArg(args["max-fallback-rate"]);
  const maxUpstreamErrorRate = parseRateArg(args["max-upstream-error-rate"]);
  const maxNon200Rate = parseRateArg(args["max-non-200-rate"]);
  const maxMissingMachineOutcomeRate = parseRateArg(args["max-missing-machine-outcome-rate"]);
  const requireContractVersion =
    typeof args["require-contract-version"] === "string"
      ? args["require-contract-version"].trim()
      : null;
  if (requireContractVersion && !routeSupportsContractVersionHeader) {
    throw new Error(
      `--require-contract-version is only supported for studio-agent route; received route=${route}.`
    );
  }
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
  console.log(`[${SCRIPT_NAME}] prompts=${prompts.length} route=${routePath} route_key=${route}`);
  if (route === "describe-image") {
    console.log(`[${SCRIPT_NAME}] describe_image_url=${describeImageUrl}`);
  }
  console.log(`[${SCRIPT_NAME}] auth_mode=${bearerToken ? "bearer_token" : autoUser ? "auto_user" : "email_password"}`);
  console.log(`[${SCRIPT_NAME}] vercel_bypass=${vercelBypassToken ? "enabled" : "disabled"}`);
  console.log(
    `[${SCRIPT_NAME}] thresholds fallback<=${maxFallbackRate ?? "off"} upstream_error<=${maxUpstreamErrorRate ?? "off"} non_200<=${maxNon200Rate ?? "off"} missing_machine_outcome<=${maxMissingMachineOutcomeRate ?? "off"} require_contract_version=${requireContractVersion || "off"} require_success_prompt=${requireSuccessPrompt}`
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
        route,
        routePath,
        bearerToken: token,
        vercelBypassToken,
        timeoutMs,
        requestIndex,
        prompts,
        describeImageUrl,
        runId,
        retryCount,
      }),
  });
  const durationMs = Date.now() - startedAt;

  const outcomeBuckets = bucketBy(records, (record) => classifyOutcome(record));
  const outcomeClassBuckets = bucketBy(records, (record) => record.outcomeClass ?? "none");
  const fallbackReasonBuckets = bucketBy(records, (record) => record.fallbackReason ?? "none");
  const contractVersionBuckets = bucketBy(records, (record) => record.contractVersion ?? "none");
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
  const contractVersionMismatchCount = requireContractVersion
    ? records.filter((record) => (record.contractVersion ?? "") !== requireContractVersion).length
    : 0;
  const avgLatencyMs = total
    ? Math.round(records.reduce((sum, record) => sum + record.latency_ms, 0) / total)
    : 0;

  const summary = {
    run_id: runId,
    base_url: baseUrl,
    route,
    path: routePath,
    started_at: new Date(startedAt).toISOString(),
    finished_at: new Date().toISOString(),
    duration_ms: durationMs,
    samples: total,
    concurrency,
    request_timeout_ms: timeoutMs,
    retry_count: retryCount,
    prompts: route === "describe-image" ? [] : prompts,
    describe_image_url: route === "describe-image" ? describeImageUrl : null,
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
    contract_version_mismatch_count: contractVersionMismatchCount,
    contract_version_mismatch_rate: total ? contractVersionMismatchCount / total : 0,
    buckets: {
      outcome: mapToSortedObject(outcomeBuckets),
      outcome_class: mapToSortedObject(outcomeClassBuckets),
      fallback_reason: mapToSortedObject(fallbackReasonBuckets),
      contract_version: mapToSortedObject(contractVersionBuckets),
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
  if (requireContractVersion) {
    checks.push({
      name: "contract_version_mismatch_rate",
      threshold: 0,
      actual: summary.contract_version_mismatch_rate,
      pass: summary.contract_version_mismatch_rate === 0,
      expected: requireContractVersion,
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
