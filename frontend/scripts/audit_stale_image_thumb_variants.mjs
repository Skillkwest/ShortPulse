#!/usr/bin/env node
/**
 * Audit image rows whose durable thumb delivery fails while the original source still works.
 *
 * Read-only by design. Produces a JSON report and can emit a manual SQL requeue snippet
 * for operator review without mutating production directly.
 */

import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  inferSupabaseProjectIdFromUrl,
  loadEnvFile,
  parseArgs as parseSharedArgs,
} from "./backfill_video_previews.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("../node_modules/@supabase/supabase-js");

const MEDIA_BUCKET = "media_library";
const DEFAULT_LIMIT = 25;
const DEFAULT_CONCURRENCY = 6;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const asTrimmedString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asPositiveInteger = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, parsed);
};

const normalizeStoragePath = (value) => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;
  return trimmed.replace(/^\/+/, "").replace(/^media_library\//, "");
};

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return String(value).trim();
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/audit_stale_image_thumb_variants.mjs [options]",
      "",
      "Options:",
      "  --limit <n>               Max candidate rows to inspect (default 25).",
      "  --media-file-id <uuid>    Restrict to one media_files row.",
      "  --user-id <uuid>          Restrict to one owner.",
      "  --concurrency <n>         Parallel fetch worker count (default 6).",
      "  --emit-requeue-sql        Include a manual SQL requeue snippet for recoverable rows.",
      "",
    ].join("\n")
  );
};

const readValue = (argv, flag) => {
  const prefixed = `${flag}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === flag) return argv[index + 1] ?? "";
    if (token.startsWith(prefixed)) return token.slice(prefixed.length);
  }
  return "";
};

const parseArgs = (argv) => {
  const shared = parseSharedArgs(argv);
  return {
    help: shared.help,
    limit: shared.limit ?? DEFAULT_LIMIT,
    mediaFileId: shared.mediaFileId,
    userId: shared.userId,
    concurrency: asPositiveInteger(readValue(argv, "--concurrency"), DEFAULT_CONCURRENCY),
    emitRequeueSql: argv.includes("--emit-requeue-sql"),
  };
};

const loadClient = () => {
  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));
  loadEnvFile(path.join(REPO_ROOT, ".env.local"));

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const projectId = inferSupabaseProjectIdFromUrl(supabaseUrl);

  return {
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    projectId,
    supabaseUrl,
  };
};

const fetchCandidates = async ({ supabase, limit, mediaFileId, userId }) => {
  let query = supabase
    .from("media_files")
    .select(
      [
        "id",
        "user_id",
        "filename",
        "file_type",
        "source",
        "storage_path",
        "thumb_variant_path",
        "processing_status",
        "processing_attempts",
        "processing_updated_at",
        "created_at",
      ].join(",")
    )
    .ilike("file_type", "image%")
    .not("thumb_variant_path", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (mediaFileId) {
    query = query.eq("id", mediaFileId);
  }
  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return Array.isArray(data) ? data : [];
};

const probeSignedPath = async ({ supabase, storagePath }) => {
  const normalizedPath = normalizeStoragePath(storagePath);
  if (!normalizedPath) {
    return {
      ok: false,
      path: null,
      signError: "missing_path",
      status: null,
      contentType: null,
    };
  }

  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(normalizedPath, DEFAULT_SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return {
      ok: false,
      path: normalizedPath,
      signError: error?.message ?? "missing_signed_url",
      status: null,
      contentType: null,
    };
  }

  const response = await globalThis.fetch(data.signedUrl);
  await response.arrayBuffer();

  return {
    ok: response.ok,
    path: normalizedPath,
    signError: null,
    status: response.status,
    contentType: response.headers.get("content-type"),
  };
};

const toCounts = (rows, field) =>
  rows.reduce((accumulator, row) => {
    const key = asTrimmedString(row[field]) ?? "unknown";
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});

const buildRequeueSql = (rows) => {
  if (!rows.length) return null;
  const ids = rows.map((row) => `'${row.id}'`).join(",\n        ");
  return [
    "-- Manual operator repair for stale ready image thumb variants.",
    "-- Review row ids before running in production.",
    "update public.media_files",
    "set",
    "    thumb_variant_path = null,",
    "    processing_status = 'pending',",
    "    processing_attempts = 0,",
    "    processing_next_retry_at = timezone('utc', now()),",
    "    processing_last_error = 'stale_thumb_variant_requeued',",
    "    processing_updated_at = timezone('utc', now())",
    "where id in (",
    `        ${ids}`,
    "    )",
    "  and lower(coalesce(file_type, '')) like 'image%'",
    "  and processing_status = 'ready';",
  ].join("\n");
};

const inspectCandidate = async ({ supabase, row }) => {
  const thumbProbe = await probeSignedPath({
    supabase,
    storagePath: row.thumb_variant_path,
  });
  const originalProbe =
    thumbProbe.ok === false
      ? await probeSignedPath({
          supabase,
          storagePath: row.storage_path,
        })
      : {
          ok: null,
          path: normalizeStoragePath(row.storage_path),
          signError: null,
          status: null,
          contentType: null,
        };

  const recoverable = thumbProbe.ok === false && originalProbe.ok === true;

  return {
    id: row.id,
    userId: row.user_id,
    filename: row.filename ?? null,
    source: row.source ?? null,
    fileType: row.file_type ?? null,
    processingStatus: row.processing_status ?? null,
    processingAttempts:
      typeof row.processing_attempts === "number" ? row.processing_attempts : null,
    processingUpdatedAt: row.processing_updated_at ?? null,
    createdAt: row.created_at ?? null,
    thumbVariantPath: thumbProbe.path,
    thumbOk: thumbProbe.ok,
    thumbStatus: thumbProbe.status,
    thumbContentType: thumbProbe.contentType,
    thumbSignError: thumbProbe.signError,
    originalPath: originalProbe.path,
    originalOk: originalProbe.ok,
    originalStatus: originalProbe.status,
    originalContentType: originalProbe.contentType,
    originalSignError: originalProbe.signError,
    recoverable,
  };
};

const runBoundedWorkers = async ({ items, concurrency, worker }) => {
  const queue = [...items];
  const results = [];

  const runOne = async () => {
    while (queue.length) {
      const next = queue.shift();
      if (!next) return;
      results.push(await worker(next));
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length || 1) }, () => runOne())
  );
  return results;
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const { supabase, projectId, supabaseUrl } = loadClient();
  const candidates = await fetchCandidates({
    supabase,
    limit: args.limit,
    mediaFileId: args.mediaFileId,
    userId: args.userId,
  });

  const inspectedRows = await runBoundedWorkers({
    items: candidates,
    concurrency: args.concurrency,
    worker: (row) => inspectCandidate({ supabase, row }),
  });

  const recoverableRows = inspectedRows.filter((row) => row.recoverable);
  const summary = {
    mode: "audit_stale_image_thumb_variants",
    projectId,
    supabaseUrl,
    inspectedCount: inspectedRows.length,
    recoverableCount: recoverableRows.length,
    countsBySource: toCounts(recoverableRows, "source"),
    countsByProcessingStatus: toCounts(recoverableRows, "processingStatus"),
    rows: inspectedRows,
    requeueSql: args.emitRequeueSql ? buildRequeueSql(recoverableRows) : null,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `[audit_stale_image_thumb_variants] error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
