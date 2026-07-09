#!/usr/bin/env node
/* global URL */
/**
 * Run the canonical Media Library lifecycle cleanup manifest in dry-run mode.
 *
 * Destructive apply is intentionally disabled because current lifecycle
 * candidates can belong to active users. Raw candidate paths are local operator
 * output only; do not paste them into chat or tracked reports.
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
const MANIFEST_SQL_PATH = path.join(REPO_ROOT, "sql/check_media_storage_cleanup_manifest.sql");
const MEDIA_BUCKET = "media_library";
const DEFAULT_MAX_CANDIDATES = 500;
const CANDIDATE_HEADER = [
  "object_id",
  "bucket_id",
  "storage_path",
  "safe_path_class",
  "object_mb",
  "created_at",
  "age_days",
  "cleanup_ttl_days",
  "manifest_reason",
  "reference_count",
  "reference_sources",
].join("\t");
const NEXT_RESULT_HEADER = [
  "manifest_action",
  "manifest_reason",
  "safe_path_class",
  "object_count",
  "total_mb",
].join("\t");
const ALLOWED_DELETE_CLASSES = new Set([
  "media_library/transient_image_reference",
  "media_library/transient_motion_reference",
  "media_library/upload_staging_reference_image",
  "media_library/upload_staging_reference_video",
  "media_library/upload_staging_motion_reference",
  "media_library/upload_staging_product_image_asset",
  "media_library/upload_staging_other",
]);

const asTrimmedString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asPositiveInteger = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
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

const parseArgs = (argv) => {
  const apply = argv.includes("--apply");
  if (apply) {
    throw new Error(
      "Destructive media lifecycle cleanup is disabled until active-user-owned media is excluded by canonical policy."
    );
  }
  const dryRun = argv.includes("--dry-run") || !apply;
  const maxCandidates = asPositiveInteger(
    readArgValue(argv, "--max-candidates"),
    DEFAULT_MAX_CANDIDATES,
    { min: 1 }
  );
  const psqlPath = asTrimmedString(readArgValue(argv, "--psql-path")) ?? "psql";
  const help = argv.includes("--help") || argv.includes("-h");

  return {
    apply,
    dryRun,
    maxCandidates,
    psqlPath,
    help,
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/media_storage_lifecycle_cleanup.mjs [options]",
      "",
      "Options:",
      "  --dry-run                    Default. Run the SQL manifest and report delete candidates.",
      "  --apply                      Disabled. Refuses until active-user-owned media is excluded.",
      "  --max-candidates <n>         Refuse if manifest returns more candidates (default 500).",
      "  --psql-path <path>           psql executable (default psql).",
      "",
      "Required environment:",
      "  SUPABASE_DB_URL or DATABASE_URL for read-only manifest SQL.",
      "  NEXT_PUBLIC_SUPABASE_URL when project-match checking is desired.",
      "",
    ].join("\n")
  );
};

const loadLocalEnv = () => {
  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));
  loadEnvFile(path.join(REPO_ROOT, ".env.local"));
};

const getDatabaseUrl = () => {
  const value =
    asTrimmedString(process.env.SUPABASE_DB_URL) ?? asTrimmedString(process.env.DATABASE_URL);
  if (!value) {
    throw new Error("Missing SUPABASE_DB_URL or DATABASE_URL for manifest SQL.");
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

const runManifestSql = async ({ databaseUrl, psqlPath }) => {
  try {
    const { stdout } = await execFile(
      psqlPath,
      [
        "--no-align",
        "--field-separator",
        "\t",
        "-v",
        "ON_ERROR_STOP=1",
        databaseUrl,
        "-f",
        MANIFEST_SQL_PATH,
      ],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          PGSSLMODE: process.env.PGSSLMODE || "require",
        },
        maxBuffer: 32 * 1024 * 1024,
      }
    );
    return stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(message.split(databaseUrl).join("[REDACTED_DB_URL]"));
  }
};

const parseCandidateRows = (manifestOutput) => {
  const lines = manifestOutput.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === CANDIDATE_HEADER);
  if (headerIndex < 0) {
    throw new Error("Could not locate delete-candidate section in manifest output.");
  }

  const candidates = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    if (line.trim() === NEXT_RESULT_HEADER) break;
    if (/^\(\d+ rows?\)$/.test(line.trim())) continue;

    const columns = line.split("\t");
    if (columns.length < 11) continue;
    const [
      objectId,
      bucketId,
      storagePath,
      safePathClass,
      objectMb,
      createdAt,
      ageDays,
      cleanupTtlDays,
      manifestReason,
      referenceCount,
      referenceSources,
    ] = columns;
    candidates.push({
      objectId,
      bucketId,
      storagePath,
      safePathClass,
      objectMb: Number(objectMb),
      createdAt,
      ageDays: Number(ageDays),
      cleanupTtlDays: Number(cleanupTtlDays),
      manifestReason,
      referenceCount: Number(referenceCount),
      referenceSources,
    });
  }
  return candidates;
};

const summarizeCandidates = (candidates) =>
  candidates.reduce(
    (summary, candidate) => {
      summary.objectCount += 1;
      summary.totalMb += Number.isFinite(candidate.objectMb) ? candidate.objectMb : 0;
      summary.byClass[candidate.safePathClass] = summary.byClass[candidate.safePathClass] ?? {
        objectCount: 0,
        totalMb: 0,
      };
      summary.byClass[candidate.safePathClass].objectCount += 1;
      summary.byClass[candidate.safePathClass].totalMb += Number.isFinite(candidate.objectMb)
        ? candidate.objectMb
        : 0;
      return summary;
    },
    { objectCount: 0, totalMb: 0, byClass: {} }
  );

const assertCandidatesAreInScope = (candidates, maxCandidates) => {
  if (candidates.length > maxCandidates) {
    throw new Error(
      `Refusing to continue: manifest returned ${candidates.length} candidates, above --max-candidates ${maxCandidates}.`
    );
  }

  for (const candidate of candidates) {
    if (candidate.bucketId !== MEDIA_BUCKET) {
      throw new Error(`Refusing non-${MEDIA_BUCKET} candidate: ${candidate.bucketId}`);
    }
    if (!ALLOWED_DELETE_CLASSES.has(candidate.safePathClass)) {
      throw new Error(`Refusing out-of-scope candidate class: ${candidate.safePathClass}`);
    }
    if (!asTrimmedString(candidate.storagePath)) {
      throw new Error("Refusing candidate with empty storage path.");
    }
  }
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  loadLocalEnv();

  const databaseUrl = getDatabaseUrl();
  const target = readSupabaseTarget();
  const databaseProjectId = inferProjectIdFromDatabaseUrl(databaseUrl);
  if (target.projectId && databaseProjectId && target.projectId !== databaseProjectId) {
    throw new Error(
      `Refusing project mismatch: manifest database project ${databaseProjectId} does not match Supabase URL project ${target.projectId}.`
    );
  }

  const manifestOutput = await runManifestSql({
    databaseUrl,
    psqlPath: args.psqlPath,
  });
  const candidates = parseCandidateRows(manifestOutput);
  assertCandidatesAreInScope(candidates, args.maxCandidates);

  const summary = summarizeCandidates(candidates);
  const baseResult = {
    mode: args.apply ? "apply" : "dry_run",
    projectId: databaseProjectId ?? target.projectId,
    databaseProjectId,
    storageProjectId: target.projectId,
    supabaseUrl: target.supabaseUrl,
    manifestSql: path.relative(REPO_ROOT, MANIFEST_SQL_PATH),
    candidateCount: summary.objectCount,
    candidateMb: Number(summary.totalMb.toFixed(3)),
    candidateClasses: Object.fromEntries(
      Object.entries(summary.byClass).map(([key, value]) => [
        key,
        {
          objectCount: value.objectCount,
          totalMb: Number(value.totalMb.toFixed(3)),
        },
      ])
    ),
    maxCandidates: args.maxCandidates,
  };

  process.stdout.write(`${JSON.stringify(baseResult, null, 2)}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `[media_storage_lifecycle_cleanup] error: ${
        error instanceof Error ? error.message : String(error)
      }\n`
    );
    process.exit(1);
  });
}
