#!/usr/bin/env node

/**
 * Validates a Vercel-style env file against required key profiles.
 * Intended for pre-deploy checks against exported/staged env bundles.
 */

import fs from "node:fs";
import path from "node:path";

const PROFILE_CORE = "core";
const PROFILE_PHASE04 = "phase04";

const REQUIRED_BY_PROFILE = {
  [PROFILE_CORE]: [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "FAL_KEY",
    "SHORTPULSE_ADMIN_EMAILS",
    "APP_BASE_URL",
  ],
  [PROFILE_PHASE04]: [
    "SHORTPULSE_PUBLIC_API_BASE_URL",
    "SHORTPULSE_STAGING_BASE_URL",
    "SHORTPULSE_FAL_QUEUE_ENABLED",
    "SHORTPULSE_FAL_RECONCILER_ENABLED",
    "SHORTPULSE_FAL_RECONCILER_CRON_SECRET",
    "SHORTPULSE_FAL_QUEUE_STATUS_DISPATCH_KICK_ENABLED",
  ],
};

const usage = () => {
  console.log(`Usage:
  node scripts/check_vercel_env_file.mjs --file <path> [--profile core|phase04]

Options:
  --file <path>           Path to env file to validate.
  --profile <name>        Validation profile. Repeatable.
                          Default: core
                          Available: core, phase04
  --help                  Show this message.
`);
};

const parseLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const normalized = trimmed.startsWith("export ") ? trimmed.slice("export ".length) : trimmed;
  const eqIndex = normalized.indexOf("=");
  if (eqIndex <= 0) return null;
  const key = normalized.slice(0, eqIndex).trim();
  const value = normalized.slice(eqIndex + 1).trim();
  return { key, value };
};

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, "utf8");
  const entries = content
    .split(/\r?\n/)
    .map((line) => parseLine(line))
    .filter(Boolean);

  const map = new Map();
  for (const entry of entries) {
    map.set(entry.key, entry.value);
  }
  return map;
};

const parseArgs = (argv) => {
  const parsed = {
    file: "",
    profiles: [PROFILE_CORE],
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
      if (!(profile in REQUIRED_BY_PROFILE)) {
        throw new Error(`Unknown profile: ${profile}`);
      }
      if (!parsed.profiles.includes(profile)) {
        parsed.profiles.push(profile);
      }
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
  const envMap = parseEnvFile(filePath);

  const requiredKeys = new Set();
  for (const profile of args.profiles) {
    for (const key of REQUIRED_BY_PROFILE[profile]) {
      requiredKeys.add(key);
    }
  }

  const missing = [...requiredKeys].filter((key) => {
    const value = envMap.get(key);
    return value === undefined || value === "";
  });

  const warnings = [];
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

  if (missing.length > 0) {
    console.error("[vercel-env-check] missing required keys:");
    for (const key of missing) {
      console.error(`- ${key}`);
    }
    process.exit(1);
  }

  console.log(
    `[vercel-env-check] ok profiles=${args.profiles.join(",")} file=${filePath}`
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
