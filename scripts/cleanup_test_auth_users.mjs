#!/usr/bin/env node

/**
 * Deletes known temporary auth users created by ShortPulse simulation tooling.
 * Responsibilities:
 * - Load local env files without overriding exported env vars.
 * - Enumerate Supabase Auth users via admin API pagination.
 * - Match only explicit test-account email patterns (or caller-provided patterns).
 * - Support safe dry-run mode and bounded delete limits.
 */

import process from "node:process";
import { loadLocalEnv } from "./lib/load_local_env.mjs";

const DEFAULT_ENV_FILES = [".env.agent.local", "frontend/.env.local"];
const DEFAULT_PER_PAGE = 200;
const DEFAULT_DELETE_LIMIT = 500;
const DEFAULT_PATTERNS = [
  /^agent\.sim\..*agent-sim.*@shortpulse\.test$/i,
  /^phase04_latency_probe_.*@example\.com$/i,
];

const usage = () => {
  console.log(`Usage:
  node scripts/cleanup_test_auth_users.mjs [options]

Options:
  --dry-run                 List matches only (do not delete).
  --include <regex>         Add an email-match regex (repeatable).
                            If omitted, defaults to built-in simulator/probe patterns.
  --exclude <regex>         Exclude an email regex from deletion (repeatable).
  --per-page <n>            Admin list page size. Default: ${DEFAULT_PER_PAGE}
  --delete-limit <n>        Safety cap for max matched users. Default: ${DEFAULT_DELETE_LIMIT}
  --env-file <path>         Optional env file path (repeatable).
  --help                    Show this message.

Required env:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
};

const parsePositiveInt = (value, label) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
};

const parseRegex = (source, label) => {
  try {
    return new RegExp(source, "i");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid ${label} regex "${source}": ${message}`);
  }
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
    dryRun: false,
    perPage: DEFAULT_PER_PAGE,
    deleteLimit: DEFAULT_DELETE_LIMIT,
    include: [],
    exclude: [],
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    if (arg === "--dry-run") {
      parsed.dryRun = true;
      continue;
    }
    if (arg === "--include") {
      const source = argValue(argv, index, "--include");
      parsed.include.push(parseRegex(source, "--include"));
      index += 1;
      continue;
    }
    if (arg === "--exclude") {
      const source = argValue(argv, index, "--exclude");
      parsed.exclude.push(parseRegex(source, "--exclude"));
      index += 1;
      continue;
    }
    if (arg === "--per-page") {
      parsed.perPage = parsePositiveInt(argValue(argv, index, "--per-page"), "--per-page");
      index += 1;
      continue;
    }
    if (arg === "--delete-limit") {
      parsed.deleteLimit = parsePositiveInt(
        argValue(argv, index, "--delete-limit"),
        "--delete-limit"
      );
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

const normalizeSupabaseUrl = (value) => String(value ?? "").trim().replace(/\/+$/, "");

const authHeaders = (serviceRoleKey) => ({
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
});

const listUsersPage = async ({ supabaseUrl, serviceRoleKey, page, perPage }) => {
  const url = new URL(`${supabaseUrl}/auth/v1/admin/users`);
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const response = await fetch(url, {
    method: "GET",
    headers: authHeaders(serviceRoleKey),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`list users failed (${response.status}): ${body.slice(0, 240)}`);
  }

  const payload = await response.json();
  const users = Array.isArray(payload?.users) ? payload.users : [];
  return users;
};

const listAllUsers = async ({ supabaseUrl, serviceRoleKey, perPage }) => {
  const users = [];
  let page = 1;

  while (true) {
    const pageUsers = await listUsersPage({
      supabaseUrl,
      serviceRoleKey,
      page,
      perPage,
    });
    if (pageUsers.length === 0) break;
    users.push(...pageUsers);
    if (pageUsers.length < perPage) break;
    page += 1;
  }

  return users;
};

const deleteUser = async ({ supabaseUrl, serviceRoleKey, userId }) => {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(serviceRoleKey),
  });

  if (response.ok || response.status === 404) return null;
  const body = await response.text();
  return `delete failed (${response.status}): ${body.slice(0, 240)}`;
};

const matchesAny = (value, patterns) => patterns.some((pattern) => pattern.test(value));

const main = async () => {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  if (args.help) {
    usage();
    return;
  }

  const loadedEnvFiles = loadLocalEnv({
    argv,
    defaultPaths: DEFAULT_ENV_FILES,
  });

  const supabaseUrl = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing required env. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set."
    );
  }
  if (!supabaseUrl.includes(".supabase.co")) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL appears invalid. Expected your Supabase project URL."
    );
  }

  const includePatterns = args.include.length > 0 ? args.include : DEFAULT_PATTERNS;
  const excludePatterns = args.exclude;

  const users = await listAllUsers({
    supabaseUrl,
    serviceRoleKey,
    perPage: args.perPage,
  });

  const matches = users
    .map((user) => ({
      id: String(user?.id ?? ""),
      email: String(user?.email ?? ""),
    }))
    .filter((user) => user.id && user.email)
    .filter((user) => matchesAny(user.email, includePatterns))
    .filter((user) => !matchesAny(user.email, excludePatterns));

  console.log(`Loaded env files: ${loadedEnvFiles.length}`);
  console.log(`Scanned users: ${users.length}`);
  console.log(`Matched test users: ${matches.length}`);

  if (matches.length > 0) {
    for (const user of matches) {
      console.log(`- ${user.email}`);
    }
  }

  if (args.dryRun) {
    console.log("Dry run complete. No users deleted.");
    return;
  }

  if (matches.length > args.deleteLimit) {
    throw new Error(
      `Matched ${matches.length} users, exceeding --delete-limit ${args.deleteLimit}. Aborting.`
    );
  }

  const deleted = [];
  const failures = [];
  for (const user of matches) {
    const error = await deleteUser({
      supabaseUrl,
      serviceRoleKey,
      userId: user.id,
    });
    if (error) {
      failures.push({ email: user.email, error });
      continue;
    }
    deleted.push(user.email);
  }

  console.log(`Deleted users: ${deleted.length}`);
  if (failures.length > 0) {
    console.log(`Delete failures: ${failures.length}`);
    for (const failure of failures) {
      console.log(`! ${failure.email} :: ${failure.error}`);
    }
  } else {
    console.log("Delete failures: 0");
  }
};

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
