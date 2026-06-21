#!/usr/bin/env node

/**
 * Verifies and optionally enables production Supabase Google OAuth through the
 * Management API without printing tokens, client secrets, or raw auth config.
 */

import process from "node:process";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_ENV_FILES = [
  ".env.agent.local",
  ".env.local",
  "frontend/.env.local",
];
const MANAGEMENT_API_BASE_URL = "https://api.supabase.com";
const DEFAULT_PRODUCTION_CALLBACK_URL =
  "https://www.shortpulse.ai/auth/callback";

const usage = () => {
  console.log(`Usage:
  node scripts/configure_supabase_google_auth.mjs --project-ref <ref> [options]

Options:
  --environment <name>                 Label for output. Default: production.
  --project-ref <ref>                  Supabase project ref to inspect.
  --expected-redirect-url <url>        Required allowlisted callback URL.
                                       Default: ${DEFAULT_PRODUCTION_CALLBACK_URL}
  --no-require-disable-signup          Report only if public signup is enabled.
  --apply-enable-google                PATCH Google provider enabled + credentials.
  --confirm-enable-google <ref>        Required with --apply-enable-google; must match project ref.
  --apply-redirect-url                 PATCH additional_redirect_urls if the expected URL is missing.
  --env-file <path>                    Optional env file path (repeatable).
  --help                               Show this message.

Required env:
  SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_API_TOKEN

Required env when applying Google:
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID or GOOGLE_OAUTH_CLIENT_ID
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET or GOOGLE_OAUTH_CLIENT_SECRET

Optional project-ref fallback:
  SHORTPULSE_PRODUCTION_SUPABASE_PROJECT_REF or SHORTPULSE_PRODUCTION_PROJECT_REF
`);
};

const argValue = (argv, index, flag) => {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
};

const parseArgs = (argv) => {
  const parsed = {
    environment: "production",
    projectRef: "",
    expectedRedirectUrl: DEFAULT_PRODUCTION_CALLBACK_URL,
    requireDisableSignup: true,
    applyEnableGoogle: false,
    confirmEnableGoogle: "",
    applyRedirectUrl: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--environment") {
      parsed.environment = argValue(argv, index, "--environment")
        .trim()
        .toLowerCase();
      index += 1;
      continue;
    }
    if (arg === "--project-ref") {
      parsed.projectRef = argValue(argv, index, "--project-ref").trim();
      index += 1;
      continue;
    }
    if (arg === "--expected-redirect-url") {
      parsed.expectedRedirectUrl = argValue(
        argv,
        index,
        "--expected-redirect-url",
      ).trim();
      index += 1;
      continue;
    }
    if (arg === "--no-require-disable-signup") {
      parsed.requireDisableSignup = false;
      continue;
    }
    if (arg === "--apply-enable-google") {
      parsed.applyEnableGoogle = true;
      continue;
    }
    if (arg === "--confirm-enable-google") {
      parsed.confirmEnableGoogle = argValue(
        argv,
        index,
        "--confirm-enable-google",
      ).trim();
      index += 1;
      continue;
    }
    if (arg === "--apply-redirect-url") {
      parsed.applyRedirectUrl = true;
      continue;
    }
    if (arg === "--env-file") {
      argValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  return parsed;
};

const normalizeProjectRef = (value) => {
  const normalized = String(value ?? "").trim();
  if (!/^[a-z0-9]{20}$/.test(normalized)) {
    throw new Error("A valid Supabase project ref is required.");
  }
  return normalized;
};

const normalizeUrl = (value, label) => {
  const normalized = String(value ?? "").trim();
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== "https:") {
      throw new Error(`${label} must use https.`);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch (error) {
    if (error instanceof Error && error.message.includes("must use https")) {
      throw error;
    }
    throw new Error(`${label} must be a valid absolute URL.`);
  }
};

const readManagementToken = () => {
  const token =
    process.env.SUPABASE_ACCESS_TOKEN?.trim() ||
    process.env.SUPABASE_MANAGEMENT_API_TOKEN?.trim() ||
    "";
  if (!token) {
    throw new Error(
      "Missing Supabase Management API token. Set SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_API_TOKEN.",
    );
  }
  return token;
};

const readGoogleCredentials = () => {
  const clientId =
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ||
    "";
  const clientSecret =
    process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET?.trim() ||
    process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    "";
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Google OAuth credentials. Set SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID and SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET, or GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
};

const authConfigUrl = (projectRef) =>
  `${MANAGEMENT_API_BASE_URL}/v1/projects/${encodeURIComponent(projectRef)}/config/auth`;

const fetchAuthConfig = async ({ projectRef, token }) => {
  const response = await fetch(authConfigUrl(projectRef), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Auth config read failed (${response.status}).`);
  }
  return payload;
};

const patchAuthConfig = async ({ projectRef, token, patch }) => {
  const response = await fetch(authConfigUrl(projectRef), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    throw new Error(`Auth config update failed (${response.status}).`);
  }
};

const readRedirectUrls = (config) =>
  Array.isArray(config?.additional_redirect_urls)
    ? config.additional_redirect_urls.filter(
        (value) => typeof value === "string",
      )
    : [];

const hasRedirectUrl = (config, expectedRedirectUrl) =>
  readRedirectUrls(config).some(
    (value) => value.replace(/\/$/, "") === expectedRedirectUrl,
  );

const summarizeConfig = (config, expectedRedirectUrl) => ({
  disableSignup: config?.disable_signup === true,
  googleEnabled: config?.external_google_enabled === true,
  googleClientIdPresent:
    typeof config?.external_google_client_id === "string" &&
    config.external_google_client_id.trim().length > 0,
  googleSecretPresent:
    typeof config?.external_google_secret === "string" &&
    config.external_google_secret.trim().length > 0,
  expectedRedirectPresent: hasRedirectUrl(config, expectedRedirectUrl),
  redirectUrlCount: readRedirectUrls(config).length,
});

const logSummary = (environment, summary) => {
  console.log(
    `${environment} Supabase Auth: signup=${summary.disableSignup ? "disabled" : "enabled"}, google=${summary.googleEnabled ? "enabled" : "disabled"}, google_client_id=${summary.googleClientIdPresent ? "present" : "missing"}, google_secret=${summary.googleSecretPresent ? "present" : "missing"}, expected_redirect=${summary.expectedRedirectPresent ? "present" : "missing"}, redirect_count=${summary.redirectUrlCount}.`,
  );
};

const main = async () => {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help) {
    usage();
    return;
  }

  loadLocalEnv({ argv, defaultPaths: DEFAULT_ENV_FILES });
  const projectRef = normalizeProjectRef(
    args.projectRef ||
      process.env.SHORTPULSE_PRODUCTION_SUPABASE_PROJECT_REF ||
      process.env.SHORTPULSE_PRODUCTION_PROJECT_REF,
  );
  const expectedRedirectUrl = normalizeUrl(
    args.expectedRedirectUrl,
    "Expected redirect URL",
  );
  const token = readManagementToken();

  if (args.applyEnableGoogle && args.confirmEnableGoogle !== projectRef) {
    throw new Error(
      "--confirm-enable-google must exactly match --project-ref before applying.",
    );
  }

  const before = await fetchAuthConfig({ projectRef, token });
  const beforeSummary = summarizeConfig(before, expectedRedirectUrl);
  logSummary(args.environment, beforeSummary);

  if (args.requireDisableSignup && !beforeSummary.disableSignup) {
    throw new Error(
      "Refusing to continue: Supabase Auth public signup is enabled.",
    );
  }

  const patch = {};
  if (args.applyEnableGoogle) {
    const { clientId, clientSecret } = readGoogleCredentials();
    patch.external_google_enabled = true;
    patch.external_google_client_id = clientId;
    patch.external_google_secret = clientSecret;
  }

  if (args.applyRedirectUrl && !beforeSummary.expectedRedirectPresent) {
    patch.additional_redirect_urls = [
      ...readRedirectUrls(before),
      expectedRedirectUrl,
    ];
  }

  if (Object.keys(patch).length > 0) {
    await patchAuthConfig({ projectRef, token, patch });
  }

  const after =
    Object.keys(patch).length > 0
      ? await fetchAuthConfig({ projectRef, token })
      : before;
  const afterSummary = summarizeConfig(after, expectedRedirectUrl);
  if (Object.keys(patch).length > 0) {
    logSummary(args.environment, afterSummary);
  }

  if (args.applyEnableGoogle) {
    if (
      !afterSummary.googleEnabled ||
      !afterSummary.googleClientIdPresent ||
      !afterSummary.googleSecretPresent
    ) {
      throw new Error("Google provider update did not persist completely.");
    }
  }
  if (args.applyRedirectUrl && !afterSummary.expectedRedirectPresent) {
    throw new Error("Expected redirect URL update did not persist.");
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
