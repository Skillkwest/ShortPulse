#!/usr/bin/env node

/**
 * Verifies and optionally disables public Supabase Auth signups via the
 * Supabase Management API without printing secrets or raw config values.
 * Default posture remains pre-launch closed signup. Use --expect-enabled only
 * after the paid signup intent hook is configured and verified separately.
 */

import process from "node:process";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_ENV_FILES = [
  ".env.agent.local",
  ".env.local",
  "frontend/.env.local",
];
const MANAGEMENT_API_BASE_URL = "https://api.supabase.com";

const usage = () => {
  console.log(`Usage:
  node scripts/check_supabase_auth_signup_config.mjs --project-ref <ref> [options]

Options:
  --environment <name>                 Label for output. Default: production.
  --project-ref <ref>                  Supabase project ref to inspect.
  --expect-disabled                    Exit non-zero unless disable_signup is true. Default.
  --expect-enabled                     Exit non-zero unless disable_signup is false.
  --no-expect-disabled                 Report only.
  --apply-disable-signup               PATCH disable_signup=true.
  --confirm-disable-signup <ref>       Required with --apply-disable-signup; must match project ref.
  --env-file <path>                    Optional env file path (repeatable).
  --help                               Show this message.

Required env:
  SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_API_TOKEN
  Optional project-ref fallback: SHORTPULSE_PRODUCTION_SUPABASE_PROJECT_REF or SHORTPULSE_PRODUCTION_PROJECT_REF
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
    expectedSignupState: "disabled",
    applyDisableSignup: false,
    confirmDisableSignup: "",
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
    if (arg === "--expect-disabled") {
      parsed.expectedSignupState = "disabled";
      continue;
    }
    if (arg === "--expect-enabled") {
      parsed.expectedSignupState = "enabled";
      continue;
    }
    if (arg === "--no-expect-disabled") {
      parsed.expectedSignupState = "report-only";
      continue;
    }
    if (arg === "--apply-disable-signup") {
      parsed.applyDisableSignup = true;
      continue;
    }
    if (arg === "--confirm-disable-signup") {
      parsed.confirmDisableSignup = argValue(
        argv,
        index,
        "--confirm-disable-signup",
      ).trim();
      index += 1;
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

const patchDisableSignup = async ({ projectRef, token }) => {
  const response = await fetch(authConfigUrl(projectRef), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ disable_signup: true }),
  });
  if (!response.ok) {
    throw new Error(`Auth config update failed (${response.status}).`);
  }
};

const formatState = (value) => (value === true ? "disabled" : "enabled");

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
  const token = readManagementToken();

  if (args.applyDisableSignup && args.confirmDisableSignup !== projectRef) {
    throw new Error(
      "--confirm-disable-signup must exactly match --project-ref before applying.",
    );
  }

  const before = await fetchAuthConfig({ projectRef, token });
  const beforeDisabled = before?.disable_signup === true;
  console.log(
    `${args.environment} Supabase Auth public signup is ${formatState(beforeDisabled)}.`,
  );

  if (args.applyDisableSignup && !beforeDisabled) {
    await patchDisableSignup({ projectRef, token });
    const after = await fetchAuthConfig({ projectRef, token });
    const afterDisabled = after?.disable_signup === true;
    console.log(
      `${args.environment} Supabase Auth public signup is now ${formatState(afterDisabled)}.`,
    );
    if (!afterDisabled) {
      throw new Error(
        "Supabase accepted the update but disable_signup is still not true.",
      );
    }
  }

  const finalConfig = args.applyDisableSignup
    ? await fetchAuthConfig({ projectRef, token })
    : before;
  const finalDisabled = finalConfig?.disable_signup === true;
  if (args.expectedSignupState === "disabled" && !finalDisabled) {
    throw new Error(
      "Launch security check failed: Supabase Auth public signup is still enabled.",
    );
  }
  if (args.expectedSignupState === "enabled" && finalDisabled) {
    throw new Error(
      "Launch signup check failed: Supabase Auth public signup is still disabled.",
    );
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
