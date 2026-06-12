#!/usr/bin/env node
/* global URL */
/**
 * Backfill durable display derivatives for dashboard tutorial thumbnail uploads.
 *
 * Default mode is dry-run. Use `--apply --confirm-project-id <id>` to upload variants and update rows.
 */

import crypto from "node:crypto";
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
const ffmpegStatic = require("../node_modules/ffmpeg-static");

const THUMBNAIL_BUCKET = "dashboard_tutorial_thumbnails";
const SOURCE_PREFIX = "tutorial-thumbnails";
const VARIANT_PREFIX = "tutorial-thumbnail-variants";
const DEFAULT_LIMIT = 25;
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_PREVIEW_SECONDS = 3;
const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
const MAX_DISPLAY_BYTES = 5 * 1024 * 1024;
const VIDEO_PREVIEW_SCALE_FILTER =
  "scale=360:-2:force_original_aspect_ratio=decrease,pad=ceil(iw/2)*2:ceil(ih/2)*2";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FRONTEND_ROOT = path.join(REPO_ROOT, "frontend");

const MOTION_MIME_TYPES = new Set(["image/gif", "video/mp4", "video/quicktime", "video/webm"]);
const STILL_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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

const parseBooleanFlag = (argv, enabledToken, disabledToken) => {
  if (argv.includes(enabledToken)) return true;
  if (argv.includes(disabledToken)) return false;
  return null;
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

export const parseArgs = (argv) => {
  const apply = parseBooleanFlag(argv, "--apply", "--dry-run") ?? false;
  return {
    apply,
    limit: asPositiveInteger(readArgValue(argv, "--limit"), DEFAULT_LIMIT),
    timeoutMs: asPositiveInteger(readArgValue(argv, "--timeout-ms"), DEFAULT_TIMEOUT_MS),
    tutorialId: asTrimmedString(readArgValue(argv, "--tutorial-id")),
    confirmProjectId: asTrimmedString(readArgValue(argv, "--confirm-project-id")),
    ffmpegPath: asTrimmedString(readArgValue(argv, "--ffmpeg-path")) ?? ffmpegStatic ?? "ffmpeg",
    help: argv.includes("--help") || argv.includes("-h"),
  };
};

const usage = () => {
  process.stdout.write(
    [
      "Usage:",
      "  node frontend/scripts/backfill_dashboard_tutorial_thumbnail_derivatives.mjs [options]",
      "",
      "Options:",
      "  --dry-run                 Default. Generate variants in memory without mutating Supabase.",
      "  --apply                   Upload variants and update dashboard_tutorials rows.",
      "  --confirm-project-id <id> Required with --apply. Must match the active Supabase project id.",
      "  --limit <n>               Max candidate rows to inspect/process (default 25).",
      "  --tutorial-id <uuid>      Restrict to one dashboard_tutorials row.",
      "  --ffmpeg-path <path>      Override ffmpeg binary path.",
      "  --timeout-ms <n>          ffmpeg timeout per motion thumbnail (default 120000).",
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
    const [projectId] = hostname.split(".");
    return asTrimmedString(projectId);
  } catch {
    return null;
  }
};

const assertApplyTargetConfirmed = ({ apply, confirmProjectId, actualProjectId }) => {
  if (!apply) return;
  if (!actualProjectId) {
    throw new Error("Could not infer the active Supabase project id. Refusing --apply.");
  }
  if (!confirmProjectId) {
    throw new Error(`Refusing --apply without --confirm-project-id ${actualProjectId}.`);
  }
  if (confirmProjectId !== actualProjectId) {
    throw new Error(
      `Refusing --apply because --confirm-project-id ${confirmProjectId} does not match active project ${actualProjectId}.`
    );
  }
};

const loadClient = () => {
  loadEnvFile(path.join(REPO_ROOT, ".env.agent.local"));
  loadEnvFile(path.join(FRONTEND_ROOT, ".env.local"));
  loadEnvFile(path.join(REPO_ROOT, ".env.local"));

  const supabaseUrl = getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return {
    supabase: createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
    projectId: inferSupabaseProjectIdFromUrl(supabaseUrl),
  };
};

const normalizeStoragePath = (value) => {
  const trimmed = asTrimmedString(value);
  if (!trimmed) return null;
  return trimmed.replace(/^\/+/, "").replace(/^dashboard_tutorial_thumbnails\//, "");
};

const isSafeSourcePath = (storagePath) =>
  Boolean(
    storagePath &&
    storagePath.length <= 500 &&
    storagePath.startsWith(`${SOURCE_PREFIX}/`) &&
    !storagePath.startsWith("/") &&
    !storagePath.includes("//") &&
    !storagePath.includes("..") &&
    !storagePath.includes("\\")
  );

const normalizeMimeType = (value) => asTrimmedString(value)?.toLowerCase() ?? null;

const toBuffer = async (downloaded) => {
  if (!downloaded) throw new Error("source_download_empty");
  if (Buffer.isBuffer(downloaded)) return downloaded;
  if (downloaded instanceof ArrayBuffer) return Buffer.from(downloaded);
  if (ArrayBuffer.isView(downloaded)) {
    return Buffer.from(downloaded.buffer, downloaded.byteOffset, downloaded.byteLength);
  }
  if (typeof downloaded.arrayBuffer === "function") {
    return Buffer.from(await downloaded.arrayBuffer());
  }
  throw new Error("source_download_unreadable");
};

const createTempDir = async () =>
  fs.promises.mkdtemp(path.join(os.tmpdir(), "shortpulse-dashboard-thumbnail-"));

const removeTempDir = async (dir) => {
  try {
    await fs.promises.rm(dir, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
};

const extensionForSource = ({ storagePath, mimeType }) => {
  const fromPath = path
    .extname(storagePath ?? "")
    .replace(/^\./, "")
    .toLowerCase();
  if (fromPath) return fromPath;
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "mp4";
};

const createStillDerivative = async (sourceBuffer) => {
  const displayBuffer = await sharp(sourceBuffer, { failOn: "none" })
    .rotate()
    .resize({ width: 360, height: 360, fit: "cover", withoutEnlargement: true })
    .webp({ quality: 76, effort: 4 })
    .toBuffer();
  if (displayBuffer.byteLength <= 0 || displayBuffer.byteLength > MAX_DISPLAY_BYTES) {
    throw new Error("display_derivative_size_invalid");
  }
  return {
    displayBuffer,
    displayContentType: "image/webp",
    displayMediaType: "image",
    posterBuffer: null,
  };
};

const createMotionDerivative = async ({
  sourceBuffer,
  storagePath,
  mimeType,
  ffmpegPath,
  timeoutMs,
}) => {
  const tempDir = await createTempDir();
  const inputPath = path.join(tempDir, `source.${extensionForSource({ storagePath, mimeType })}`);
  const displayPath = path.join(tempDir, "display.mp4");
  const posterPath = path.join(tempDir, "poster.jpg");

  try {
    await fs.promises.writeFile(inputPath, sourceBuffer);
    await execFile(
      ffmpegPath,
      [
        "-y",
        "-i",
        inputPath,
        "-an",
        "-t",
        String(DEFAULT_PREVIEW_SECONDS),
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
        displayPath,
      ],
      { timeout: timeoutMs }
    );
    await execFile(
      ffmpegPath,
      [
        "-y",
        "-ss",
        "0.5",
        "-i",
        inputPath,
        "-vf",
        "thumbnail,scale=720:-2:force_original_aspect_ratio=decrease",
        "-frames:v",
        "1",
        "-q:v",
        "2",
        posterPath,
      ],
      { timeout: timeoutMs }
    );

    const displayBuffer = await fs.promises.readFile(displayPath);
    const posterBuffer = await fs.promises.readFile(posterPath);
    if (
      displayBuffer.byteLength <= 0 ||
      displayBuffer.byteLength > MAX_DISPLAY_BYTES ||
      posterBuffer.byteLength <= 0 ||
      posterBuffer.byteLength > MAX_DISPLAY_BYTES
    ) {
      throw new Error("motion_derivative_size_invalid");
    }
    return {
      displayBuffer,
      displayContentType: "video/mp4",
      displayMediaType: "video",
      posterBuffer,
    };
  } finally {
    await removeTempDir(tempDir);
  }
};

const normalizeCandidateRow = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value;
  const id = asTrimmedString(row.id);
  const title = asTrimmedString(row.title) ?? "";
  const sourcePath = normalizeStoragePath(row.thumbnail_storage_path);
  const sourceContentType = normalizeMimeType(row.thumbnail_content_type);
  const existingDisplayPath = normalizeStoragePath(row.thumbnail_display_storage_path);
  if (!id || !sourcePath || existingDisplayPath) return null;
  return { id, title, sourcePath, sourceContentType };
};

const loadCandidates = async ({ supabase, limit, tutorialId }) => {
  let query = supabase
    .from("dashboard_tutorials")
    .select(
      "id, title, thumbnail_storage_path, thumbnail_content_type, thumbnail_display_storage_path"
    )
    .not("thumbnail_storage_path", "is", null)
    .is("thumbnail_display_storage_path", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (tutorialId) {
    query = query.eq("id", tutorialId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message || "Unable to load dashboard tutorial candidates.");
  return (Array.isArray(data) ? data : []).map(normalizeCandidateRow).filter(Boolean);
};

const processCandidate = async ({ supabase, candidate, options }) => {
  if (!isSafeSourcePath(candidate.sourcePath)) {
    return { ...candidate, status: "skipped", reason: "unsafe_source_path" };
  }
  if (!candidate.sourceContentType) {
    return { ...candidate, status: "skipped", reason: "missing_source_content_type" };
  }
  if (
    !MOTION_MIME_TYPES.has(candidate.sourceContentType) &&
    !STILL_MIME_TYPES.has(candidate.sourceContentType)
  ) {
    return { ...candidate, status: "skipped", reason: "unsupported_source_content_type" };
  }

  const { data: downloaded, error: downloadError } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .download(candidate.sourcePath);
  if (downloadError || !downloaded) {
    throw new Error(downloadError?.message || "Unable to download source thumbnail.");
  }

  const sourceBuffer = await toBuffer(downloaded);
  if (sourceBuffer.byteLength <= 0 || sourceBuffer.byteLength > MAX_SOURCE_BYTES) {
    return { ...candidate, status: "skipped", reason: "source_size_invalid" };
  }

  const derivative = MOTION_MIME_TYPES.has(candidate.sourceContentType)
    ? await createMotionDerivative({
        sourceBuffer,
        storagePath: candidate.sourcePath,
        mimeType: candidate.sourceContentType,
        ffmpegPath: options.ffmpegPath,
        timeoutMs: options.timeoutMs,
      })
    : await createStillDerivative(sourceBuffer);

  const variantId = crypto.randomUUID();
  const displayStoragePath = `${VARIANT_PREFIX}/${variantId}/display.${
    derivative.displayContentType === "video/mp4" ? "mp4" : "webp"
  }`;
  const posterStoragePath = derivative.posterBuffer
    ? `${VARIANT_PREFIX}/${variantId}/poster.jpg`
    : null;

  if (options.apply) {
    const { error: displayUploadError } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(displayStoragePath, derivative.displayBuffer, {
        contentType: derivative.displayContentType,
        cacheControl: "31536000",
        upsert: false,
      });
    if (displayUploadError) throw new Error(displayUploadError.message || "Display upload failed.");

    if (posterStoragePath && derivative.posterBuffer) {
      const { error: posterUploadError } = await supabase.storage
        .from(THUMBNAIL_BUCKET)
        .upload(posterStoragePath, derivative.posterBuffer, {
          contentType: "image/jpeg",
          cacheControl: "31536000",
          upsert: false,
        });
      if (posterUploadError) throw new Error(posterUploadError.message || "Poster upload failed.");
    }

    const { error: updateError } = await supabase
      .from("dashboard_tutorials")
      .update({
        thumbnail_media_type: derivative.displayMediaType,
        thumbnail_display_storage_path: displayStoragePath,
        thumbnail_display_file_size_bytes: derivative.displayBuffer.byteLength,
        thumbnail_display_content_type: derivative.displayContentType,
        thumbnail_display_media_type: derivative.displayMediaType,
        thumbnail_poster_storage_path: posterStoragePath,
        thumbnail_poster_file_size_bytes: derivative.posterBuffer?.byteLength ?? null,
        thumbnail_poster_content_type: posterStoragePath ? "image/jpeg" : null,
      })
      .eq("id", candidate.id);
    if (updateError) throw new Error(updateError.message || "Tutorial row update failed.");
  }

  return {
    ...candidate,
    status: options.apply ? "updated" : "dry_run_ready",
    displayStoragePath,
    displayContentType: derivative.displayContentType,
    displayMediaType: derivative.displayMediaType,
    displayBytes: derivative.displayBuffer.byteLength,
    posterStoragePath,
    posterBytes: derivative.posterBuffer?.byteLength ?? null,
  };
};

const main = async () => {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  const { supabase, projectId } = loadClient();
  assertApplyTargetConfirmed({
    apply: options.apply,
    confirmProjectId: options.confirmProjectId,
    actualProjectId: projectId,
  });

  const candidates = await loadCandidates({
    supabase,
    limit: options.limit,
    tutorialId: options.tutorialId,
  });
  const results = [];
  for (const candidate of candidates) {
    try {
      results.push(await processCandidate({ supabase, candidate, options }));
    } catch (error) {
      results.push({
        ...candidate,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        projectId,
        candidateCount: candidates.length,
        results,
      },
      null,
      2
    )}\n`
  );
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
