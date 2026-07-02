/**
 * Media preview resolver endpoint for legacy rows with broken storage paths.
 * Resolves candidate object names by media_file id, then returns signed URLs.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  resolvePreviewProfileForSurface,
  type MediaPreviewTransformProfile,
} from "../../../lib/mediaPreviewTransformProfile";
import { isUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import {
  resolvePreferredMediaDirectPreviewUrl,
  resolvePreferredMediaSigningStoragePath,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logAuthVerificationUnavailableResponse } from "../../../lib/server/api/authFailureLogging";
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

type StorageObjectRow = {
  name?: unknown;
};

type StorageObjectQueryClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string
      ) => {
        in: (
          column: string,
          values: string[]
        ) => Promise<{ data?: StorageObjectRow[] | null; error?: { message?: string } | null }>;
      };
    };
  };
};

type StorageListObject = {
  name?: unknown;
};

type StorageVerificationBucketClient = {
  list?: (
    path?: string,
    options?: {
      limit?: number;
      search?: string;
    }
  ) => Promise<{ data?: StorageListObject[] | null; error?: { message?: string } | null }>;
};

type SupabaseAdminWithStorageVerification = {
  schema?: unknown;
  rpc?: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data?: unknown; error?: { message?: string } | null }>;
  storage?: {
    from?: (bucket: string) => StorageVerificationBucketClient;
  };
};

const MEDIA_BUCKET = "media_library";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const MIN_SIGNED_URL_TTL_SECONDS = 60;
const MAX_SIGNED_URL_TTL_SECONDS = 3600;
const MAX_MEDIA_IDS = 40;
const MAX_BASENAME_LOOKUP_CONCURRENCY = 6;
const ALLOWED_SURFACE_VALUES = new Set([
  "media-library-modal",
  "media-library-panel",
  "elements-media-panel",
  "character-media-panel",
  "reference-grid",
  "quick-slot",
  "character-grid",
  "detail-modal",
]);
const BROWSE_SURFACE_VALUES = new Set([
  "media-library-modal",
  "media-library-panel",
  "elements-media-panel",
  "character-media-panel",
]);

const resolveBrowseSurfaceSigningStoragePaths = (row: MediaLookupRow, userId: string): string[] => {
  const candidates = [
    resolvePreferredMediaSigningStoragePath(row, userId),
    typeof row.storage_path === "string" ? row.storage_path.trim() : null,
  ];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    deduped.push(candidate);
  }
  return deduped;
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

const toSafeTelemetryLabel = (
  value: unknown,
  allowed?: Set<string>,
  fallback = "unknown"
): string => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (allowed && !allowed.has(normalized)) return fallback;
  return normalized;
};

const toPreviewProfile = (value: unknown): MediaPreviewTransformProfile | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "media-library-modal-image-card" ||
    normalized === "media-library-panel-image-card"
  ) {
    return normalized;
  }
  return null;
};

const basenameOf = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.split("?")[0].trim();
  if (!normalized) return null;
  const parts = normalized.split("/").filter(Boolean);
  const base = parts[parts.length - 1] ?? "";
  return base.trim() || null;
};

const basenameLookupKey = (basename: string): string => basename.trim().toLowerCase();

const isResolvableBasename = (basename: string): boolean =>
  Boolean(
    basename &&
    !basename.includes("/") &&
    !basename.includes("\\") &&
    !basename.includes("%") &&
    !basename.includes("_")
  );

const splitStoragePath = (storagePath: string): { folder: string; name: string } | null => {
  const segments = storagePath
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
  const name = segments.pop();
  if (!name) return null;
  return {
    folder: segments.join("/"),
    name,
  };
};

const resolveExistingStorageObjectPaths = async ({
  supabaseAdmin,
  paths,
}: {
  supabaseAdmin: SupabaseAdminWithStorageVerification;
  paths: string[];
}): Promise<Set<string>> => {
  if (!paths.length) return new Set();
  let schemaErrorMessage: string | null = null;
  if (typeof supabaseAdmin.schema === "function") {
    try {
      const storageSchemaClient = supabaseAdmin.schema("storage") as StorageObjectQueryClient;
      const { data, error } = await storageSchemaClient
        .from("objects")
        .select("name")
        .eq("bucket_id", MEDIA_BUCKET)
        .in("name", paths);
      if (!error) {
        return new Set(
          (data ?? [])
            .map((row) => (typeof row.name === "string" ? row.name.trim() : ""))
            .filter((path): path is string => Boolean(path))
        );
      }
      schemaErrorMessage = error.message || "Unable to verify media preview storage objects.";
    } catch (error) {
      schemaErrorMessage =
        error instanceof Error ? error.message : "Unable to verify media preview storage objects.";
    }
  }

  const storageBucket = supabaseAdmin.storage?.from?.(MEDIA_BUCKET);
  if (typeof storageBucket?.list !== "function") {
    if (schemaErrorMessage) {
      throw new Error(schemaErrorMessage);
    }
    return new Set(paths);
  }

  const existingPaths = new Set<string>();
  const uniquePaths = Array.from(new Set(paths.map((path) => path.trim()).filter(Boolean)));
  for (const path of uniquePaths) {
    const splitPath = splitStoragePath(path);
    if (!splitPath) continue;
    const { data, error } = await storageBucket.list(splitPath.folder, {
      limit: 100,
      search: splitPath.name,
    });
    if (error) {
      throw new Error(error.message || "Unable to verify media preview storage objects.");
    }
    const exists = (data ?? []).some((row) => row.name === splitPath.name);
    if (exists) {
      existingPaths.add(path);
    }
  }
  return existingPaths;
};

const resolveObjectByBasename = async (
  userId: string,
  basename: string
): Promise<string | null> => {
  if (!isResolvableBasename(basename)) {
    return null;
  }
  const supabaseAdmin = getSupabaseAdmin() as SupabaseAdminWithStorageVerification;
  if (typeof supabaseAdmin.rpc !== "function") return null;
  const { data, error } = await supabaseAdmin.rpc("resolve_media_storage_object_by_basename", {
    p_user_id: userId,
    p_basename: basename,
  });
  if (error) return null;
  const name = typeof data === "string" ? data.trim() : "";
  return name || null;
};

const resolveBasenameMatchesBounded = async ({
  userId,
  basenames,
}: {
  userId: string;
  basenames: string[];
}): Promise<Map<string, string | null>> => {
  const dedupedByKey = new Map<string, string>();
  for (const rawBasename of basenames) {
    const basename = rawBasename.trim();
    if (!basename) continue;
    if (!isResolvableBasename(basename)) continue;
    const key = basenameLookupKey(basename);
    if (!key || dedupedByKey.has(key)) continue;
    dedupedByKey.set(key, basename);
  }
  const jobs = Array.from(dedupedByKey.entries());
  const results = new Map<string, string | null>();
  if (!jobs.length) return results;

  const workerCount = Math.max(1, Math.min(MAX_BASENAME_LOOKUP_CONCURRENCY, jobs.length));
  let cursor = 0;
  const runWorker = async () => {
    while (true) {
      const nextIndex = cursor;
      cursor += 1;
      const entry = jobs[nextIndex];
      if (!entry) return;
      const [key, basename] = entry;
      const matchedObject = await resolveObjectByBasename(userId, basename).catch(() => null);
      results.set(key, matchedObject);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
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

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-resolve-previews.auth",
      scope: "app",
    });
    return res.status(500).json({
      error: "Failed to resolve media previews",
    });
  }
  if (!user) {
    await logAuthVerificationUnavailableResponse({
      req,
      res,
      routeLabel: "media-resolve-previews.auth",
    });
    return;
  }
  const userId = user.id;

  try {
    const body =
      typeof req.body === "string" ? (JSON.parse(req.body) as Record<string, unknown>) : req.body;
    const mediaIds = toSafeMediaIdList(body?.ids);
    if (!mediaIds.length) {
      return res.status(200).json({ urls: {} });
    }

    const expiresInSeconds = toSafeExpiresInSeconds(body?.expiresInSeconds);
    const telemetrySurface = toSafeTelemetryLabel(body?.surface, ALLOWED_SURFACE_VALUES);
    const requestedPreviewProfile = toPreviewProfile(body?.previewProfile);
    const resolvedPreviewProfile =
      requestedPreviewProfile ?? resolvePreviewProfileForSurface(telemetrySurface);
    const preferTrustedDirectPreviewFirst = BROWSE_SURFACE_VALUES.has(telemetrySurface);
    const supabaseAdmin = getSupabaseAdmin();
    const { data: rawRows, error: rowsError } = await supabaseAdmin
      .from("media_files")
      .select(
        "id, user_id, filename, storage_path, file_type, metadata, thumb_variant_path, poster_variant_path, preview_variant_path"
      )
      .eq("user_id", userId)
      .in("id", mediaIds);
    if (rowsError) {
      throw new Error(rowsError.message || "Failed to resolve media rows.");
    }

    const rows = (rawRows ?? []) as MediaLookupRow[];
    const rowById = new Map(rows.map((row) => [row.id, row]));
    const candidatesById = new Map<string, string[]>();
    const allCandidates: string[] = [];
    const directPreviewUrlById = new Map<string, string>();
    for (const row of rows) {
      const directPreviewUrl = resolvePreferredMediaDirectPreviewUrl(row, userId);
      if (directPreviewUrl) {
        directPreviewUrlById.set(row.id, directPreviewUrl);
        if (preferTrustedDirectPreviewFirst) {
          continue;
        }
      }
      const candidates = (
        preferTrustedDirectPreviewFirst
          ? resolveBrowseSurfaceSigningStoragePaths(row, userId)
          : resolveMediaSigningStoragePaths(row, userId)
      ).filter((candidate) => isUserScopedMediaStoragePath(candidate, userId));
      candidatesById.set(row.id, candidates);
      allCandidates.push(...candidates);
    }

    const existingPaths = new Set<string>();
    const dedupedCandidates = Array.from(new Set(allCandidates));
    if (dedupedCandidates.length) {
      const resolvedExistingPaths = await resolveExistingStorageObjectPaths({
        supabaseAdmin,
        paths: dedupedCandidates,
      });
      for (const path of resolvedExistingPaths) existingPaths.add(path);
    }

    const resolvedPathById = new Map<string, string>();
    const basenameCandidatesById = new Map<string, string[]>();
    const fallbackBasenames: string[] = [];

    for (const row of rows) {
      const candidates = candidatesById.get(row.id) ?? [];
      const fromCandidates = candidates.find((candidate) => existingPaths.has(candidate));
      if (fromCandidates) {
        resolvedPathById.set(row.id, fromCandidates);
        continue;
      }

      const directPreviewUrl = resolvePreferredMediaDirectPreviewUrl(row, userId);
      if (directPreviewUrl) {
        directPreviewUrlById.set(row.id, directPreviewUrl);
        continue;
      }

      const storagePathBasename = row.storage_path
        ? isUserScopedMediaStoragePath(row.storage_path, userId)
          ? basenameOf(row.storage_path)
          : null
        : null;
      const basenameCandidates = Array.from(
        new Set([basenameOf(row.filename), storagePathBasename].filter(Boolean) as string[])
      ).filter(isResolvableBasename);
      if (!basenameCandidates.length) continue;
      basenameCandidatesById.set(row.id, basenameCandidates);
      fallbackBasenames.push(...basenameCandidates);
    }

    const basenameMatchByKey = await resolveBasenameMatchesBounded({
      userId,
      basenames: fallbackBasenames,
    });
    const fallbackLookupCount = basenameMatchByKey.size;

    for (const row of rows) {
      if (resolvedPathById.has(row.id)) continue;
      if (preferTrustedDirectPreviewFirst && directPreviewUrlById.has(row.id)) continue;
      const basenameCandidates = basenameCandidatesById.get(row.id) ?? [];
      for (const basename of basenameCandidates) {
        const matchedObject = basenameMatchByKey.get(basenameLookupKey(basename)) ?? null;
        if (!matchedObject || !isUserScopedMediaStoragePath(matchedObject, userId)) continue;
        resolvedPathById.set(row.id, matchedObject);
        break;
      }
    }

    const pathsToSign = Array.from(new Set(Array.from(resolvedPathById.values()))).filter((path) =>
      isUserScopedMediaStoragePath(path, userId)
    );
    const signedUrlByPath = new Map<string, string | null>();
    if (pathsToSign.length) {
      await Promise.all(
        pathsToSign.map(async (path) => {
          const { data, error } = await supabaseAdmin.storage
            .from(MEDIA_BUCKET)
            .createSignedUrl(path, expiresInSeconds);
          if (error) {
            signedUrlByPath.set(path, null);
            return;
          }
          const signedUrl = data?.signedUrl;
          signedUrlByPath.set(
            path,
            typeof signedUrl === "string" && signedUrl.trim() ? signedUrl : null
          );
        })
      );
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
      urls[mediaId] =
        directPreviewUrlById.get(mediaId) ?? resolvePreferredMediaDirectPreviewUrl(row, userId);
    }

    res.setHeader("x-shortpulse-media-resolve-row-count", String(mediaIds.length));
    res.setHeader(
      "x-shortpulse-media-resolve-fallback-lookups",
      String(Math.max(0, fallbackLookupCount))
    );
    res.setHeader("x-shortpulse-media-resolve-surface", telemetrySurface);
    res.setHeader("x-shortpulse-media-resolve-preview-profile", resolvedPreviewProfile);

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
    });
  }
}
