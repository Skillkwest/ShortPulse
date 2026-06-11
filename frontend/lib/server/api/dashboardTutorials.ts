/**
 * Server helpers for admin-managed dashboard tutorials.
 * Centralizes tutorial validation, row serialization, and global ordered persistence.
 */
import type { getSupabaseAdmin } from "./supabaseAdmin";
import {
  isDashboardTutorialThumbnailStoragePath,
  normalizeDashboardTutorialThumbnailContentType,
  signDashboardTutorialThumbnailUrl,
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

const toDashboardTutorial = async (
  supabaseAdmin: SupabaseAdminClient,
  value: unknown
): Promise<DashboardTutorial | null> => {
  if (!value || typeof value !== "object") return null;
  const row = value as RawDashboardTutorial;
  const id = typeof row.id === "string" ? row.id : "";
  const title = asTrimmed(row.title);
  const youtubeUrl = asTrimmed(row.youtube_url);
  const storedThumbnailUrl = asTrimmed(row.thumbnail_url);
  const thumbnailStoragePath = asTrimmed(row.thumbnail_storage_path);
  const thumbnailMediaTypeRaw = asTrimmed(row.thumbnail_media_type) || "image";
  const thumbnailUrl = thumbnailStoragePath
    ? await signDashboardTutorialThumbnailUrl(supabaseAdmin, thumbnailStoragePath)
    : storedThumbnailUrl;

  if (
    !id ||
    !title ||
    !youtubeUrl ||
    !thumbnailUrl ||
    (thumbnailStoragePath && !isDashboardTutorialThumbnailStoragePath(thumbnailStoragePath)) ||
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
  thumbnailAlt: "",
  displayOrder: 0,
  isActive: true,
});

const TUTORIAL_SELECT =
  "id, title, youtube_url, thumbnail_url, thumbnail_storage_path, thumbnail_file_size_bytes, thumbnail_content_type, thumbnail_media_type, thumbnail_alt, display_order, is_active, created_at, updated_at";

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
  const thumbnailContentType = normalizeDashboardTutorialThumbnailContentType(
    payload.thumbnailContentType ?? payload.thumbnail_content_type
  );
  const thumbnailFileSizeRaw = Number(
    payload.thumbnailFileSizeBytes ?? payload.thumbnail_file_size_bytes ?? 0
  );
  const thumbnailFileSizeBytes = Number.isSafeInteger(thumbnailFileSizeRaw)
    ? Math.max(0, Math.trunc(thumbnailFileSizeRaw))
    : 0;
  const thumbnailMediaTypeRaw =
    asTrimmed(payload.thumbnailMediaType ?? payload.thumbnail_media_type) || "image";
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
      thumbnailMediaType: thumbnailMediaTypeRaw,
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
  const { data, error } = await supabaseAdmin
    .from("dashboard_tutorials")
    .select(TUTORIAL_SELECT)
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(boundedLimit);

  if (error) {
    throw new Error(error.message || "Failed to load dashboard tutorials.");
  }

  const tutorials = await Promise.all(
    (Array.isArray(data) ? data : []).map((row) => toDashboardTutorial(supabaseAdmin, row))
  );
  return tutorials.filter((tutorial): tutorial is DashboardTutorial => tutorial !== null);
};

/**
 * Reads the full admin tutorial catalog.
 */
export const readAdminDashboardTutorials = async (
  supabaseAdmin: SupabaseAdminClient
): Promise<DashboardTutorial[]> => {
  const { data, error } = await supabaseAdmin
    .from("dashboard_tutorials")
    .select(TUTORIAL_SELECT)
    .order("display_order", { ascending: true })
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message || "Failed to load dashboard tutorials.");
  }

  const tutorials = await Promise.all(
    (Array.isArray(data) ? data : []).map((row) => toDashboardTutorial(supabaseAdmin, row))
  );
  return tutorials.filter((tutorial): tutorial is DashboardTutorial => tutorial !== null);
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
        .select(TUTORIAL_SELECT)
        .maybeSingle()
    : await supabaseAdmin
        .from("dashboard_tutorials")
        .insert({ ...row, created_by: args.actorUserId })
        .select(TUTORIAL_SELECT)
        .maybeSingle();

  if (result.error) {
    throw new Error(result.error.message || "Failed to save dashboard tutorial.");
  }

  const tutorial = await toDashboardTutorial(supabaseAdmin, result.data);
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

  const tutorials = await Promise.all(
    (Array.isArray(data) ? data : []).map((row) => toDashboardTutorial(supabaseAdmin, row))
  );
  return tutorials.filter((tutorial): tutorial is DashboardTutorial => tutorial !== null);
};
