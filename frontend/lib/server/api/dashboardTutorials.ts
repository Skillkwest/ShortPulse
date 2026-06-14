/**
 * Server helpers for admin-managed dashboard tutorials.
 * Centralizes tutorial validation, row serialization, and global ordered persistence.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";
import {
  DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET,
  DASHBOARD_TUTORIAL_THUMBNAIL_SIGNED_URL_TTL_SECONDS,
  isDashboardTutorialThumbnailVariantStoragePath,
  isDashboardTutorialThumbnailStoragePath,
  normalizeDashboardTutorialThumbnailContentType,
  type DashboardTutorialThumbnailDisplayContentType,
  type DashboardTutorialThumbnailContentType,
} from "./dashboardTutorialAssets";

export const DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH = 120;
export const DASHBOARD_TUTORIAL_YOUTUBE_URL_MAX_LENGTH = 500;
export const DASHBOARD_TUTORIAL_THUMBNAIL_URL_MAX_LENGTH = 1000;
export const DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PATH_MAX_LENGTH = 500;
export const DASHBOARD_TUTORIAL_THUMBNAIL_ALT_MAX_LENGTH = 160;
export const DASHBOARD_TUTORIAL_PUBLIC_LIMIT = 24;

export const DASHBOARD_TUTORIAL_THUMBNAIL_MEDIA_TYPES = ["image", "video"] as const;
export const DASHBOARD_TUTORIAL_YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

export type DashboardTutorialThumbnailMediaType =
  (typeof DASHBOARD_TUTORIAL_THUMBNAIL_MEDIA_TYPES)[number];

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type RawDashboardTutorial = {
  id?: unknown;
  title?: unknown;
  youtube_url?: unknown;
  thumbnail_url?: unknown;
  thumbnail_storage_path?: unknown;
  thumbnail_file_size_bytes?: unknown;
  thumbnail_content_type?: unknown;
  thumbnail_media_type?: unknown;
  thumbnail_display_storage_path?: unknown;
  thumbnail_display_file_size_bytes?: unknown;
  thumbnail_display_content_type?: unknown;
  thumbnail_display_media_type?: unknown;
  thumbnail_poster_storage_path?: unknown;
  thumbnail_poster_file_size_bytes?: unknown;
  thumbnail_poster_content_type?: unknown;
  thumbnail_alt?: unknown;
  display_order?: unknown;
  is_active?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

export type DashboardTutorial = {
  id: string;
  title: string;
  youtubeUrl: string;
  thumbnailUrl: string;
  thumbnailStoragePath: string | null;
  thumbnailFileSizeBytes: number | null;
  thumbnailContentType: DashboardTutorialThumbnailContentType | null;
  thumbnailMediaType: DashboardTutorialThumbnailMediaType;
  thumbnailDisplayStoragePath: string | null;
  thumbnailDisplayFileSizeBytes: number | null;
  thumbnailDisplayContentType: DashboardTutorialThumbnailDisplayContentType | null;
  thumbnailDisplayMediaType: DashboardTutorialThumbnailMediaType | null;
  thumbnailPosterUrl: string | null;
  thumbnailPosterStoragePath: string | null;
  thumbnailPosterFileSizeBytes: number | null;
  thumbnailPosterContentType: "image/jpeg" | null;
  thumbnailAlt: string;
  displayOrder: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DashboardTutorialInputValidation = {
  tutorial: Omit<DashboardTutorial, "id" | "createdAt" | "updatedAt">;
  error: string | null;
};

const asTrimmed = (value: unknown): string => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const isThumbnailMediaType = (value: string): value is DashboardTutorialThumbnailMediaType =>
  DASHBOARD_TUTORIAL_THUMBNAIL_MEDIA_TYPES.includes(value as DashboardTutorialThumbnailMediaType);

const normalizeDashboardTutorialThumbnailDisplayContentType = (
  value: unknown
): DashboardTutorialThumbnailDisplayContentType | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/webp" || normalized === "video/mp4") {
    return normalized;
  }
  return null;
};

const normalizeDashboardTutorialPosterContentType = (value: unknown): "image/jpeg" | null =>
  typeof value === "string" && value.trim().toLowerCase() === "image/jpeg" ? "image/jpeg" : null;

const isHttpsUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};

const isAllowedYoutubeUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      DASHBOARD_TUTORIAL_YOUTUBE_HOSTS.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
};

const asNullablePositiveInteger = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) return null;
  return value;
};

const collectDashboardTutorialThumbnailPaths = (rows: unknown[]): string[] => {
  const storagePaths = new Set<string>();
  rows.forEach((value) => {
    if (!value || typeof value !== "object") return;
    const row = value as RawDashboardTutorial;
    const thumbnailStoragePath = asTrimmed(row.thumbnail_storage_path);
    const thumbnailDisplayStoragePath = asTrimmed(row.thumbnail_display_storage_path);
    const thumbnailPosterStoragePath = asTrimmed(row.thumbnail_poster_storage_path);
    if (
      thumbnailDisplayStoragePath &&
      isDashboardTutorialThumbnailVariantStoragePath(thumbnailDisplayStoragePath)
    ) {
      storagePaths.add(thumbnailDisplayStoragePath);
    } else if (
      thumbnailStoragePath &&
      isDashboardTutorialThumbnailStoragePath(thumbnailStoragePath)
    ) {
      storagePaths.add(thumbnailStoragePath);
    }
    if (
      thumbnailPosterStoragePath &&
      isDashboardTutorialThumbnailVariantStoragePath(thumbnailPosterStoragePath)
    ) {
      storagePaths.add(thumbnailPosterStoragePath);
    }
  });
  return [...storagePaths];
};

const signDashboardTutorialThumbnailUrls = async (
  supabaseAdmin: SupabaseAdminClient,
  storagePaths: string[]
): Promise<Map<string, string | null>> => {
  const signedUrlByPath = new Map<string, string | null>();
  storagePaths.forEach((path) => signedUrlByPath.set(path, null));
  if (storagePaths.length === 0) return signedUrlByPath;

  const { data, error } = await supabaseAdmin.storage
    .from(DASHBOARD_TUTORIAL_THUMBNAIL_BUCKET)
    .createSignedUrls(storagePaths, DASHBOARD_TUTORIAL_THUMBNAIL_SIGNED_URL_TTL_SECONDS);
  if (error) {
    throw new Error(error.message || "Failed to sign dashboard tutorial thumbnail URLs.");
  }

  (Array.isArray(data) ? data : []).forEach((signedUrlResult, index) => {
    const result = signedUrlResult as { path?: unknown; signedUrl?: unknown };
    const path =
      typeof result.path === "string" && result.path.length > 0 ? result.path : storagePaths[index];
    signedUrlByPath.set(
      path,
      typeof result.signedUrl === "string" && result.signedUrl.trim().length > 0
        ? result.signedUrl
        : null
    );
  });

  return signedUrlByPath;
};

const toDashboardTutorial = (
  value: unknown,
  signedUrlByPath: Map<string, string | null>
): DashboardTutorial | null => {
  if (!value || typeof value !== "object") return null;
  const row = value as RawDashboardTutorial;
  const id = typeof row.id === "string" ? row.id : "";
  const title = asTrimmed(row.title);
  const youtubeUrl = asTrimmed(row.youtube_url);
  const storedThumbnailUrl = asTrimmed(row.thumbnail_url);
  const thumbnailStoragePath = asTrimmed(row.thumbnail_storage_path);
  const thumbnailDisplayStoragePath = asTrimmed(row.thumbnail_display_storage_path);
  const thumbnailDisplayMediaTypeRaw = asTrimmed(row.thumbnail_display_media_type);
  const thumbnailPosterStoragePath = asTrimmed(row.thumbnail_poster_storage_path);
  const thumbnailMediaTypeRaw =
    thumbnailDisplayMediaTypeRaw || asTrimmed(row.thumbnail_media_type) || "image";
  const signableThumbnailStoragePath = thumbnailDisplayStoragePath || thumbnailStoragePath;
  const thumbnailUrl = signableThumbnailStoragePath
    ? (signedUrlByPath.get(signableThumbnailStoragePath) ?? "")
    : storedThumbnailUrl;
  const thumbnailPosterUrl = thumbnailPosterStoragePath
    ? (signedUrlByPath.get(thumbnailPosterStoragePath) ?? null)
    : null;

  if (
    !id ||
    !title ||
    !youtubeUrl ||
    !thumbnailUrl ||
    (thumbnailStoragePath && !isDashboardTutorialThumbnailStoragePath(thumbnailStoragePath)) ||
    (thumbnailDisplayStoragePath &&
      !isDashboardTutorialThumbnailVariantStoragePath(thumbnailDisplayStoragePath)) ||
    (thumbnailPosterStoragePath &&
      !isDashboardTutorialThumbnailVariantStoragePath(thumbnailPosterStoragePath)) ||
    !isThumbnailMediaType(thumbnailMediaTypeRaw)
  ) {
    return null;
  }

  return {
    id,
    title,
    youtubeUrl,
    thumbnailUrl,
    thumbnailStoragePath: thumbnailStoragePath || null,
    thumbnailFileSizeBytes: asNullablePositiveInteger(row.thumbnail_file_size_bytes),
    thumbnailContentType: normalizeDashboardTutorialThumbnailContentType(
      row.thumbnail_content_type
    ),
    thumbnailMediaType: thumbnailMediaTypeRaw,
    thumbnailDisplayStoragePath: thumbnailDisplayStoragePath || null,
    thumbnailDisplayFileSizeBytes: asNullablePositiveInteger(row.thumbnail_display_file_size_bytes),
    thumbnailDisplayContentType: normalizeDashboardTutorialThumbnailDisplayContentType(
      row.thumbnail_display_content_type
    ),
    thumbnailDisplayMediaType: isThumbnailMediaType(thumbnailDisplayMediaTypeRaw)
      ? thumbnailDisplayMediaTypeRaw
      : null,
    thumbnailPosterUrl,
    thumbnailPosterStoragePath: thumbnailPosterStoragePath || null,
    thumbnailPosterFileSizeBytes: asNullablePositiveInteger(row.thumbnail_poster_file_size_bytes),
    thumbnailPosterContentType: normalizeDashboardTutorialPosterContentType(
      row.thumbnail_poster_content_type
    ),
    thumbnailAlt: asTrimmed(row.thumbnail_alt),
    displayOrder: typeof row.display_order === "number" ? row.display_order : 0,
    isActive: row.is_active === true,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
  };
};

const emptyNormalizedTutorial = (): Omit<DashboardTutorial, "id" | "createdAt" | "updatedAt"> => ({
  title: "",
  youtubeUrl: "",
  thumbnailUrl: "",
  thumbnailStoragePath: null,
  thumbnailFileSizeBytes: null,
  thumbnailContentType: null,
  thumbnailMediaType: "image",
  thumbnailDisplayStoragePath: null,
  thumbnailDisplayFileSizeBytes: null,
  thumbnailDisplayContentType: null,
  thumbnailDisplayMediaType: null,
  thumbnailPosterUrl: null,
  thumbnailPosterStoragePath: null,
  thumbnailPosterFileSizeBytes: null,
  thumbnailPosterContentType: null,
  thumbnailAlt: "",
  displayOrder: 0,
  isActive: true,
});

const TUTORIAL_SELECT_WITH_STORAGE =
  "id, title, youtube_url, thumbnail_url, thumbnail_storage_path, thumbnail_file_size_bytes, thumbnail_content_type, thumbnail_media_type, thumbnail_display_storage_path, thumbnail_display_file_size_bytes, thumbnail_display_content_type, thumbnail_display_media_type, thumbnail_poster_storage_path, thumbnail_poster_file_size_bytes, thumbnail_poster_content_type, thumbnail_alt, display_order, is_active, created_at, updated_at";
const TUTORIAL_SELECT_LEGACY =
  "id, title, youtube_url, thumbnail_url, thumbnail_media_type, thumbnail_alt, display_order, is_active, created_at, updated_at";

const missingTutorialStorageColumns = (error: unknown): boolean => {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: unknown; message?: unknown };
  const code = typeof maybeError.code === "string" ? maybeError.code : "";
  const message = typeof maybeError.message === "string" ? maybeError.message.toLowerCase() : "";
  return (
    code === "42703" ||
    message.includes("thumbnail_storage_path") ||
    message.includes("thumbnail_file_size_bytes") ||
    message.includes("thumbnail_content_type") ||
    message.includes("thumbnail_display_storage_path") ||
    message.includes("thumbnail_poster_storage_path") ||
    (message.includes("schema cache") && message.includes("thumbnail"))
  );
};

const serializeTutorialRows = async (
  supabaseAdmin: SupabaseAdminClient,
  rows: unknown[] | null
): Promise<DashboardTutorial[]> => {
  const rowList = Array.isArray(rows) ? rows : [];
  const signedUrlByPath = await signDashboardTutorialThumbnailUrls(
    supabaseAdmin,
    collectDashboardTutorialThumbnailPaths(rowList)
  );
  const tutorials = rowList.map((row) => toDashboardTutorial(row, signedUrlByPath));
  return tutorials.filter((tutorial): tutorial is DashboardTutorial => tutorial !== null);
};

const selectActiveDashboardTutorialRows = async (
  supabaseAdmin: SupabaseAdminClient,
  columns: string,
  limit: number
) =>
  await supabaseAdmin
    .from("dashboard_tutorials")
    .select(columns)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(limit);

const selectAdminDashboardTutorialRows = async (
  supabaseAdmin: SupabaseAdminClient,
  columns: string
) =>
  await supabaseAdmin
    .from("dashboard_tutorials")
    .select(columns)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(100);

/**
 * Validates and normalizes one dashboard tutorial payload.
 */
export const normalizeDashboardTutorialInput = (
  body: unknown
): DashboardTutorialInputValidation => {
  const payload = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const title = asTrimmed(payload.title);
  const youtubeUrl = asTrimmed(payload.youtubeUrl ?? payload.youtube_url);
  const thumbnailUrl = asTrimmed(payload.thumbnailUrl ?? payload.thumbnail_url);
  const thumbnailStoragePath = asTrimmed(
    payload.thumbnailStoragePath ?? payload.thumbnail_storage_path
  );
  const thumbnailDisplayStoragePath = asTrimmed(
    payload.thumbnailDisplayStoragePath ?? payload.thumbnail_display_storage_path
  );
  const thumbnailPosterStoragePath = asTrimmed(
    payload.thumbnailPosterStoragePath ?? payload.thumbnail_poster_storage_path
  );
  const thumbnailContentType = normalizeDashboardTutorialThumbnailContentType(
    payload.thumbnailContentType ?? payload.thumbnail_content_type
  );
  const thumbnailDisplayContentType = normalizeDashboardTutorialThumbnailDisplayContentType(
    payload.thumbnailDisplayContentType ?? payload.thumbnail_display_content_type
  );
  const thumbnailPosterContentType = normalizeDashboardTutorialPosterContentType(
    payload.thumbnailPosterContentType ?? payload.thumbnail_poster_content_type
  );
  const thumbnailFileSizeRaw = Number(
    payload.thumbnailFileSizeBytes ?? payload.thumbnail_file_size_bytes ?? 0
  );
  const thumbnailFileSizeBytes = Number.isSafeInteger(thumbnailFileSizeRaw)
    ? Math.max(0, Math.trunc(thumbnailFileSizeRaw))
    : 0;
  const thumbnailDisplayFileSizeRaw = Number(
    payload.thumbnailDisplayFileSizeBytes ?? payload.thumbnail_display_file_size_bytes ?? 0
  );
  const thumbnailDisplayFileSizeBytes = Number.isSafeInteger(thumbnailDisplayFileSizeRaw)
    ? Math.max(0, Math.trunc(thumbnailDisplayFileSizeRaw))
    : 0;
  const thumbnailPosterFileSizeRaw = Number(
    payload.thumbnailPosterFileSizeBytes ?? payload.thumbnail_poster_file_size_bytes ?? 0
  );
  const thumbnailPosterFileSizeBytes = Number.isSafeInteger(thumbnailPosterFileSizeRaw)
    ? Math.max(0, Math.trunc(thumbnailPosterFileSizeRaw))
    : 0;
  const thumbnailMediaTypeRaw =
    asTrimmed(payload.thumbnailMediaType ?? payload.thumbnail_media_type) || "image";
  const thumbnailDisplayMediaTypeRaw = asTrimmed(
    payload.thumbnailDisplayMediaType ?? payload.thumbnail_display_media_type
  );
  const thumbnailAlt = asTrimmed(payload.thumbnailAlt ?? payload.thumbnail_alt);
  const displayOrderRaw = Number(payload.displayOrder ?? payload.display_order ?? 0);
  const displayOrder = Number.isFinite(displayOrderRaw)
    ? Math.max(0, Math.trunc(displayOrderRaw))
    : 0;
  const isActive = payload.isActive ?? payload.is_active;

  if (!title) {
    return { tutorial: emptyNormalizedTutorial(), error: "Title is required." };
  }
  if (title.length > DASHBOARD_TUTORIAL_TITLE_MAX_LENGTH) {
    return { tutorial: emptyNormalizedTutorial(), error: "Title is too long." };
  }
  if (
    !youtubeUrl ||
    youtubeUrl.length > DASHBOARD_TUTORIAL_YOUTUBE_URL_MAX_LENGTH ||
    !isAllowedYoutubeUrl(youtubeUrl)
  ) {
    return {
      tutorial: emptyNormalizedTutorial(),
      error: "YouTube URL must be an HTTPS youtube.com or youtu.be link.",
    };
  }
  if (thumbnailStoragePath) {
    if (
      thumbnailStoragePath.length > DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PATH_MAX_LENGTH ||
      !isDashboardTutorialThumbnailStoragePath(thumbnailStoragePath)
    ) {
      return { tutorial: emptyNormalizedTutorial(), error: "Thumbnail storage path is invalid." };
    }
    if (!thumbnailContentType) {
      return { tutorial: emptyNormalizedTutorial(), error: "Thumbnail content type is invalid." };
    }
    if (!thumbnailFileSizeBytes) {
      return { tutorial: emptyNormalizedTutorial(), error: "Thumbnail file size is required." };
    }
    if (thumbnailDisplayStoragePath) {
      if (
        thumbnailDisplayStoragePath.length > DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PATH_MAX_LENGTH ||
        !isDashboardTutorialThumbnailVariantStoragePath(thumbnailDisplayStoragePath)
      ) {
        return {
          tutorial: emptyNormalizedTutorial(),
          error: "Thumbnail display storage path is invalid.",
        };
      }
      if (!thumbnailDisplayContentType) {
        return {
          tutorial: emptyNormalizedTutorial(),
          error: "Thumbnail display content type is invalid.",
        };
      }
      if (!thumbnailDisplayFileSizeBytes) {
        return {
          tutorial: emptyNormalizedTutorial(),
          error: "Thumbnail display file size is required.",
        };
      }
      if (!isThumbnailMediaType(thumbnailDisplayMediaTypeRaw)) {
        return { tutorial: emptyNormalizedTutorial(), error: "Thumbnail display type is invalid." };
      }
    }
    if (thumbnailPosterStoragePath) {
      if (
        thumbnailPosterStoragePath.length > DASHBOARD_TUTORIAL_THUMBNAIL_STORAGE_PATH_MAX_LENGTH ||
        !isDashboardTutorialThumbnailVariantStoragePath(thumbnailPosterStoragePath)
      ) {
        return {
          tutorial: emptyNormalizedTutorial(),
          error: "Thumbnail poster storage path is invalid.",
        };
      }
      if (!thumbnailPosterContentType) {
        return {
          tutorial: emptyNormalizedTutorial(),
          error: "Thumbnail poster content type is invalid.",
        };
      }
      if (!thumbnailPosterFileSizeBytes) {
        return {
          tutorial: emptyNormalizedTutorial(),
          error: "Thumbnail poster file size is required.",
        };
      }
    }
  } else if (
    !thumbnailUrl ||
    thumbnailUrl.length > DASHBOARD_TUTORIAL_THUMBNAIL_URL_MAX_LENGTH ||
    !isHttpsUrl(thumbnailUrl)
  ) {
    return {
      tutorial: emptyNormalizedTutorial(),
      error: "Upload a thumbnail file or provide an HTTPS thumbnail URL.",
    };
  }
  if (!isThumbnailMediaType(thumbnailMediaTypeRaw)) {
    return { tutorial: emptyNormalizedTutorial(), error: "Thumbnail type is invalid." };
  }
  if (thumbnailAlt.length > DASHBOARD_TUTORIAL_THUMBNAIL_ALT_MAX_LENGTH) {
    return { tutorial: emptyNormalizedTutorial(), error: "Thumbnail alt text is too long." };
  }

  return {
    tutorial: {
      title,
      youtubeUrl,
      thumbnailUrl,
      thumbnailStoragePath: thumbnailStoragePath || null,
      thumbnailFileSizeBytes: thumbnailStoragePath ? thumbnailFileSizeBytes : null,
      thumbnailContentType: thumbnailStoragePath ? thumbnailContentType : null,
      thumbnailMediaType: isThumbnailMediaType(thumbnailDisplayMediaTypeRaw)
        ? thumbnailDisplayMediaTypeRaw
        : thumbnailMediaTypeRaw,
      thumbnailDisplayStoragePath: thumbnailStoragePath
        ? thumbnailDisplayStoragePath || null
        : null,
      thumbnailDisplayFileSizeBytes:
        thumbnailStoragePath && thumbnailDisplayStoragePath ? thumbnailDisplayFileSizeBytes : null,
      thumbnailDisplayContentType:
        thumbnailStoragePath && thumbnailDisplayStoragePath ? thumbnailDisplayContentType : null,
      thumbnailDisplayMediaType:
        thumbnailStoragePath && isThumbnailMediaType(thumbnailDisplayMediaTypeRaw)
          ? thumbnailDisplayMediaTypeRaw
          : null,
      thumbnailPosterUrl: null,
      thumbnailPosterStoragePath: thumbnailStoragePath ? thumbnailPosterStoragePath || null : null,
      thumbnailPosterFileSizeBytes:
        thumbnailStoragePath && thumbnailPosterStoragePath ? thumbnailPosterFileSizeBytes : null,
      thumbnailPosterContentType:
        thumbnailStoragePath && thumbnailPosterStoragePath ? thumbnailPosterContentType : null,
      thumbnailAlt,
      displayOrder,
      isActive: typeof isActive === "boolean" ? isActive : true,
    },
    error: null,
  };
};

/**
 * Reads active dashboard tutorials for signed-in dashboard users.
 */
export const readActiveDashboardTutorials = async (
  supabaseAdmin: SupabaseAdminClient,
  limit = DASHBOARD_TUTORIAL_PUBLIC_LIMIT
): Promise<DashboardTutorial[]> => {
  const normalizedLimit = Number.isFinite(limit)
    ? Math.trunc(limit)
    : DASHBOARD_TUTORIAL_PUBLIC_LIMIT;
  const boundedLimit = Math.max(1, Math.min(normalizedLimit, DASHBOARD_TUTORIAL_PUBLIC_LIMIT));
  const { data, error } = await selectActiveDashboardTutorialRows(
    supabaseAdmin,
    TUTORIAL_SELECT_WITH_STORAGE,
    boundedLimit
  );

  if (error && missingTutorialStorageColumns(error)) {
    const legacyResult = await selectActiveDashboardTutorialRows(
      supabaseAdmin,
      TUTORIAL_SELECT_LEGACY,
      boundedLimit
    );
    if (legacyResult.error) {
      throw new Error(legacyResult.error.message || "Failed to load dashboard tutorials.");
    }
    return serializeTutorialRows(supabaseAdmin, legacyResult.data);
  }

  if (error) {
    throw new Error(error.message || "Failed to load dashboard tutorials.");
  }

  return serializeTutorialRows(supabaseAdmin, data);
};

/**
 * Reads the full admin tutorial catalog.
 */
export const readAdminDashboardTutorials = async (
  supabaseAdmin: SupabaseAdminClient
): Promise<DashboardTutorial[]> => {
  const { data, error } = await selectAdminDashboardTutorialRows(
    supabaseAdmin,
    TUTORIAL_SELECT_WITH_STORAGE
  );

  if (error && missingTutorialStorageColumns(error)) {
    const legacyResult = await selectAdminDashboardTutorialRows(
      supabaseAdmin,
      TUTORIAL_SELECT_LEGACY
    );
    if (legacyResult.error) {
      throw new Error(legacyResult.error.message || "Failed to load dashboard tutorials.");
    }
    return serializeTutorialRows(supabaseAdmin, legacyResult.data);
  }

  if (error) {
    throw new Error(error.message || "Failed to load dashboard tutorials.");
  }

  return serializeTutorialRows(supabaseAdmin, data);
};

/**
 * Creates or updates one dashboard tutorial from an admin request.
 */
export const saveDashboardTutorial = async (
  supabaseAdmin: SupabaseAdminClient,
  args: {
    id?: string | null;
    tutorial: Omit<DashboardTutorial, "id" | "createdAt" | "updatedAt">;
    actorUserId: string | null;
  }
): Promise<DashboardTutorial> => {
  const usesStoredThumbnail = Boolean(args.tutorial.thumbnailStoragePath);
  const row = {
    title: args.tutorial.title,
    youtube_url: args.tutorial.youtubeUrl,
    thumbnail_url: usesStoredThumbnail ? null : args.tutorial.thumbnailUrl,
    thumbnail_storage_path: usesStoredThumbnail ? args.tutorial.thumbnailStoragePath : null,
    thumbnail_file_size_bytes: usesStoredThumbnail ? args.tutorial.thumbnailFileSizeBytes : null,
    thumbnail_content_type: usesStoredThumbnail ? args.tutorial.thumbnailContentType : null,
    thumbnail_media_type: args.tutorial.thumbnailMediaType,
    thumbnail_display_storage_path: usesStoredThumbnail
      ? args.tutorial.thumbnailDisplayStoragePath
      : null,
    thumbnail_display_file_size_bytes: usesStoredThumbnail
      ? args.tutorial.thumbnailDisplayFileSizeBytes
      : null,
    thumbnail_display_content_type: usesStoredThumbnail
      ? args.tutorial.thumbnailDisplayContentType
      : null,
    thumbnail_display_media_type: usesStoredThumbnail
      ? args.tutorial.thumbnailDisplayMediaType
      : null,
    thumbnail_poster_storage_path: usesStoredThumbnail
      ? args.tutorial.thumbnailPosterStoragePath
      : null,
    thumbnail_poster_file_size_bytes: usesStoredThumbnail
      ? args.tutorial.thumbnailPosterFileSizeBytes
      : null,
    thumbnail_poster_content_type: usesStoredThumbnail
      ? args.tutorial.thumbnailPosterContentType
      : null,
    thumbnail_alt: args.tutorial.thumbnailAlt,
    display_order: args.tutorial.displayOrder,
    is_active: args.tutorial.isActive,
    updated_by: args.actorUserId,
  };

  const result = args.id
    ? await supabaseAdmin
        .from("dashboard_tutorials")
        .update(row)
        .eq("id", args.id)
        .select(TUTORIAL_SELECT_WITH_STORAGE)
        .maybeSingle()
    : await supabaseAdmin
        .from("dashboard_tutorials")
        .insert({ ...row, created_by: args.actorUserId })
        .select(TUTORIAL_SELECT_WITH_STORAGE)
        .maybeSingle();

  if (result.error) {
    if (!usesStoredThumbnail && missingTutorialStorageColumns(result.error)) {
      const legacyRow = {
        title: args.tutorial.title,
        youtube_url: args.tutorial.youtubeUrl,
        thumbnail_url: args.tutorial.thumbnailUrl,
        thumbnail_media_type: args.tutorial.thumbnailMediaType,
        thumbnail_alt: args.tutorial.thumbnailAlt,
        display_order: args.tutorial.displayOrder,
        is_active: args.tutorial.isActive,
        updated_by: args.actorUserId,
      };
      const legacyResult = args.id
        ? await supabaseAdmin
            .from("dashboard_tutorials")
            .update(legacyRow)
            .eq("id", args.id)
            .select(TUTORIAL_SELECT_LEGACY)
            .maybeSingle()
        : await supabaseAdmin
            .from("dashboard_tutorials")
            .insert({ ...legacyRow, created_by: args.actorUserId })
            .select(TUTORIAL_SELECT_LEGACY)
            .maybeSingle();

      if (legacyResult.error) {
        throw new Error(legacyResult.error.message || "Failed to save dashboard tutorial.");
      }

      const [legacyTutorial] = await serializeTutorialRows(supabaseAdmin, [legacyResult.data]);
      if (!legacyTutorial) {
        throw new Error("Saved dashboard tutorial payload is invalid.");
      }
      return legacyTutorial;
    }
    throw new Error(result.error.message || "Failed to save dashboard tutorial.");
  }

  const [tutorial] = await serializeTutorialRows(supabaseAdmin, [result.data]);
  if (!tutorial) {
    throw new Error("Saved dashboard tutorial payload is invalid.");
  }
  return tutorial;
};

/**
 * Deletes one dashboard tutorial from the admin catalog.
 */
export const deleteDashboardTutorial = async (
  supabaseAdmin: SupabaseAdminClient,
  id: string
): Promise<void> => {
  const { error } = await supabaseAdmin.from("dashboard_tutorials").delete().eq("id", id);
  if (error) {
    throw new Error(error.message || "Failed to delete dashboard tutorial.");
  }
};

/**
 * Persists admin reorder operations by assigning contiguous display-order values.
 */
export const reorderDashboardTutorials = async (
  supabaseAdmin: SupabaseAdminClient,
  args: { ids: string[]; actorUserId: string | null }
): Promise<DashboardTutorial[]> => {
  const { data, error } = await supabaseAdmin.rpc("reorder_dashboard_tutorials", {
    p_ids: args.ids,
    p_actor_user_id: args.actorUserId,
  });

  if (error) {
    throw new Error(error.message || "Failed to reorder dashboard tutorials.");
  }

  return serializeTutorialRows(supabaseAdmin, Array.isArray(data) ? data : []);
};
