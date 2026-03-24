#!/usr/bin/env node

/**
 * Validates a Vercel-style env file against the shared ShortPulse env contract.
 * Intended for pre-deploy checks against exported/staged env bundles.
 */

import path from "node:path";
import {
  FILE_PROFILE_REQUIRED_KEYS,
  MIRRORED_FLAG_PAIRS,
  PREVIEW_PRODUCTION_MUST_DIFFER_KEYS,
  VERCEL_ENVIRONMENTS,
  getFileProfileRequiredKeys,
  getRequiredVercelKeysForEnvironment,
  isKnownVercelKey,
  isLocalOrToolingOnlyKey,
  parseEnvFileToMap,
} from "./lib/vercel_env_contract.mjs";

const PROFILE_CORE = "core";

const usage = () => {
  console.log(`Usage:
  node scripts/check_vercel_env_file.mjs --file <path> [--profile core|phase04] [--environment development|preview|production]

Options:
  --file <path>           Path to env file to validate.
  --profile <name>        Validation profile. Repeatable.
                          Default: core
                          Available: ${Object.keys(FILE_PROFILE_REQUIRED_KEYS).join(", ")}
  --environment <name>    Optional Vercel environment-specific validation rules.
                          Available: ${VERCEL_ENVIRONMENTS.join(", ")}
  --help                  Show this message.
`);
};

const parseArgs = (argv) => {
  const parsed = {
    file: "",
    profiles: [PROFILE_CORE],
    environment: "",
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--file") {
      parsed.file = (argv[index + 1] ?? "").trim();
      index += 1;
      continue;
    }
    if (arg === "--profile") {
      const profile = (argv[index + 1] ?? "").trim();
      if (!profile) {
        throw new Error("--profile requires a value");
      }
      if (!(profile in FILE_PROFILE_REQUIRED_KEYS)) {
        throw new Error(`Unknown profile: ${profile}`);
      }
      if (!parsed.profiles.includes(profile)) {
        parsed.profiles.push(profile);
      }
      index += 1;
      continue;
    }
    if (arg === "--environment") {
      const environment = (argv[index + 1] ?? "").trim().toLowerCase();
      if (!environment) {
        throw new Error("--environment requires a value");
      }
      if (!VERCEL_ENVIRONMENTS.includes(environment)) {
        throw new Error(`Unknown environment: ${environment}`);
      }
      parsed.environment = environment;
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!parsed.file && !parsed.help) {
    throw new Error("Missing --file");
  }

  return parsed;
};

const main = () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const filePath = path.resolve(process.cwd(), args.file);
  const envMap = parseEnvFileToMap(filePath);

  const requiredKeys = new Set();
  for (const profile of args.profiles) {
    for (const key of getFileProfileRequiredKeys(profile)) {
      requiredKeys.add(key);
    }
  }
  if (args.environment) {
    for (const key of getRequiredVercelKeysForEnvironment(args.environment)) {
      requiredKeys.add(key);
    }
  }

  const missing = [...requiredKeys].filter((key) => {
    const value = envMap.get(key);
    return value === undefined || value === "";
  });

  const warnings = [];
  const errors = [];
  const appBaseUrl = envMap.get("APP_BASE_URL") ?? "";
  const publicApiBase = envMap.get("SHORTPULSE_PUBLIC_API_BASE_URL") ?? "";
  if (appBaseUrl && publicApiBase && appBaseUrl !== publicApiBase) {
    warnings.push(
      "APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL differ. Ensure this is intentional for webhook callback registration."
    );
  }
  if (!publicApiBase && appBaseUrl) {
    warnings.push(
      "SHORTPULSE_PUBLIC_API_BASE_URL is empty; runtime will fall back to APP_BASE_URL."
    );
  }
  for (const key of envMap.keys()) {
    if (isLocalOrToolingOnlyKey(key)) {
      warnings.push(`${key} is local/tooling-only and should not be treated as a deploy requirement.`);
      continue;
    }
    if (!isKnownVercelKey(key)) {
      warnings.push(`${key} is not declared in frontend/.env.example and should be reviewed for contract drift.`);
    }
  }
  for (const [serverKey, clientKey] of MIRRORED_FLAG_PAIRS) {
    const serverValue = envMap.get(serverKey);
    const clientValue = envMap.get(clientKey);
    if (
      serverValue !== undefined &&
      clientValue !== undefined &&
      serverValue !== "" &&
      clientValue !== "" &&
      serverValue !== clientValue
    ) {
      errors.push(`${serverKey} and ${clientKey} differ. Keep mirrored client/server rollout flags aligned.`);
    }
  }
  if (args.environment === "preview" || args.environment === "production") {
    for (const key of PREVIEW_PRODUCTION_MUST_DIFFER_KEYS) {
      if (!envMap.has(key) || (envMap.get(key) ?? "") === "") continue;
      if (key === "APP_BASE_URL" || key === "SHORTPULSE_PUBLIC_API_BASE_URL") {
        const value = envMap.get(key) ?? "";
        if (!/^https:\/\//i.test(value)) {
          errors.push(`${key} must be an https URL for ${args.environment} exports.`);
        }
      }
    }
  }

  if (missing.length > 0 || errors.length > 0) {
    console.error("[vercel-env-check] missing required keys:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    if (errors.length > 0) {
      console.error("[vercel-env-check] contract violations:");
      for (const error of errors) {
        console.error(`- ${error}`);
      }
    }
    process.exit(1);
  }

  console.log(
    `[vercel-env-check] ok profiles=${args.profiles.join(",")} environment=${args.environment || "n/a"} file=${filePath}`
  );
  if (warnings.length > 0) {
    for (const warning of warnings) {
      console.log(`[vercel-env-check] warning: ${warning}`);
    }
  }
};

try {
  main();
} catch (error) {
  console.error(`[vercel-env-check] error=${error.message}`);
  process.exit(1);
}
