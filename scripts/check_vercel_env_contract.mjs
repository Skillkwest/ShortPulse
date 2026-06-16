#!/usr/bin/env node

/**
 * Audits live Vercel environment-variable configuration against the shared ShortPulse contract.
 * Verifies target assignment, environment-specific required keys, and selective value parity rules.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  DEFAULT_VERCEL_AUDIT_ENVIRONMENTS,
  KNOWN_VERCEL_KEYS,
  LOCAL_OR_TOOLING_ONLY_KEYS,
  MIRRORED_FLAG_PAIRS,
  MUST_RESOLVE_FALSE_VERCEL_KEYS,
  PRODUCTION_MUST_NOT_RESOLVE_TRUE_VERCEL_KEYS,
  PREVIEW_PRODUCTION_MUST_DIFFER_KEYS,
  DEVELOPMENT_PREVIEW_MUST_DIFFER_KEYS,
  SENSITIVE_PRESENCE_ONLY_KEYS,
  TARGET_SCOPED_VERCEL_KEYS,
  VERCEL_ENVIRONMENTS,
  getRequiredVercelKeysForEnvironment,
  parseEnvFileToMap,
  validatePublicOriginPair,
  validateDeployedPublicOrigin,
  validateGuardedVercelFlag,
} from "./lib/vercel_env_contract.mjs";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const execFileAsync = promisify(execFile);

const LOADED_ENV_FILES = loadLocalEnv({
  argv: process.argv.slice(2),
  defaultPaths: [".env.agent.local", "frontend/.env.local"],
});

const usage = () => {
  console.log(`Usage:
  node scripts/check_vercel_env_contract.mjs [options]

Options:
  --token <token>          Vercel API token.
                           Fallback env: SHORTPULSE_VERCEL_API_TOKEN, VERCEL_API_TOKEN
                           Optional when the local \`vercel\` CLI is already authenticated.
  --environment <name>     Environment to audit. Repeatable.
                           Default: ${DEFAULT_VERCEL_AUDIT_ENVIRONMENTS.join(", ")}
                           Available: ${VERCEL_ENVIRONMENTS.join(", ")}
  --git-branch <name>      Optional branch-specific preview audit target.
                           Default when preview is included: ${
                             process.env.SHORTPULSE_VERCEL_PREVIEW_BRANCH?.trim() ||
                             "staging-preview"
                           }
  --env-file <path>        Optional env file path (repeatable). Parsed by shared loader.
  --help                   Show this message.
`);
};

const readArgValue = (argv, index, label) => {
  const value = argv[index + 1];
  if (!value) {
    throw new Error(`${label} requires a value`);
  }
  return value.trim();
};

const parseArgs = (argv) => {
  const parsed = {
    token:
      process.env.SHORTPULSE_VERCEL_API_TOKEN?.trim() ??
      process.env.VERCEL_API_TOKEN?.trim() ??
      "",
    environments: [],
    gitBranch:
      process.env.SHORTPULSE_VERCEL_PREVIEW_BRANCH?.trim() || "staging-preview",
    gitBranchExplicit: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--token") {
      parsed.token = readArgValue(argv, index, "--token");
      index += 1;
      continue;
    }
    if (arg === "--environment") {
      const environment = readArgValue(
        argv,
        index,
        "--environment",
      ).toLowerCase();
      if (!VERCEL_ENVIRONMENTS.includes(environment)) {
        throw new Error(`Unknown environment: ${environment}`);
      }
      if (!parsed.environments.includes(environment)) {
        parsed.environments.push(environment);
      }
      index += 1;
      continue;
    }
    if (arg === "--git-branch") {
      parsed.gitBranch = readArgValue(argv, index, "--git-branch");
      parsed.gitBranchExplicit = true;
      index += 1;
      continue;
    }
    if (arg === "--env-file") {
      readArgValue(argv, index, "--env-file");
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  parsed.environments = parsed.environments.filter(
    (environment, index, array) => array.indexOf(environment) === index,
  );
  if (parsed.environments.length === 0) {
    parsed.environments = [...DEFAULT_VERCEL_AUDIT_ENVIRONMENTS];
  }

  if (!parsed.environments.includes("preview")) {
    parsed.gitBranch = "";
  }

  if (parsed.gitBranchExplicit && !parsed.environments.includes("preview")) {
    throw new Error("--git-branch can only be used when auditing preview.");
  }

  return parsed;
};

const parseJsonStdout = (stdout, label) => {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw new Error(`${label} returned empty output.`);
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace < 0 || lastBrace <= firstBrace) {
      throw new Error(`${label} did not return valid JSON.`);
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
};

const summarizeExecFailure = (error) => {
  if (typeof error?.stderr === "string" && error.stderr.trim())
    return error.stderr.trim();
  if (typeof error?.stdout === "string" && error.stdout.trim())
    return error.stdout.trim();
  return "Vercel CLI command failed.";
};

const runVercel = async (args, token, label) => {
  const finalArgs = token ? [...args, "--token", token] : args;
  try {
    const { stdout } = await execFileAsync("vercel", finalArgs, {
      cwd: process.cwd(),
      maxBuffer: 20 * 1024 * 1024,
    });
    return stdout;
  } catch (error) {
    throw new Error(`${label}: ${summarizeExecFailure(error)}`);
  }
};

const pullEnvironmentMap = async ({ environment, token, gitBranch }) => {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "shortpulse-vercel-env-"),
  );
  const tempPath = path.join(tempDir, `${environment}.env`);
  const args = ["env", "pull", tempPath, "--environment", environment, "--yes"];
  if (gitBranch) {
    args.push("--git-branch", gitBranch);
  }

  try {
    await runVercel(args, token, `vercel env pull (${environment})`);
    return parseEnvFileToMap(tempPath);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};

const normalizeTargets = (targets) => {
  if (!Array.isArray(targets)) return [];
  return [...targets].map((target) => String(target).toLowerCase()).sort();
};

const sameValue = (left, right) => (left ?? "") === (right ?? "");

const unique = (items) => [...new Set(items)];

const hasEnvironmentScopedKey = (envRows, key, environment) =>
  envRows.some((row) => {
    if (String(row.key ?? "").trim() !== key) return false;
    return Array.isArray(row.target) && row.target.includes(environment);
  });

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const rawListJson = await runVercel(
    ["env", "ls", "--format", "json"],
    args.token,
    "vercel env ls",
  );
  const envRows = parseJsonStdout(rawListJson, "vercel env ls").envs ?? [];
  const errors = [];
  const warnings = [];

  const keysByTarget = new Map();
  for (const environment of args.environments) {
    keysByTarget.set(
      environment,
      await pullEnvironmentMap({
        environment,
        token: args.token,
        gitBranch: environment === "preview" ? args.gitBranch : "",
      }),
    );
  }

  for (const row of envRows) {
    const key = String(row.key ?? "").trim();
    if (!key) continue;

    const targets = normalizeTargets(row.target);
    const isScoped =
      row.configurationId !== null && row.configurationId !== undefined;

    if (LOCAL_OR_TOOLING_ONLY_KEYS.has(key)) {
      errors.push(
        `${key} is local/tooling-only and should not be stored in Vercel project envs.`,
      );
      continue;
    }

    if (!KNOWN_VERCEL_KEYS.has(key)) {
      warnings.push(
        `${key} is not declared in frontend/.env.example and should be reviewed for contract drift.`,
      );
    }

    if (TARGET_SCOPED_VERCEL_KEYS.includes(key) && !isScoped) {
      const sharedAllTargets =
        targets.length === 3 &&
        targets[0] === "development" &&
        targets[1] === "preview" &&
        targets[2] === "production";
      if (sharedAllTargets) {
        errors.push(
          `${key} is assigned to development, preview, and production together. This key must use environment-specific Vercel records.`,
        );
      }
    }
  }

  for (const environment of args.environments) {
    const envMap = keysByTarget.get(environment) ?? new Map();
    for (const key of getRequiredVercelKeysForEnvironment(environment)) {
      if (SENSITIVE_PRESENCE_ONLY_KEYS.has(key)) {
        if (!hasEnvironmentScopedKey(envRows, key, environment)) {
          errors.push(`${environment}: missing required key ${key}.`);
        }
        continue;
      }
      const value = envMap.get(key) ?? "";
      if (!value) {
        errors.push(`${environment}: missing required key ${key}.`);
      }
    }
  }

  const requireDistinctValues = (leftEnvironment, rightEnvironment, keys) => {
    const leftMap = keysByTarget.get(leftEnvironment);
    const rightMap = keysByTarget.get(rightEnvironment);
    if (!leftMap || !rightMap) return;

    for (const key of keys) {
      if (!leftMap.has(key) || !rightMap.has(key)) continue;
      if (sameValue(leftMap.get(key), rightMap.get(key))) {
        errors.push(
          `${key} has the same resolved value in ${leftEnvironment} and ${rightEnvironment}. Expected environment-specific values.`,
        );
      }
    }
  };

  requireDistinctValues(
    "development",
    "preview",
    DEVELOPMENT_PREVIEW_MUST_DIFFER_KEYS,
  );
  requireDistinctValues(
    "preview",
    "production",
    PREVIEW_PRODUCTION_MUST_DIFFER_KEYS,
  );

  for (const environment of args.environments) {
    const envMap = keysByTarget.get(environment) ?? new Map();
    for (const [serverKey, clientKey] of MIRRORED_FLAG_PAIRS) {
      const serverValue = envMap.get(serverKey);
      const clientValue = envMap.get(clientKey);
      if (!serverValue || !clientValue) continue;
      if (serverValue !== clientValue) {
        errors.push(
          `${environment}: mirrored flags ${serverKey} and ${clientKey} differ.`,
        );
      }
    }
    for (const key of ["APP_BASE_URL", "SHORTPULSE_PUBLIC_API_BASE_URL"]) {
      const value = envMap.get(key) ?? "";
      for (const error of validateDeployedPublicOrigin({
        environment,
        key,
        value,
      })) {
        errors.push(`${environment}: ${error}`);
      }
    }
    for (const error of validatePublicOriginPair({
      appBaseUrl: envMap.get("APP_BASE_URL") ?? "",
      publicApiBaseUrl: envMap.get("SHORTPULSE_PUBLIC_API_BASE_URL") ?? "",
      environment,
    })) {
      errors.push(`${environment}: ${error}`);
    }
    for (const key of [
      ...MUST_RESOLVE_FALSE_VERCEL_KEYS,
      ...PRODUCTION_MUST_NOT_RESOLVE_TRUE_VERCEL_KEYS,
    ]) {
      for (const error of validateGuardedVercelFlag({
        environment,
        key,
        value: envMap.get(key) ?? "",
      })) {
        errors.push(`${environment}: ${error}`);
      }
    }
  }

  const uniqueErrors = unique(errors);
  const uniqueWarnings = unique(warnings);

  if (uniqueErrors.length > 0) {
    console.error(
      `[vercel-env-contract] FAIL environments=${args.environments.join(",")} loaded_env_files=${LOADED_ENV_FILES.length}`,
    );
    for (const error of uniqueErrors) {
      console.error(`- ${error}`);
    }
    if (uniqueWarnings.length > 0) {
      for (const warning of uniqueWarnings) {
        console.error(`[vercel-env-contract] warning: ${warning}`);
      }
    }
    process.exit(1);
  }

  console.log(
    `[vercel-env-contract] PASS environments=${args.environments.join(",")} loaded_env_files=${LOADED_ENV_FILES.length}`,
  );
  if (uniqueWarnings.length > 0) {
    for (const warning of uniqueWarnings) {
      console.log(`[vercel-env-contract] warning: ${warning}`);
    }
  }
};

try {
  await main();
} catch (error) {
  console.error(`[vercel-env-contract] error=${error.message}`);
  process.exit(1);
}
