#!/usr/bin/env node
/**
 * Backfill durable poster variants for saved video rows missing `poster_variant_path`.
 * Use `--force --media-file-id <uuid>` to regenerate one known-bad existing poster.
 *
 * Default mode is dry-run. Use `--apply` to persist poster variants to Supabase.
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
const sharp = require("../node_modules/sharp");

const MEDIA_BUCKET = "media_library";
const DEFAULT_LIMIT = 25;
const DEFAULT_SEEK_SECONDS = 0.5;
const DEFAULT_FFMPEG_PATH = "ffmpeg";
const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const VIDEO_EXTENSION_PATTERN = /\.(m4v|mov|mp4|webm)$/i;
const UUIDISH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const ffmpegPath = asTrimmedString(readValue("--ffmpeg-path")) ?? DEFAULT_FFMPEG_PATH;
  const mediaFileId = asTrimmedString(readValue("--media-file-id"));
  const userId = asTrimmedString(readValue("--user-id"));
  const timeoutMs = asPositiveInteger(readValue("--timeout-ms"), DEFAULT_TIMEOUT_MS);
  const force = argv.includes("--force");
  const help = argv.includes("--help") || argv.includes("-h");

  if (mediaFileId && !UUIDISH_PATTERN.test(mediaFileId)) {
    throw new Error("Expected --media-file-id to be a UUID.");
  }
  if (force && !mediaFileId) {
    throw new Error("Expected --media-file-id when using --force.");
  }

  return {
    apply,
    limit,
    seekSeconds,
    ffmpegPath,
    mediaFileId,
    userId,
    timeoutMs,
    force,
    help,
  };
};

export const resolvePosterStoragePath = ({ userId, mediaFileId }) =>
  `${userId}/variants/videos/${mediaFileId}/poster_720.jpg`;

export const normalizeCandidateRow = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value;
  const id = asTrimmedString(row.id);
  const userId = asTrimmedString(row.user_id);
  const storagePath = asTrimmedString(row.storage_path);
  const fileType = asTrimmedString(row.file_type)?.toLowerCase() ?? null;
  const posterVariantPath = asTrimmedString(row.poster_variant_path);
  if (!id || !userId || !storagePath || !fileType?.startsWith("video")) return null;
  return {
    id,
    userId,
    storagePath,
    fileType,
    posterVariantPath,
    filename: asTrimmedString(row.filename),
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/backfill_video_posters.mjs [options]",
      "",
      "Options:",
      "  --dry-run                 Default. Inspect candidates without mutating Supabase.",
      "  --apply                   Extract and persist poster variants.",
      "  --limit <n>               Max candidate rows to inspect/process (default 25).",
      "  --media-file-id <uuid>    Restrict to one media_files row.",
      "  --user-id <uuid>          Restrict to one owner.",
      "  --force                   Regenerate an existing poster for the scoped --media-file-id.",
      "  --seek-seconds <n>        Approximate seek offset before frame extraction (default 0.5).",
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

const loadClient = () => {
  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));
  loadEnvFile(path.join(REPO_ROOT, ".env.local"));

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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

const extractPosterBuffer = async ({
  videoBuffer,
  sourcePath,
  ffmpegPath,
  seekSeconds,
  timeoutMs,
}) => {
  const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "shortpulse-video-poster-"));
  const extension = VIDEO_EXTENSION_PATTERN.test(sourcePath)
    ? path.extname(sourcePath).toLowerCase()
    : ".mp4";
  const inputPath = path.join(tempDir, `input${extension || ".mp4"}`);
  const outputPath = path.join(tempDir, "poster.jpg");

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
        "-vf",
        "thumbnail,scale=720:-2:force_original_aspect_ratio=decrease",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        outputPath,
      ],
      {
        timeout: timeoutMs,
        maxBuffer: 4 * 1024 * 1024,
      }
    );
    const posterBuffer = await fs.promises.readFile(outputPath);
    if (!posterBuffer.byteLength) {
      throw new Error("poster_extract_empty");
    }
    return posterBuffer;
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
};

const readImageMetadata = async (buffer) => {
  const metadata = await sharp(buffer).metadata();
  const width = typeof metadata.width === "number" && metadata.width > 0 ? metadata.width : null;
  const height =
    typeof metadata.height === "number" && metadata.height > 0 ? metadata.height : null;
  return { width, height };
};

const readExistingPosterVariantPath = async ({ supabase, mediaFileId }) => {
  const { data, error } = await supabase
    .from("media_asset_variants")
    .select("storage_path")
    .eq("media_file_id", mediaFileId)
    .eq("variant_kind", "poster_720")
    .eq("status", "ready")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return asTrimmedString(data?.storage_path);
};

const persistPosterPath = async ({ supabase, mediaFileId, userId, posterPath }) => {
  const { error } = await supabase
    .from("media_files")
    .update({ poster_variant_path: posterPath })
    .eq("id", mediaFileId)
    .eq("user_id", userId);
  if (error) throw error;
};

const persistPosterVariant = async ({ supabase, candidate, posterBuffer }) => {
  const posterPath = resolvePosterStoragePath({
    userId: candidate.userId,
    mediaFileId: candidate.id,
  });
  const { width, height } = await readImageMetadata(posterBuffer);

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(posterPath, posterBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { error: variantError } = await supabase.from("media_asset_variants").upsert(
    {
      media_file_id: candidate.id,
      user_id: candidate.userId,
      variant_kind: "poster_720",
      storage_path: posterPath,
      mime_type: "image/jpeg",
      width,
      height,
      byte_size: posterBuffer.byteLength,
      status: "ready",
      metadata: {
        generated_by: "video_poster_backfill_script",
        derivative_pipeline: "ffmpeg_poster_720_v1",
        source_storage_path: candidate.storagePath,
      },
    },
    {
      onConflict: "media_file_id,variant_kind",
    }
  );
  if (variantError) throw variantError;

  await persistPosterPath({
    supabase,
    mediaFileId: candidate.id,
    userId: candidate.userId,
    posterPath,
  });

  return posterPath;
};

export const fetchCandidates = async ({ supabase, limit, mediaFileId, userId, force = false }) => {
  let query = supabase
    .from("media_files")
    .select("id, user_id, storage_path, file_type, poster_variant_path, filename")
    .ilike("file_type", "video%");

  if (!force) {
    query = query.is("poster_variant_path", null);
  }
  query = query.not("storage_path", "is", null);
  if (mediaFileId) {
    query = query.eq("id", mediaFileId);
  }
  if (userId) {
    query = query.eq("user_id", userId);
  }
  query = query.order("created_at", { ascending: true }).limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .map((row) => normalizeCandidateRow(row))
    .filter((row) => Boolean(row));
};

export const processCandidate = async ({
  supabase,
  candidate,
  ffmpegPath,
  seekSeconds,
  timeoutMs,
  force = false,
}) => {
  const existingVariantPath = await readExistingPosterVariantPath({
    supabase,
    mediaFileId: candidate.id,
  });
  if (existingVariantPath && !force) {
    await persistPosterPath({
      supabase,
      mediaFileId: candidate.id,
      userId: candidate.userId,
      posterPath: existingVariantPath,
    });
    return {
      id: candidate.id,
      status: "synced_existing_variant",
      posterPath: existingVariantPath,
    };
  }

  const videoBuffer = await downloadVideoBuffer(supabase, candidate.storagePath);
  const posterBuffer = await extractPosterBuffer({
    videoBuffer,
    sourcePath: candidate.storagePath,
    ffmpegPath,
    seekSeconds,
    timeoutMs,
  });
  const posterPath = await persistPosterVariant({
    supabase,
    candidate,
    posterBuffer,
  });
  return {
    id: candidate.id,
    status: existingVariantPath && force ? "regenerated" : "backfilled",
    posterPath,
  };
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const supabase = loadClient();
  const candidates = await fetchCandidates({
    supabase,
    limit: args.limit,
    mediaFileId: args.mediaFileId,
    userId: args.userId,
    force: args.force,
  });

  if (!args.apply) {
    process.stdout.write(
      JSON.stringify(
        {
          mode: "dry_run",
          force: args.force,
          candidateCount: candidates.length,
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
        timeoutMs: args.timeoutMs,
        force: args.force,
      });
      results.push(result);
    } catch (error) {
      results.push({
        id: candidate.id,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const summary = {
    mode: "apply",
    force: args.force,
    candidateCount: candidates.length,
    processed: results.length,
    backfilled: results.filter((row) => row.status === "backfilled").length,
    regenerated: results.filter((row) => row.status === "regenerated").length,
    syncedExistingVariant: results.filter((row) => row.status === "synced_existing_variant").length,
    failed: results.filter((row) => row.status === "failed").length,
    results,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `[backfill_video_posters] error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exit(1);
  });
}
