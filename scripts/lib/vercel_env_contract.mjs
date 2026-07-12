#!/usr/bin/env node

/**
 * Canonical ShortPulse environment-variable contract for local tooling and Vercel audits.
 * The contract is intentionally conservative: it enforces high-risk target/scope rules now
 * and can be extended incrementally as more keys are formally classified.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_DIR, "../..");

export const VERCEL_ENVIRONMENTS = ["development", "preview", "production"];
export const DEFAULT_VERCEL_AUDIT_ENVIRONMENTS = [
  "preview",
  "production",
];
export const SHORTPULSE_PRODUCTION_APP_ORIGIN = "https://www.shortpulse.ai";

const LOOPBACK_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "0.0.0.0",
]);

export const REQUIRED_VERCEL_KEYS_BY_ENVIRONMENT = Object.freeze({
  development: [],
  preview: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FAL_KEY",
    "APP_BASE_URL",
    "SHORTPULSE_ADMIN_EMAILS",
  ],
  production: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FAL_KEY",
    "APP_BASE_URL",
    "SHORTPULSE_ADMIN_EMAILS",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_BILLING_PORTAL_FULL_PRICE_UPGRADE_CONFIG_ID",
    "ELEVENLABS_API_KEY",
  ],
});

export const FILE_PROFILE_REQUIRED_KEYS = Object.freeze({
  core: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FAL_KEY",
    "SHORTPULSE_ADMIN_EMAILS",
    "APP_BASE_URL",
  ],
  phase04: [
    "SHORTPULSE_FAL_RECONCILER_ENABLED",
    "SHORTPULSE_FAL_RECONCILER_CRON_SECRET",
  ],
});

export const PREVIEW_PRODUCTION_MUST_DIFFER_KEYS = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "SHORTPULSE_PUBLIC_API_BASE_URL",
]);

export const DEVELOPMENT_PREVIEW_MUST_DIFFER_KEYS = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "SHORTPULSE_PUBLIC_API_BASE_URL",
]);

export const TARGET_SCOPED_VERCEL_KEYS = Object.freeze([
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_BASE_URL",
  "SHORTPULSE_PUBLIC_API_BASE_URL",
]);

export const LOCAL_OR_TOOLING_ONLY_KEYS = new Set([
  "SHORTPULSE_STAGING_BASE_URL",
  "SHORTPULSE_STAGING_BEARER_TOKEN",
  "SHORTPULSE_API_BASE_URL",
  "SHORTPULSE_VERCEL_API_TOKEN",
  "SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN",
  "VERCEL_API_TOKEN",
  "VERCEL_AUTOMATION_BYPASS_TOKEN",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_MANAGEMENT_API_TOKEN",
  "PLAYWRIGHT_AUDIT_EMAIL",
  "PLAYWRIGHT_AUDIT_PASSWORD",
  "PLAYWRIGHT_BASE_URL",
  "AI_STUDIO_PERF_PORT",
  "AI_STUDIO_PERF_SKIP_BUILD",
  "SHORTPULSE_MODEL_CATALOG_MAX_STALE_DAYS",
  "SHORTPULSE_MODEL_CATALOG_STALE_MODE",
  "ARCHITECTURE_BOUNDARY_MODE",
  "REFERENCE_GRID_BOUNDARY_MODE",
  "REFERENCE_GRID_SIZE_BUDGET_MODE",
]);

export const MIRRORED_FLAG_PAIRS = Object.freeze([
  [
    "SHORTPULSE_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS",
    "NEXT_PUBLIC_MEDIA_ALLOW_EXTERNAL_DIRECT_PREVIEWS",
  ],
  ["SHORTPULSE_MEDIA_LIST_API_ENABLED", "NEXT_PUBLIC_MEDIA_LIST_API_ENABLED"],
  [
    "SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED",
    "NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED",
  ],
]);

export const MUST_RESOLVE_FALSE_VERCEL_KEYS = Object.freeze([
  "SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED",
  "NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED",
]);

export const PRODUCTION_MUST_NOT_RESOLVE_TRUE_VERCEL_KEYS = Object.freeze([]);

const MUST_RESOLVE_FALSE_REASONS = Object.freeze({
  SHORTPULSE_MEDIA_SIGNED_TRANSFORMS_ENABLED:
    "Supabase image transformations are prohibited",
  NEXT_PUBLIC_MEDIA_SIGNED_TRANSFORMS_ENABLED:
    "Supabase image transformations are prohibited",
});

const PRODUCTION_MUST_NOT_RESOLVE_TRUE_REASONS = Object.freeze({});

export const SENSITIVE_PRESENCE_ONLY_KEYS = new Set([
  "FAL_KEY",
  "ELEVENLABS_API_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
]);

const FRONTEND_ENV_EXAMPLE_PATH = path.join(
  REPO_ROOT,
  "frontend",
  ".env.example",
);
const AGENT_ENV_EXAMPLE_PATH = path.join(REPO_ROOT, ".env.agent.local.example");

const stripWrappingQuotes = (value) => {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;

  const normalized = trimmed.startsWith("export ")
    ? trimmed.slice("export ".length)
    : trimmed;
  const eqIndex = normalized.indexOf("=");
  if (eqIndex <= 0) return null;

  const key = normalized.slice(0, eqIndex).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) return null;

  return {
    key,
    value: stripWrappingQuotes(normalized.slice(eqIndex + 1)),
  };
};

/**
 * Parses a simple dotenv-compatible file into a map.
 * @param {string} filePath
 * @returns {Map<string, string>}
 */
export const parseEnvFileToMap = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf8");
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    map.set(parsed.key, parsed.value);
  }
  return map;
};

const readTemplateKeys = (filePath) =>
  new Set(parseEnvFileToMap(filePath).keys());

const FRONTEND_ENV_EXAMPLE_KEYS = readTemplateKeys(FRONTEND_ENV_EXAMPLE_PATH);
const AGENT_ENV_EXAMPLE_KEYS = readTemplateKeys(AGENT_ENV_EXAMPLE_PATH);

export const KNOWN_FRONTEND_ENV_EXAMPLE_KEYS = new Set(
  FRONTEND_ENV_EXAMPLE_KEYS,
);
export const KNOWN_AGENT_ENV_EXAMPLE_KEYS = new Set(AGENT_ENV_EXAMPLE_KEYS);

export const KNOWN_VERCEL_KEYS = new Set(
  [...FRONTEND_ENV_EXAMPLE_KEYS].filter(
    (key) => !LOCAL_OR_TOOLING_ONLY_KEYS.has(key),
  ),
);

/**
 * Returns the required keys for a specific Vercel environment.
 * @param {"development" | "preview" | "production"} environment
 * @returns {string[]}
 */
export const getRequiredVercelKeysForEnvironment = (environment) => {
  if (!(environment in REQUIRED_VERCEL_KEYS_BY_ENVIRONMENT)) {
    throw new Error(`Unknown Vercel environment: ${environment}`);
  }
  return [...REQUIRED_VERCEL_KEYS_BY_ENVIRONMENT[environment]];
};

/**
 * Returns the required keys for a file-validation profile.
 * @param {"core" | "phase04"} profile
 * @returns {string[]}
 */
export const getFileProfileRequiredKeys = (profile) => {
  if (!(profile in FILE_PROFILE_REQUIRED_KEYS)) {
    throw new Error(`Unknown env-file profile: ${profile}`);
  }
  return [...FILE_PROFILE_REQUIRED_KEYS[profile]];
};

/**
 * Returns whether a key is expected to be present in Vercel project envs.
 * @param {string} key
 * @returns {boolean}
 */
export const isKnownVercelKey = (key) => KNOWN_VERCEL_KEYS.has(key);

/**
 * Returns whether a key is intentionally local/tooling-only and should stay out of Vercel.
 * @param {string} key
 * @returns {boolean}
 */
export const isLocalOrToolingOnlyKey = (key) =>
  LOCAL_OR_TOOLING_ONLY_KEYS.has(key);

const isLoopbackHostname = (hostname) =>
  LOOPBACK_HOSTNAMES.has(String(hostname).toLowerCase());

export const validatePublicOriginPair = ({
  appBaseUrl,
  publicApiBaseUrl,
  environment,
}) => {
  if (!appBaseUrl || !publicApiBaseUrl) {
    return [];
  }

  let normalizedAppBaseUrl;
  let normalizedPublicApiBaseUrl;
  try {
    normalizedAppBaseUrl = new URL(appBaseUrl).origin;
  } catch {
    return [];
  }
  try {
    normalizedPublicApiBaseUrl = new URL(publicApiBaseUrl).origin;
  } catch {
    return [];
  }

  if (normalizedAppBaseUrl === normalizedPublicApiBaseUrl) {
    return [];
  }

  const scope = environment ? ` for ${environment}` : "";
  return [
    `APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL must match${scope} when both are configured.`,
  ];
};

export const validateDeployedPublicOrigin = ({ environment, key, value }) => {
  if (
    (key !== "APP_BASE_URL" && key !== "SHORTPULSE_PUBLIC_API_BASE_URL") ||
    !value
  ) {
    return [];
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    return [`${key} must be a valid URL for ${environment}.`];
  }

  const errors = [];
  if (
    (environment === "preview" || environment === "production") &&
    parsedUrl.protocol !== "https:"
  ) {
    errors.push(`${key} must be an https URL for ${environment}.`);
  }
  if (
    (environment === "preview" || environment === "production") &&
    isLoopbackHostname(parsedUrl.hostname)
  ) {
    errors.push(`${key} must not use a loopback host for ${environment}.`);
  }
  if (
    environment === "production" &&
    parsedUrl.origin !== SHORTPULSE_PRODUCTION_APP_ORIGIN
  ) {
    errors.push(
      `${key} must resolve to ${SHORTPULSE_PRODUCTION_APP_ORIGIN} for production.`,
    );
  }
  if (
    environment === "preview" &&
    parsedUrl.origin === SHORTPULSE_PRODUCTION_APP_ORIGIN
  ) {
    errors.push(
      `${key} must not resolve to ${SHORTPULSE_PRODUCTION_APP_ORIGIN} for preview.`,
    );
  }
  return errors;
};

export const validateGuardedVercelFlag = ({ environment, key, value }) => {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!normalizedValue) return [];

  const mustResolveFalseReason = MUST_RESOLVE_FALSE_REASONS[key];
  if (mustResolveFalseReason && normalizedValue !== "false") {
    return [`${key} must resolve to false because ${mustResolveFalseReason}.`];
  }

  const productionMustNotResolveTrueReason =
    PRODUCTION_MUST_NOT_RESOLVE_TRUE_REASONS[key];
  if (
    environment === "production" &&
    productionMustNotResolveTrueReason &&
    normalizedValue === "true"
  ) {
    return [
      `${key} must not resolve to true in production because ${productionMustNotResolveTrueReason}.`,
    ];
  }

  return [];
};
