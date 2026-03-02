/**
 * Media preview resolver endpoint for legacy rows with broken storage paths.
 * Resolves candidate object names by media_file id, then returns signed URLs.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type ResolvePreviewsSuccessResponse = {
  urls: Record<string, string | null>;
};

type ResolvePreviewsErrorResponse = {
  error: string;
  details?: string;
};

type MediaLookupRow = {
  id: string;
  user_id: string;
  filename: string | null;
  storage_path: string | null;
  file_type: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
};

const MEDIA_BUCKET = "media_library";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const MIN_SIGNED_URL_TTL_SECONDS = 60;
const MAX_SIGNED_URL_TTL_SECONDS = 3600;
const MAX_MEDIA_IDS = 40;
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;

const isUserScopedStoragePath = (path: string, userId: string): boolean => {
  const normalized = path.trim();
  if (!normalized) return false;
  if (normalized.startsWith("/") || normalized.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalized)) return false;
  return normalized.startsWith(`${userId}/`);
};

const toSafeMediaIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!id) continue;
    deduped.add(id);
    if (deduped.size >= MAX_MEDIA_IDS) break;
  }
  return Array.from(deduped);
};

const toSafeExpiresInSeconds = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_SIGNED_URL_TTL_SECONDS;
  const normalized = Math.trunc(parsed);
  if (normalized < MIN_SIGNED_URL_TTL_SECONDS) return MIN_SIGNED_URL_TTL_SECONDS;
  if (normalized > MAX_SIGNED_URL_TTL_SECONDS) return MAX_SIGNED_URL_TTL_SECONDS;
  return normalized;
};

const basenameOf = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.split("?")[0].trim();
  if (!normalized) return null;
  const parts = normalized.split("/").filter(Boolean);
  const base = parts[parts.length - 1] ?? "";
  return base.trim() || null;
};

const resolveObjectByBasename = async (
  userId: string,
  basename: string
): Promise<string | null> => {
  if (
    !basename ||
    basename.includes("/") ||
    basename.includes("\\") ||
    basename.includes("%") ||
    basename.includes("_")
  ) {
    return null;
  }
  const supabaseAdmin = getSupabaseAdmin();
  const pattern = `${userId}/%/${basename}`;
  const { data, error } = await supabaseAdmin
    .schema("storage")
    .from("objects")
    .select("name")
    .eq("bucket_id", MEDIA_BUCKET)
    .ilike("name", pattern)
    .limit(1);
  if (error) return null;
  const match = ((data ?? []) as Array<{ name?: string | null }>)[0];
  const name = typeof match?.name === "string" ? match.name.trim() : "";
  return name || null;
};

/**
 * Resolves and signs preview URLs for media rows by id.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResolvePreviewsSuccessResponse | ResolvePreviewsErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body =
      typeof req.body === "string" ? (JSON.parse(req.body) as Record<string, unknown>) : req.body;
    const mediaIds = toSafeMediaIdList(body?.ids);
    if (!mediaIds.length) {
      return res.status(200).json({ urls: {} });
    }

    const expiresInSeconds = toSafeExpiresInSeconds(body?.expiresInSeconds);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rawRows, error: rowsError } = await supabaseAdmin
      .from("media_files")
      .select(
        "id, user_id, filename, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
      )
      .eq("user_id", user.id)
      .in("id", mediaIds);
    if (rowsError) {
      return res.status(500).json({
        error: "Failed to resolve media rows",
        details: rowsError.message,
      });
    }

    const rows = (rawRows ?? []) as MediaLookupRow[];
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const candidatesById = new Map<string, string[]>();
    const allCandidates: string[] = [];
    for (const row of rows) {
      const candidates = resolveMediaSigningStoragePaths(row, user.id).filter((candidate) =>
        isUserScopedStoragePath(candidate, user.id)
      );
      candidatesById.set(row.id, candidates);
      allCandidates.push(...candidates);
    }

    const existingPaths = new Set<string>();
    const dedupedCandidates = Array.from(new Set(allCandidates));
    if (dedupedCandidates.length) {
      const { data: existingRows, error: existingError } = await supabaseAdmin
        .schema("storage")
        .from("objects")
        .select("name")
        .eq("bucket_id", MEDIA_BUCKET)
        .in("name", dedupedCandidates);
      if (!existingError) {
        for (const row of (existingRows ?? []) as Array<{ name?: string | null }>) {
          const name = typeof row.name === "string" ? row.name.trim() : "";
          if (name) existingPaths.add(name);
        }
      }
    }

    const resolvedPathById = new Map<string, string>();
    const basenameLookupPromiseByName = new Map<string, Promise<string | null>>();
    let fallbackLookupCount = 0;
    const resolveObjectByBasenameCached = (basename: string): Promise<string | null> => {
      const key = basename.trim().toLowerCase();
      if (!key) return Promise.resolve(null);
      const existing = basenameLookupPromiseByName.get(key);
      if (existing) return existing;
      fallbackLookupCount += 1;
      const task = resolveObjectByBasename(user.id, basename).catch(() => null);
      basenameLookupPromiseByName.set(key, task);
      return task;
    };

    for (const row of rows) {
      const candidates = candidatesById.get(row.id) ?? [];
      const fromCandidates = candidates.find((candidate) => existingPaths.has(candidate));
      if (fromCandidates) {
        resolvedPathById.set(row.id, fromCandidates);
        continue;
      }

      const basenameCandidates = Array.from(
        new Set(
          [basenameOf(row.filename), basenameOf(row.storage_path)].filter(Boolean) as string[]
        )
      );
      for (const basename of basenameCandidates) {
        const matchedObject = await resolveObjectByBasenameCached(basename);
        if (!matchedObject || !isUserScopedStoragePath(matchedObject, user.id)) continue;
        resolvedPathById.set(row.id, matchedObject);
        break;
      }
    }

    const pathsToSign = Array.from(new Set(Array.from(resolvedPathById.values()))).filter((path) =>
      isUserScopedStoragePath(path, user.id)
    );
    const signedUrlByPath = new Map<string, string | null>();
    if (pathsToSign.length) {
      const { data: signedRows, error: signedError } = await supabaseAdmin.storage
        .from(MEDIA_BUCKET)
        .createSignedUrls(pathsToSign, expiresInSeconds);
      if (signedError) {
        return res.status(500).json({
          error: "Failed to sign resolved media paths",
          details: signedError.message,
        });
      }
      for (const signedRow of signedRows ?? []) {
        const path =
          typeof (signedRow as { path?: unknown }).path === "string"
            ? ((signedRow as { path: string }).path || "").trim()
            : "";
        if (!path) continue;
        const signedUrl = (signedRow as { signedUrl?: unknown }).signedUrl;
        signedUrlByPath.set(
          path,
          typeof signedUrl === "string" && signedUrl.trim() ? signedUrl : null
        );
      }
    }

    const urls: Record<string, string | null> = {};
    for (const mediaId of mediaIds) {
      const row = rowById.get(mediaId);
      if (!row) {
        urls[mediaId] = null;
        continue;
      }
      const resolvedPath = resolvedPathById.get(mediaId);
      const signedUrl = resolvedPath ? (signedUrlByPath.get(resolvedPath) ?? null) : null;
      if (signedUrl) {
        urls[mediaId] = signedUrl;
        continue;
      }
      urls[mediaId] = resolveMediaDirectPreviewUrls(row, user.id)[0] ?? null;
    }

    res.setHeader("x-shortpulse-media-resolve-row-count", String(mediaIds.length));
    res.setHeader(
      "x-shortpulse-media-resolve-fallback-lookups",
      String(Math.max(0, fallbackLookupCount))
    );

    return res.status(200).json({ urls });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-resolve-previews",
      user,
    });
    return res.status(500).json({
      error: "Failed to resolve media previews",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
