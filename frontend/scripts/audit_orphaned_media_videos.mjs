#!/usr/bin/env node
/**
 * Audit saved video rows for missing source/preview/poster storage objects.
 *
 * Dry-run only. Produces a report to drive follow-on remediation or cleanup decisions.
 */

import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  inferSupabaseProjectIdFromUrl,
  loadEnvFile,
  parseArgs as parseBackfillArgs,
} from "./backfill_video_previews.mjs";

const require = createRequire(import.meta.url);
const { createClient } = require("../node_modules/@supabase/supabase-js");

const MEDIA_BUCKET = "media_library";
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const asTrimmedString = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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
      "  node frontend/scripts/audit_orphaned_media_videos.mjs [options]",
      "",
      "Options:",
      "  --limit <n>               Max candidate rows to inspect (default 25).",
      "  --media-file-id <uuid>    Restrict to one media_files row.",
      "  --user-id <uuid>          Restrict to one owner.",
      "",
    ].join("\n")
  );
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

const probeStorageObject = async ({ supabase, storagePath }) => {
  const normalizedStoragePath = normalizeStoragePath(storagePath);
  if (!normalizedStoragePath) return "none";
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(normalizedStoragePath, 60);
  if (!error && typeof data?.signedUrl === "string" && data.signedUrl.trim()) {
    return "available";
  }
  const message = asTrimmedString(error?.message)?.toLowerCase() ?? "";
  if (message.includes("not found") || message.includes("object")) {
    return "missing";
  }
  return "unknown";
};

export const classifyDisposition = ({ sourceStatus, previewStatus, posterStatus }) => {
  if (previewStatus === "available") return "durable_preview_available";
  if (sourceStatus === "available") return "source_recoverable";
  if (posterStatus === "available") return "poster_only_orphan";
  const previewUnavailable = previewStatus === "missing" || previewStatus === "none";
  const posterUnavailable = posterStatus === "missing" || posterStatus === "none";
  if (sourceStatus === "missing" && previewUnavailable && posterUnavailable) {
    return "fully_orphaned";
  }
  return "unknown";
};

const fetchCandidates = async ({ supabase, limit, mediaFileId, userId }) => {
  let query = supabase
    .from("media_files")
    .select(
      "id, user_id, filename, file_type, storage_path, poster_variant_path, preview_variant_path"
    )
    .ilike("file_type", "video%")
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

const main = async () => {
  const args = parseBackfillArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const { supabase, projectId, supabaseUrl } = loadClient();
  const rows = await fetchCandidates({
    supabase,
    limit: args.limit,
    mediaFileId: args.mediaFileId,
    userId: args.userId,
  });

  const auditedRows = [];
  for (const row of rows) {
    const sourceStatus = await probeStorageObject({
      supabase,
      storagePath: row.storage_path,
    });
    const previewStatus = await probeStorageObject({
      supabase,
      storagePath: row.preview_variant_path,
    });
    const posterStatus = await probeStorageObject({
      supabase,
      storagePath: row.poster_variant_path,
    });
    auditedRows.push({
      id: row.id,
      userId: row.user_id,
      filename: row.filename ?? null,
      fileType: row.file_type ?? null,
      storagePath: normalizeStoragePath(row.storage_path),
      previewVariantPath: normalizeStoragePath(row.preview_variant_path),
      posterVariantPath: normalizeStoragePath(row.poster_variant_path),
      sourceStatus,
      previewStatus,
      posterStatus,
      disposition: classifyDisposition({ sourceStatus, previewStatus, posterStatus }),
    });
  }

  const summary = {
    mode: "audit",
    projectId,
    supabaseUrl,
    candidateCount: auditedRows.length,
    countsByDisposition: auditedRows.reduce((acc, row) => {
      acc[row.disposition] = (acc[row.disposition] ?? 0) + 1;
      return acc;
    }, {}),
    rows: auditedRows,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `[audit_orphaned_media_videos] error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
