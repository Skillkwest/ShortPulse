#!/usr/bin/env node
/* global URL */
/**
 * Backfill durable preview-loop variants for saved video rows missing `preview_variant_path`.
 *
 * Default mode is dry-run. Use `--apply` to persist preview variants to Supabase.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);
const require = createRequire(import.meta.url);
const { createClient } = require("../node_modules/@supabase/supabase-js");

const MEDIA_BUCKET = "media_library";
const DEFAULT_LIMIT = 25;
const DEFAULT_SEEK_SECONDS = 0.5;
const DEFAULT_PREVIEW_SECONDS = 3;
const DEFAULT_FFMPEG_PATH = "ffmpeg";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const VIDEO_PREVIEW_SCALE_FILTER =
  "scale=360:-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|webm)$/i;
const UUIDISH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeStoragePath = (value) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^\/+/, "").replace(/^media_library\//, "");
};

const isUserScopedStoragePath = (storagePath, userId) => {
  if (!storagePath || !userId) return false;
  return storagePath.startsWith(`${userId}/`);
};

export const loadEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
};

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

const asPositiveNumber = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseFloat(value.trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
};

const parseBooleanFlag = (argv, enabledToken, disabledToken) => {
  if (argv.includes(enabledToken)) return true;
  if (argv.includes(disabledToken)) return false;
  return null;
};

export const parseArgs = (argv) => {
  const readValue = (flag) => {
    const prefixed = `${flag}=`;
    for (let index = 0; index < argv.length; index += 1) {
      const token = argv[index];
      if (token === flag) return argv[index + 1] ?? "";
      if (token.startsWith(prefixed)) return token.slice(prefixed.length);
    }
    return "";
  };

  const apply = parseBooleanFlag(argv, "--apply", "--dry-run") ?? false;
  const limit = asPositiveInteger(readValue("--limit"), DEFAULT_LIMIT);
  const seekSeconds = asPositiveNumber(readValue("--seek-seconds"), DEFAULT_SEEK_SECONDS);
  const previewSeconds = asPositiveNumber(readValue("--preview-seconds"), DEFAULT_PREVIEW_SECONDS);
  const ffmpegPath = asTrimmedString(readValue("--ffmpeg-path")) ?? DEFAULT_FFMPEG_PATH;
  const mediaFileId = asTrimmedString(readValue("--media-file-id"));
  const confirmProjectId = asTrimmedString(readValue("--confirm-project-id"));
  const userId = asTrimmedString(readValue("--user-id"));
  const timeoutMs = asPositiveInteger(readValue("--timeout-ms"), DEFAULT_TIMEOUT_MS);
  const help = argv.includes("--help") || argv.includes("-h");

  if (mediaFileId && !UUIDISH_PATTERN.test(mediaFileId)) {
    throw new Error("Expected --media-file-id to be a UUID.");
  }
  if (userId && !UUIDISH_PATTERN.test(userId)) {
    throw new Error("Expected --user-id to be a UUID.");
  }

  return {
    apply,
    limit,
    seekSeconds,
    previewSeconds,
    ffmpegPath,
    mediaFileId,
    confirmProjectId,
    userId,
    timeoutMs,
    help,
  };
};

export const resolvePreviewStoragePath = ({ userId, mediaFileId }) =>
  `${userId}/variants/videos/${mediaFileId}/preview_loop_360p.mp4`;

export const normalizeCandidateRow = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value;
  const id = asTrimmedString(row.id);
  const userId = asTrimmedString(row.user_id);
  const storagePath = normalizeStoragePath(asTrimmedString(row.storage_path));
  const fileType = asTrimmedString(row.file_type)?.toLowerCase() ?? null;
  const previewVariantPath = asTrimmedString(row.preview_variant_path);
  if (!id || !userId || !storagePath || !fileType?.startsWith("video")) return null;
  return {
    id,
    userId,
    storagePath,
    storageScopeOk: isUserScopedStoragePath(storagePath, userId),
    fileType,
    previewVariantPath,
    filename: asTrimmedString(row.filename),
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/backfill_video_previews.mjs [options]",
      "",
      "Options:",
      "  --dry-run                 Default. Inspect candidates without mutating Supabase.",
      "  --apply                   Generate and persist preview-loop variants.",
      "  --limit <n>               Max candidate rows to inspect/process (default 25).",
      "  --media-file-id <uuid>    Restrict to one media_files row.",
      "  --confirm-project-id <id> Required with --apply. Must match the live Supabase project id.",
      "  --user-id <uuid>          Restrict to one owner.",
      "  --seek-seconds <n>        Approximate seek offset before preview extraction (default 0.5).",
      "  --preview-seconds <n>     Preview clip duration in seconds (default 3).",
      "  --ffmpeg-path <path>      Override ffmpeg binary path.",
      "  --timeout-ms <n>          ffmpeg timeout per video (default 120000).",
      "",
    ].join("\n")
  );
};

const getRequiredEnv = (key) => {
  const value = process.env[key];
  if (!value || !String(value).trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return String(value).trim();
};

export const inferSupabaseProjectIdFromUrl = (value) => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;

  try {
    const hostname = new URL(trimmed).hostname.trim().toLowerCase();
    if (!hostname) return null;
    const [projectId] = hostname.split(".");
    return asTrimmedString(projectId);
  } catch {
    return null;
  }
};

export const assertApplyTargetConfirmed = ({ apply, confirmProjectId, actualProjectId }) => {
  if (!apply) return;

  const normalizedConfirmed = asTrimmedString(confirmProjectId);
  const normalizedActual = asTrimmedString(actualProjectId);

  if (!normalizedActual) {
    throw new Error(
      "Could not infer the active Supabase project id. Refusing --apply without a resolvable target."
    );
  }
  if (!normalizedConfirmed) {
    throw new Error(`Refusing --apply without --confirm-project-id ${normalizedActual}.`);
  }
  if (normalizedConfirmed !== normalizedActual) {
    throw new Error(
      `Refusing --apply because --confirm-project-id ${normalizedConfirmed} does not match active project ${normalizedActual}.`
    );
  }
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

const toBuffer = async (downloaded) => {
  if (!downloaded) throw new Error("source_download_empty");
  if (Buffer.isBuffer(downloaded)) return downloaded;
  if (downloaded instanceof ArrayBuffer) return Buffer.from(downloaded);
  if (ArrayBuffer.isView(downloaded)) {
    return Buffer.from(downloaded.buffer, downloaded.byteOffset, downloaded.byteLength);
  }
  if (typeof downloaded.arrayBuffer === "function") {
    const arrayBuffer = await downloaded.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  throw new Error("source_download_unreadable");
};

const parseStructuredErrorMessage = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const message =
    asTrimmedString(value.message) ?? asTrimmedString(value.error) ?? asTrimmedString(value.msg);
  return message;
};

const readResponseErrorMessage = async (response) => {
  if (!response || typeof response !== "object") return null;
  if (typeof response.text !== "function") return null;
  try {
    const text = await response.text();
    const trimmed = asTrimmedString(text);
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parseStructuredErrorMessage(parsed) ?? trimmed;
    } catch {
      return trimmed;
    }
  } catch {
    return null;
  }
};

export const formatProcessError = async (error) => {
  const directMessage =
    asTrimmedString(error?.message) ??
    parseStructuredErrorMessage(error) ??
    asTrimmedString(String(error));
  if (directMessage && directMessage !== "{}") {
    return directMessage;
  }

  const responseMessage = await readResponseErrorMessage(error?.originalError);
  if (responseMessage) return responseMessage;

  return directMessage || "unknown_backfill_failure";
};

const isMissingSourceErrorMessage = (value) => {
  const normalized = asTrimmedString(value)?.toLowerCase() ?? "";
  return normalized.includes("object not found") || normalized.includes("not found");
};

const probeSourceObjectExists = async ({ supabase, storagePath }) => {
  const { data, error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60);
  if (!error && typeof data?.signedUrl === "string" && data.signedUrl.trim()) {
    return true;
  }
  if (isMissingSourceErrorMessage(error?.message)) {
    return false;
  }
  return null;
};

const downloadVideoBuffer = async (supabase, storagePath) => {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(error?.message ?? "source_download_failed");
  }
  const buffer = await toBuffer(data);
  if (!buffer.byteLength) throw new Error("source_download_empty");
  if (buffer.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(`source_download_too_large:${buffer.byteLength}`);
  }
  return buffer;
};

const extractPreviewBuffer = async ({
  videoBuffer,
  sourcePath,
  ffmpegPath,
  seekSeconds,
  previewSeconds,
  timeoutMs,
}) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shortpulse-video-preview-"));
  const extension = VIDEO_EXTENSION_PATTERN.test(sourcePath)
    ? path.extname(sourcePath).toLowerCase()
    : ".mp4";
  const inputPath = path.join(tempDir, `input${extension || ".mp4"}`);
  const outputPath = path.join(tempDir, "preview_loop_360p.mp4");

  try {
    await fs.promises.writeFile(inputPath, videoBuffer);
    await execFile(
      ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-ss",
        String(seekSeconds),
        "-i",
        inputPath,
        "-an",
        "-t",
        String(previewSeconds),
        "-vf",
        VIDEO_PREVIEW_SCALE_FILTER,
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "30",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      {
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    const previewBuffer = await fs.promises.readFile(outputPath);
    if (!previewBuffer.byteLength) {
      throw new Error("preview_extract_empty");
    }
    return previewBuffer;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
};

const readExistingPreviewVariantPath = async ({ supabase, mediaFileId }) => {
  const { data, error } = await supabase
    .from("media_asset_variants")
    .select("storage_path")
    .eq("media_file_id", mediaFileId)
    .eq("variant_kind", "preview_loop_360p")
    .eq("status", "ready")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return asTrimmedString(data?.storage_path);
};

const persistPreviewPath = async ({ supabase, mediaFileId, userId, previewPath }) => {
  const { error } = await supabase
    .from("media_files")
    .update({ preview_variant_path: previewPath })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (error) throw error;
};

const persistPreviewVariant = async ({ supabase, candidate, previewBuffer }) => {
  const previewPath = resolvePreviewStoragePath({
    userId: candidate.userId,
    mediaFileId: candidate.id,
  });

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(previewPath, previewBuffer, {
      contentType: "video/mp4",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { error: variantError } = await supabase.from("media_asset_variants").upsert(
    {
      media_file_id: candidate.id,
      user_id: candidate.userId,
      variant_kind: "preview_loop_360p",
      storage_path: previewPath,
      mime_type: "video/mp4",
      width: null,
      height: null,
      duration_seconds: null,
      byte_size: previewBuffer.byteLength,
      status: "ready",
      metadata: {
        generated_by: "video_preview_backfill_script",
        derivative_pipeline: "ffmpeg_preview_loop_360p_v1",
        source_storage_path: candidate.storagePath,
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (variantError) throw variantError;

  await persistPreviewPath({
    supabase,
    mediaFileId: candidate.id,
    userId: candidate.userId,
    previewPath,
  });

  return previewPath;
};

const fetchCandidates = async ({ supabase, limit, mediaFileId, userId }) => {
  let query = supabase
    .from("media_files")
    .select("id, user_id, storage_path, file_type, preview_variant_path, filename")
    .ilike("file_type", "video%")
    .is("preview_variant_path", null)
    .not("storage_path", "is", null)
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
  const rows = (Array.isArray(data) ? data : [])
    .map((row) => normalizeCandidateRow(row))
    .filter((row) => Boolean(row));

  const candidates = [];
  for (const row of rows) {
    const sourceExists = await probeSourceObjectExists({
      supabase,
      storagePath: row.storagePath,
    });
    candidates.push({
      ...row,
      sourceStatus:
        sourceExists === true ? "available" : sourceExists === false ? "missing" : "unknown",
    });
  }

  return candidates;
};

export const processCandidate = async ({
  supabase,
  candidate,
  ffmpegPath,
  seekSeconds,
  previewSeconds,
  timeoutMs,
}) => {
  if (!candidate.storageScopeOk) {
    return {
      id: candidate.id,
      status: "skipped_unscoped_storage_path",
      storagePath: candidate.storagePath,
    };
  }

  const existingVariantPath = await readExistingPreviewVariantPath({
    supabase,
    mediaFileId: candidate.id,
  });
  if (existingVariantPath) {
    const normalizedExistingVariantPath = normalizeStoragePath(existingVariantPath);
    if (!normalizedExistingVariantPath) {
      return {
        id: candidate.id,
        status: "failed",
        error: "existing_variant_path_empty",
      };
    }
    if (!isUserScopedStoragePath(normalizedExistingVariantPath, candidate.userId)) {
      return {
        id: candidate.id,
        status: "failed",
        error: "existing_variant_path_unscoped",
      };
    }
    await persistPreviewPath({
      supabase,
      mediaFileId: candidate.id,
      userId: candidate.userId,
      previewPath: normalizedExistingVariantPath,
    });
    return {
      id: candidate.id,
      status: "synced_existing_variant",
      previewPath: normalizedExistingVariantPath,
    };
  }

  if (candidate.sourceStatus === "missing") {
    return {
      id: candidate.id,
      status: "missing_source",
      error: "Object not found",
    };
  }

  const videoBuffer = await downloadVideoBuffer(supabase, candidate.storagePath);
  const previewBuffer = await extractPreviewBuffer({
    videoBuffer,
    sourcePath: candidate.storagePath,
    ffmpegPath,
    seekSeconds,
    previewSeconds,
    timeoutMs,
  });
  const previewPath = await persistPreviewVariant({
    supabase,
    candidate,
    previewBuffer,
  });
  return {
    id: candidate.id,
    status: "backfilled",
    previewPath,
  };
};

const main = async () => {
  const args = parseArgs(process.argv);
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
  const candidates = await fetchCandidates({
    supabase,
    limit: args.limit,
    mediaFileId: args.mediaFileId,
    userId: args.userId,
  });

  if (!args.apply) {
    const unscopedCandidates = candidates.filter((row) => !row.storageScopeOk);
    const missingSourceCandidates = candidates.filter((row) => row.sourceStatus === "missing");
    process.stdout.write(
      JSON.stringify(
        {
          mode: "dry_run",
          projectId,
          supabaseUrl,
          candidateCount: candidates.length,
          unscopedCandidateCount: unscopedCandidates.length,
          missingSourceCandidateCount: missingSourceCandidates.length,
          candidates,
        },
        null,
        2
      ) + "\n"
    );
    return;
  }

  const results = [];
  for (const candidate of candidates) {
    try {
      const result = await processCandidate({
        supabase,
        candidate,
        ffmpegPath: args.ffmpegPath,
        seekSeconds: args.seekSeconds,
        previewSeconds: args.previewSeconds,
        timeoutMs: args.timeoutMs,
      });
      results.push(result);
    } catch (error) {
      results.push({
        id: candidate.id,
        status: "failed",
        error: await formatProcessError(error),
      });
    }
  }

  const summary = {
    mode: "apply",
    projectId,
    supabaseUrl,
    candidateCount: candidates.length,
    processed: results.length,
    backfilled: results.filter((row) => row.status === "backfilled").length,
    syncedExistingVariant: results.filter((row) => row.status === "synced_existing_variant").length,
    skippedUnscoped: results.filter((row) => row.status === "skipped_unscoped_storage_path").length,
    missingSource: results.filter((row) => row.status === "missing_source").length,
    failed: results.filter((row) => row.status === "failed").length,
    results,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `[backfill_video_previews] error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
