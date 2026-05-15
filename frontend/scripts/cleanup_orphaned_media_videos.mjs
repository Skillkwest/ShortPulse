#!/usr/bin/env node
/**
 * Remove fully orphaned saved video rows from Media Library metadata.
 *
 * Default mode is dry-run. Use --apply with explicit project confirmation to delete rows.
 */

import path from "node:path";
import process from "node:process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  assertApplyTargetConfirmed,
  inferSupabaseProjectIdFromUrl,
  loadEnvFile,
  parseArgs as parseSharedArgs,
} from "./backfill_video_previews.mjs";
import { classifyDisposition } from "./audit_orphaned_media_videos.mjs";

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
      "  node frontend/scripts/cleanup_orphaned_media_videos.mjs [options]",
      "",
      "Options:",
      "  --dry-run                 Default. Inspect fully orphaned video rows without mutating data.",
      "  --apply                   Delete fully orphaned media_files rows after explicit confirmation.",
      "  --confirm-project-id <id> Required with --apply. Must match the active Supabase project id.",
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

const fetchCandidates = async ({ supabase, limit, mediaFileId, userId }) => {
  let query = supabase
    .from("media_files")
    .select(
      "id, user_id, filename, file_type, storage_path, poster_variant_path, preview_variant_path"
    )
    .ilike("file_type", "video%")
    .is("preview_variant_path", null)
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

export const buildCleanupStoragePaths = (row) =>
  Array.from(
    new Set(
      [row.storagePath, row.previewVariantPath, row.posterVariantPath].filter(
        (value) => typeof value === "string" && value.trim().length > 0
      )
    )
  );

export const selectCleanupCandidates = (rows) =>
  rows.filter((row) => row.disposition === "fully_orphaned");

export const wasRowDeleted = (data) => Array.isArray(data) && data.length > 0;

const main = async () => {
  const args = parseSharedArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const { supabase, projectId, supabaseUrl } = loadClient();
  assertApplyTargetConfirmed({
    apply: args.apply,
    confirmProjectId: args.confirmProjectId,
    actualProjectId: projectId,
  });

  const rawRows = await fetchCandidates({
    supabase,
    limit: args.limit,
    mediaFileId: args.mediaFileId,
    userId: args.userId,
  });

  const auditedRows = [];
  for (const row of rawRows) {
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

  const cleanupCandidates = selectCleanupCandidates(auditedRows);

  if (!args.apply) {
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: "dry_run",
          projectId,
          supabaseUrl,
          candidateCount: auditedRows.length,
          cleanupCandidateCount: cleanupCandidates.length,
          cleanupCandidates,
        },
        null,
        2
      )}\n`
    );
    return;
  }

  const results = [];
  for (const row of cleanupCandidates) {
    const storagePaths = buildCleanupStoragePaths(row);
    const { data: deletedRows, error: deleteError } = await supabase
      .from("media_files")
      .delete()
      .eq("id", row.id)
      .eq("user_id", row.userId)
      .select("id");

    if (deleteError) {
      results.push({
        id: row.id,
        status: "failed",
        error: deleteError.message,
      });
      continue;
    }
    if (!wasRowDeleted(deletedRows)) {
      results.push({
        id: row.id,
        status: "failed",
        error: "delete_no_rows_affected",
      });
      continue;
    }

    let storageCleanupError = null;
    if (storagePaths.length) {
      const { error: storageError } = await supabase.storage
        .from(MEDIA_BUCKET)
        .remove(storagePaths);
      if (storageError) {
        storageCleanupError = storageError.message;
      }
    }

    results.push({
      id: row.id,
      status: "deleted",
      storagePaths,
      storageCleanupError,
    });
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: "apply",
        projectId,
        supabaseUrl,
        candidateCount: auditedRows.length,
        cleanupCandidateCount: cleanupCandidates.length,
        deleted: results.filter((row) => row.status === "deleted").length,
        failed: results.filter((row) => row.status === "failed").length,
        results,
      },
      null,
      2
    )}\n`
  );
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `[cleanup_orphaned_media_videos] error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
