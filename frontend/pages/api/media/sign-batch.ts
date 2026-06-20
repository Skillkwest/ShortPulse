/**
 * Batch-signed URL endpoint for media-library previews.
 * Requires a bearer-authenticated user and only signs user-scoped storage paths.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  resolvePreviewProfileForSurface,
  type MediaPreviewTransformProfile,
} from "../../../lib/mediaPreviewTransformProfile";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type SignBatchSuccessResponse = {
  urls: Record<string, string | null>;
};

type SignBatchErrorResponse = {
  error: string;
  details?: string;
};

type SignedUrlRow = {
  path?: unknown;
  signedUrl?: unknown;
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

type SupabaseAdminWithStorageSchema = {
  schema?: unknown;
  storage?: {
    from?: (bucket: string) => StorageVerificationBucketClient;
  };
};

const MEDIA_BUCKET = "media_library";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const MIN_SIGNED_URL_TTL_SECONDS = 60;
const MAX_SIGNED_URL_TTL_SECONDS = 3600;
const MAX_SIGN_PATHS = 60;
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;
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
const ALLOWED_QUERY_MODE_VALUES = new Set(["default", "search"]);

const toSafePath = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith("/") || normalized.includes("\\")) return null;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalized)) return null;
  return normalized;
};

const toSafePathList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const rawPath of value) {
    const path = toSafePath(rawPath);
    if (!path) continue;
    unique.add(path);
    if (unique.size >= MAX_SIGN_PATHS) break;
  }
  return Array.from(unique);
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
    normalized === "media-library-panel-image-card" ||
    normalized === "project-card-preview"
  ) {
    return normalized;
  }
  return null;
};

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
  supabaseAdmin: SupabaseAdminWithStorageSchema;
  paths: string[];
}): Promise<Set<string>> => {
  if (!paths.length) return new Set();
  let schemaErrorMessage: string | null = null;
  if (typeof supabaseAdmin.schema !== "function") {
    schemaErrorMessage = null;
  } else {
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
      schemaErrorMessage = error.message || "Unable to verify media storage objects.";
    } catch (error) {
      schemaErrorMessage =
        error instanceof Error ? error.message : "Unable to verify media storage objects.";
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
      throw new Error(error.message || "Unable to verify media storage objects.");
    }
    const exists = (data ?? []).some((row) => row.name === splitPath.name);
    if (exists) {
      existingPaths.add(path);
    }
  }
  return existingPaths;
};

/**
 * Signs media storage paths in a single call for lower list-render latency.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SignBatchSuccessResponse | SignBatchErrorResponse>
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
      routeLabel: "media-sign-batch.auth",
      scope: "app",
    });
    return res.status(500).json({
      error: "Failed to sign media paths",
    });
  }
  if (!user) return;

  try {
    const body =
      typeof req.body === "string" ? (JSON.parse(req.body) as Record<string, unknown>) : req.body;
    const requestedBucket = typeof body?.bucket === "string" ? body.bucket.trim() : MEDIA_BUCKET;
    if (requestedBucket !== MEDIA_BUCKET) {
      return res.status(400).json({ error: "Invalid bucket" });
    }

    const paths = toSafePathList(body?.paths);
    if (!paths.length) {
      return res.status(200).json({ urls: {} });
    }
    const telemetrySurface = toSafeTelemetryLabel(body?.surface, ALLOWED_SURFACE_VALUES);
    const telemetryQueryMode = toSafeTelemetryLabel(
      body?.queryMode,
      ALLOWED_QUERY_MODE_VALUES,
      "default"
    );
    const telemetryTab = toSafeTelemetryLabel(body?.tab);
    const requestedPreviewProfile = toPreviewProfile(body?.previewProfile);
    const resolvedPreviewProfile =
      requestedPreviewProfile ?? resolvePreviewProfileForSurface(telemetrySurface);

    const userPrefix = `${user.id}/`;
    const hasOutOfScopePath = paths.some((path) => !path.startsWith(userPrefix));
    if (hasOutOfScopePath) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const expiresInSeconds = toSafeExpiresInSeconds(body?.expiresInSeconds);
    const supabaseAdmin = getSupabaseAdmin();
    const storage = supabaseAdmin.storage.from(MEDIA_BUCKET);
    const urls: Record<string, string | null> = {};
    for (const path of paths) {
      urls[path] = null;
    }

    const existingPaths = await resolveExistingStorageObjectPaths({
      supabaseAdmin,
      paths,
    });
    const signablePaths = paths.filter((path) => existingPaths.has(path));

    if (signablePaths.length) {
      const { data, error } = await storage.createSignedUrls(signablePaths, expiresInSeconds);
      if (!error) {
        for (const signedItem of data ?? []) {
          const path = toSafePath((signedItem as SignedUrlRow).path);
          if (!path || !(path in urls)) continue;
          const signedUrl = (signedItem as SignedUrlRow).signedUrl;
          urls[path] = typeof signedUrl === "string" && signedUrl.trim() ? signedUrl : null;
        }
      }
    }

    res.setHeader("x-shortpulse-media-sign-surface", telemetrySurface);
    res.setHeader("x-shortpulse-media-sign-query-mode", telemetryQueryMode);
    res.setHeader("x-shortpulse-media-sign-tab", telemetryTab);
    res.setHeader("x-shortpulse-media-sign-path-count", String(paths.length));
    res.setHeader("x-shortpulse-media-sign-preview-profile", resolvedPreviewProfile);

    return res.status(200).json({ urls });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-sign-batch",
      user,
    });
    return res.status(500).json({
      error: "Failed to sign media paths",
    });
  }
}
