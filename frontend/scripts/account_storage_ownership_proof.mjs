#!/usr/bin/env node
/* global URL */
/**
 * Run the canonical account storage ownership proof report.
 *
 * This script is read-only and report-only. It has no apply/delete mode and
 * intentionally runs the SQL report without printing object paths.
 */

import path from "node:path";
import process from "node:process";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { inferSupabaseProjectIdFromUrl, loadEnvFile } from "./backfill_video_previews.mjs";

const execFile = promisify(execFileCallback);

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");
const REPORT_SQL_PATH = path.join(REPO_ROOT, "sql/check_account_storage_ownership_proof.sql");
const DEFAULT_INACTIVE_DAYS = 180;

const asTrimmedString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readArgValue = (argv, flag) => {
  const prefixed = `${flag}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === flag) return argv[index + 1] ?? "";
    if (token.startsWith(prefixed)) return token.slice(prefixed.length);
  }
  return "";
};

const asBoundedInteger = (value, fallback, { min, max }) => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return fallback;
  const parsed = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/account_storage_ownership_proof.mjs [options]",
      "",
      "Options:",
      "  --inactive-days <n>    Inactivity window in days (default 180, min 30, max 3650).",
      "  --psql-path <path>     psql executable (default psql).",
      "  --help                 Show this message.",
      "",
      "Required environment:",
      "  SUPABASE_DB_URL, DATABASE_URL, or SHORTPULSE_PRODUCTION_DB_URL.",
      "",
      "Boundary:",
      "  Report-only. No apply mode, no deletion mode, no object paths.",
      "",
    ].join("\n")
  );
};

const parseArgs = (argv) => {
  for (const forbiddenFlag of ["--apply", "--delete", "--cleanup", "--remove"]) {
    if (argv.includes(forbiddenFlag)) {
      throw new Error(`${forbiddenFlag} is not supported. This runner is report-only.`);
    }
  }

  return {
    help: argv.includes("--help") || argv.includes("-h"),
    inactiveDays: asBoundedInteger(readArgValue(argv, "--inactive-days"), DEFAULT_INACTIVE_DAYS, {
      min: 30,
      max: 3650,
    }),
    psqlPath: asTrimmedString(readArgValue(argv, "--psql-path")) ?? "psql",
  };
};

const loadLocalEnv = () => {
  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));
  loadEnvFile(path.join(REPO_ROOT, ".env.local"));
};

const getDatabaseUrl = () => {
  const value =
    asTrimmedString(process.env.SUPABASE_DB_URL) ??
    asTrimmedString(process.env.DATABASE_URL) ??
    asTrimmedString(process.env.SHORTPULSE_PRODUCTION_DB_URL);
  if (!value) {
    throw new Error(
      "Missing SUPABASE_DB_URL, DATABASE_URL, or SHORTPULSE_PRODUCTION_DB_URL for proof SQL."
    );
  }
  return value;
};

const inferProjectIdFromDatabaseUrl = (value) => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;
  try {
    const hostname = new URL(trimmed).hostname.trim().toLowerCase();
    const dbMatch = hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/);
    if (dbMatch?.[1]) return dbMatch[1];
    const poolerMatch = hostname.match(/^([a-z0-9]+)\.pooler\.supabase\.com$/);
    if (poolerMatch?.[1]) return poolerMatch[1];
    const [projectId] = hostname.split(".");
    return asTrimmedString(projectId);
  } catch {
    return null;
  }
};

const readSupabaseTarget = () => {
  const supabaseUrl = asTrimmedString(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return {
    supabaseUrl,
    projectId: inferSupabaseProjectIdFromUrl(supabaseUrl),
  };
};

const runReportSql = async ({ databaseUrl, inactiveDays, psqlPath }) => {
  try {
    const { stdout } = await execFile(
      psqlPath,
      [
        "--no-align",
        "--field-separator",
        "\t",
        "-v",
        "ON_ERROR_STOP=1",
        "-v",
        `inactive_days=${inactiveDays}`,
        "-f",
        REPORT_SQL_PATH,
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PGDATABASE: databaseUrl,
          PGSSLMODE: process.env.PGSSLMODE || "require",
        },
        maxBuffer: 16 * 1024 * 1024,
      }
    );
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.split(databaseUrl).join("[REDACTED_DB_URL]"));
  }
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  loadLocalEnv();
  const databaseUrl = getDatabaseUrl();
  const databaseProjectId = inferProjectIdFromDatabaseUrl(databaseUrl);
  const supabaseTarget = readSupabaseTarget();
  const report = await runReportSql({
    databaseUrl,
    inactiveDays: args.inactiveDays,
    psqlPath: args.psqlPath,
  });

  process.stdout.write(
    JSON.stringify(
      {
        mode: "account_storage_ownership_proof",
        boundary: "report_only_no_deletion_authority",
        inactiveDays: args.inactiveDays,
        databaseProjectId,
        supabaseProjectId: supabaseTarget.projectId,
        projectIdMatches:
          databaseProjectId && supabaseTarget.projectId
            ? databaseProjectId === supabaseTarget.projectId
            : null,
        sqlFile: path.relative(REPO_ROOT, REPORT_SQL_PATH),
        report,
      },
      null,
      2
    )
  );
  process.stdout.write("\n");
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
