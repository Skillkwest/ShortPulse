/**
 * Elements Manager persistence core.
 * Provides the isolated Supabase/storage helpers backing the Elements library.
 */
import { getSignedMediaUrl, invalidateSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { assertUserScopedMediaStoragePath } from "../../../lib/mediaStoragePath";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { refreshSupabaseSignedUrlIfNeeded } from "../../ai-studio/utils/imageUpload";
import { DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM } from "../constants";
import type { ElementAssetType, ElementProfileImageTransform, ElementStatus } from "../types";
import { deriveElementAliasFromName, resolveElementWorkflowAlias } from "./elementAlias";

const MEDIA_BUCKET = "media_library";
export const DEFAULT_ELEMENT_NAME = "New Element";
export const ELEMENT_PROFILE_IMAGE_STORAGE_PATH_KEY = "profile_image_storage_path";
export const ELEMENT_PROFILE_IMAGE_MEDIA_ASSET_ID_KEY = "profile_image_media_asset_id";
export const ELEMENT_PROFILE_IMAGE_ZOOM_KEY = "profile_image_zoom";
export const ELEMENT_PROFILE_IMAGE_OFFSET_X_KEY = "profile_image_offset_x";
export const ELEMENT_PROFILE_IMAGE_OFFSET_Y_KEY = "profile_image_offset_y";
export const ELEMENT_ACTIVE_REFERENCE_SET_ID_KEY = "active_reference_set_id";
export const ELEMENT_ACTIVE_REFERENCE_SET_ASSET_TYPE_KEY = "active_reference_set_asset_type";
export const ELEMENT_REFERENCE_SET_TAB_ORDER_KEY = "reference_set_tab_order";

type ElementsContext = {
  supabase: ReturnType<typeof ensureSupabaseQueryClient>;
  userId: string;
};

type ElementRow = {
  id: string;
  name: string;
  alias: string;
  status: ElementStatus | "archived";
  metadata: unknown;
  updated_at: string;
};

type ElementReferenceSetRow = {
  id: string;
  element_id: string;
  set_key: string;
  label: string;
  description: string;
  asset_type: ElementAssetType;
  deck_reference_urls: unknown;
  image_reference_urls: unknown;
  video_reference_url: string | null;
  updated_at: string;
};

type ElementReferenceSetId = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10";

type ElementReferenceSet = {
  assetType: ElementAssetType;
  description: string;
  deckReferenceUrls: string[];
  imageReferenceUrls: string[];
  videoReferenceUrl: string;
};

type ElementReferenceSetMap = Record<ElementReferenceSetId, ElementReferenceSet>;

type ElementReferenceSetLabelMap = Record<ElementReferenceSetId, string>;

type ElementReferenceSetState = {
  activeSetId: ElementReferenceSetId;
  tabOrder: ElementReferenceSetId[];
  tabLabels: ElementReferenceSetLabelMap;
  sets: ElementReferenceSetMap;
};

export type ElementsManagerListItem = {
  elementId: string;
  elementName: string;
  elementAlias: string;
  elementAssetType: ElementAssetType;
  elementStatus: ElementStatus;
  profileImageUrl: string | null;
  profileImageTransform: ElementProfileImageTransform;
  updatedAt: string;
};

export type ElementManagerDraftSnapshot = {
  userId: string;
  elementId: string;
  name: string;
  alias: string;
  status: ElementStatus;
  profileImageUrl: string | null;
  profileImageTransform: ElementProfileImageTransform;
  description: string;
  assetType: ElementAssetType;
  imageReferenceUrls: string[];
  videoReferenceUrl: string | null;
  updatedAt: string;
};

export type SaveElementManagerDraftInput = {
  name: string;
  profileImageTransform: ElementProfileImageTransform;
  description: string;
  assetType: ElementAssetType;
  imageReferenceUrls: string[];
  videoReferenceUrl: string | null;
};

const ELEMENT_REFERENCE_SET_IDS: ElementReferenceSetId[] = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
];

const createEmptyElementReferenceSet = (): ElementReferenceSet => ({
  assetType: "image",
  description: "",
  deckReferenceUrls: [],
  imageReferenceUrls: [],
  videoReferenceUrl: "",
});

const createDefaultElementReferenceSetLabels = (): ElementReferenceSetLabelMap =>
  Object.fromEntries(
    ELEMENT_REFERENCE_SET_IDS.map((setId) => [
      setId,
      setId === "1" ? "Double click me" : `Reference Set ${setId}`,
    ])
  ) as ElementReferenceSetLabelMap;

const createEmptyElementReferenceSetMap = (): ElementReferenceSetMap =>
  Object.fromEntries(
    ELEMENT_REFERENCE_SET_IDS.map((setId) => [setId, createEmptyElementReferenceSet()])
  ) as ElementReferenceSetMap;

const createDefaultElementReferenceSetState = (
  overrides?: Partial<ElementReferenceSetState>
): ElementReferenceSetState => ({
  activeSetId: overrides?.activeSetId ?? "1",
  tabOrder: overrides?.tabOrder ?? ["1"],
  tabLabels: overrides?.tabLabels ?? createDefaultElementReferenceSetLabels(),
  sets: overrides?.sets ?? createEmptyElementReferenceSetMap(),
});

const asErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

const toObjectRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};

const asText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const asTextArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
};

const hydrateReferenceUrl = async (value: string): Promise<string> => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return await refreshSupabaseSignedUrlIfNeeded(trimmed).catch(() => trimmed);
};

const hydrateReferenceUrlArray = async (values: unknown): Promise<string[]> => {
  const urls = asTextArray(values);
  if (!urls.length) return [];
  return (await Promise.all(urls.map(async (value) => await hydrateReferenceUrl(value)))).filter(
    Boolean
  );
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalizeProfileImageTransform = (
  transform: ElementProfileImageTransform
): ElementProfileImageTransform => ({
  zoom: clamp(transform.zoom, 1, 2.4),
  offsetX: Math.round(clamp(transform.offsetX, -40, 40)),
  offsetY: Math.round(clamp(transform.offsetY, -40, 40)),
});

const inferFileExtension = (filename: string, mimeType: string): string => {
  const filenameParts = filename.trim().toLowerCase().split(".");
  if (filenameParts.length > 1) {
    const extension = filenameParts[filenameParts.length - 1]?.trim();
    if (extension) return extension.replace(/[^a-z0-9]/g, "") || "jpg";
  }
  const normalizedMime = mimeType.toLowerCase();
  if (normalizedMime.includes("png")) return "png";
  if (normalizedMime.includes("webp")) return "webp";
  if (normalizedMime.includes("avif")) return "avif";
  if (normalizedMime.includes("heic")) return "heic";
  if (normalizedMime.includes("heif")) return "heif";
  return "jpg";
};

const sanitizeFileStem = (filename: string): string => {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return sanitized || "reference";
};

const isElementReferenceSetId = (value: string): value is ElementReferenceSetId =>
  ELEMENT_REFERENCE_SET_IDS.includes(value as ElementReferenceSetId);

const LEGACY_ACTIVE_REFERENCE_SET_ID: ElementReferenceSetId = "1";

const flattenReferenceSetState = (referenceSetState: ElementReferenceSetState) => {
  const activeSet =
    referenceSetState.sets[referenceSetState.activeSetId] ??
    referenceSetState.sets[LEGACY_ACTIVE_REFERENCE_SET_ID];
  const imageReferenceUrls = [
    ...(activeSet?.imageReferenceUrls ?? []),
    ...(activeSet?.deckReferenceUrls ?? []),
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, collection) => collection.indexOf(value) === index)
    .slice(0, 6);
  return {
    description: activeSet?.description ?? "",
    assetType: activeSet?.assetType ?? "image",
    imageReferenceUrls,
    videoReferenceUrl: activeSet?.videoReferenceUrl.trim() || null,
  };
};

const buildLegacyReferenceSetStateFromFlatDraft = ({
  assetType,
  description,
  imageReferenceUrls,
  videoReferenceUrl,
}: {
  assetType: ElementAssetType;
  description: string;
  imageReferenceUrls: string[];
  videoReferenceUrl: string | null;
}): ElementReferenceSetState =>
  createDefaultElementReferenceSetState({
    activeSetId: LEGACY_ACTIVE_REFERENCE_SET_ID,
    tabOrder: [LEGACY_ACTIVE_REFERENCE_SET_ID],
    tabLabels: createDefaultElementReferenceSetLabels(),
    sets: {
      ...createEmptyElementReferenceSetMap(),
      [LEGACY_ACTIVE_REFERENCE_SET_ID]: {
        assetType,
        description: description.trim(),
        // Keep deck_reference_urls as a bounded storage alias to avoid schema churn.
        deckReferenceUrls:
          assetType === "image" ? imageReferenceUrls.filter(Boolean).slice(0, 6) : [],
        imageReferenceUrls:
          assetType === "image" ? imageReferenceUrls.filter(Boolean).slice(0, 6) : [],
        videoReferenceUrl: assetType === "video" ? (videoReferenceUrl?.trim() ?? "") : "",
      },
    },
  });

const resolveSupabaseContext = async (): Promise<ElementsContext> => {
  const userId = await readSupabaseUserId();
  if (!userId) {
    throw new Error("You must be signed in to manage elements.");
  }
  return {
    supabase: ensureSupabaseQueryClient(),
    userId,
  };
};

const createElementProfileStoragePath = ({
  userId,
  elementId,
  filename,
  mimeType,
}: {
  userId: string;
  elementId: string;
  filename: string;
  mimeType: string;
}) => {
  const extension = inferFileExtension(filename, mimeType);
  const fileStem = sanitizeFileStem(filename);
  const storagePath = `${userId}/elements/${elementId}/profile/${Date.now()}-${fileStem}.${extension}`;
  assertUserScopedMediaStoragePath({
    path: storagePath,
    userId,
    label: "Element profile storage path",
  });
  return storagePath;
};

const createElementMediaAsset = async ({
  userId,
  elementId,
  storagePath,
  filename,
  fileType,
  fileSize,
  metadata,
}: {
  userId: string;
  elementId: string;
  storagePath: string;
  filename: string;
  fileType: string;
  fileSize: number;
  metadata: Record<string, unknown>;
}): Promise<{ id: string; createdAt: string }> => {
  const { supabase } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("element_media_assets")
    .insert({
      user_id: userId,
      element_id: elementId,
      asset_kind: "profile",
      storage_path: storagePath,
      filename,
      file_type: fileType,
      file_size: fileSize,
      metadata,
    })
    .select("id, created_at")
    .single();
  if (error || !data?.id) {
    throw new Error(asErrorMessage(error, "Failed to create element media asset."));
  }
  return {
    id: data.id,
    createdAt: data.created_at ?? new Date().toISOString(),
  };
};

const getElementProfileImageMetadata = (
  metadata: unknown
): { storagePath: string | null; mediaAssetId: string | null } => {
  const record = toObjectRecord(metadata);
  return {
    storagePath: asText(record[ELEMENT_PROFILE_IMAGE_STORAGE_PATH_KEY]),
    mediaAssetId: asText(record[ELEMENT_PROFILE_IMAGE_MEDIA_ASSET_ID_KEY]),
  };
};

const getElementProfileImageTransform = (metadata: unknown): ElementProfileImageTransform => {
  const record = toObjectRecord(metadata);
  return normalizeProfileImageTransform({
    zoom:
      asNumber(record[ELEMENT_PROFILE_IMAGE_ZOOM_KEY]) ??
      DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM.zoom,
    offsetX:
      asNumber(record[ELEMENT_PROFILE_IMAGE_OFFSET_X_KEY]) ??
      DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM.offsetX,
    offsetY:
      asNumber(record[ELEMENT_PROFILE_IMAGE_OFFSET_Y_KEY]) ??
      DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM.offsetY,
  });
};

const getElementReferenceSetTabOrder = (metadata: unknown): ElementReferenceSetId[] => {
  const record = toObjectRecord(metadata);
  const rawValues = record[ELEMENT_REFERENCE_SET_TAB_ORDER_KEY];
  if (!Array.isArray(rawValues)) {
    return ["1"];
  }
  const parsed = rawValues
    .filter((value): value is string => typeof value === "string")
    .filter(isElementReferenceSetId);
  return parsed.length ? parsed : ["1"];
};

const getElementActiveReferenceSetAssetType = (metadata: unknown): ElementAssetType => {
  const record = toObjectRecord(metadata);
  const parsed = asText(record[ELEMENT_ACTIVE_REFERENCE_SET_ASSET_TYPE_KEY]);
  return parsed === "video" ? "video" : "image";
};

const getElementActiveReferenceSetId = (
  metadata: unknown,
  fallbackIds: readonly ElementReferenceSetId[]
): ElementReferenceSetId => {
  const record = toObjectRecord(metadata);
  const parsed = asText(record[ELEMENT_ACTIVE_REFERENCE_SET_ID_KEY]);
  if (parsed && isElementReferenceSetId(parsed) && fallbackIds.includes(parsed)) {
    return parsed;
  }
  return fallbackIds[0] ?? "1";
};

const buildReferenceSetState = async (
  metadata: unknown,
  rows: ElementReferenceSetRow[]
): Promise<ElementReferenceSetState> => {
  const defaultLabels = createDefaultElementReferenceSetLabels();
  const defaultSets = createEmptyElementReferenceSetMap();
  const tabOrder = getElementReferenceSetTabOrder(metadata);
  const tabLabels = { ...defaultLabels };
  const sets = { ...defaultSets };

  for (const row of rows) {
    if (!isElementReferenceSetId(row.set_key)) continue;
    tabLabels[row.set_key] = row.label?.trim() || defaultLabels[row.set_key];
    sets[row.set_key] = {
      assetType: row.asset_type,
      description: row.description ?? "",
      deckReferenceUrls: await hydrateReferenceUrlArray(row.deck_reference_urls),
      imageReferenceUrls: await hydrateReferenceUrlArray(row.image_reference_urls),
      videoReferenceUrl: row.video_reference_url?.trim()
        ? await hydrateReferenceUrl(row.video_reference_url)
        : "",
    };
  }

  const safeTabOrder = tabOrder.filter((setId): setId is ElementReferenceSetId =>
    Boolean(sets[setId])
  );
  const normalizedTabOrder: ElementReferenceSetId[] = safeTabOrder.length ? safeTabOrder : ["1"];
  return createDefaultElementReferenceSetState({
    activeSetId: getElementActiveReferenceSetId(metadata, normalizedTabOrder),
    tabOrder: normalizedTabOrder,
    tabLabels,
    sets,
  });
};

const toSignedProfileImageUrl = async (metadata: unknown): Promise<string | null> => {
  const profileMetadata = getElementProfileImageMetadata(metadata);
  if (!profileMetadata.storagePath) return null;
  return (
    (await getSignedMediaUrl({
      bucket: MEDIA_BUCKET,
      storagePath: profileMetadata.storagePath,
    })) ?? null
  );
};

export const fetchElementsManagerList = async (): Promise<ElementsManagerListItem[]> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data, error } = await supabase
    .from("elements")
    .select("id, name, alias, status, metadata, updated_at")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false });
  if (error) {
    throw new Error(asErrorMessage(error, "Failed to list elements."));
  }

  const rows = ((data ?? []) as ElementRow[]).filter(
    (row): row is ElementRow & { status: ElementStatus } => row.status !== "archived"
  );
  const items = await Promise.all(
    rows.map(async (row) => ({
      elementId: row.id,
      elementName: row.name,
      elementAlias: resolveElementWorkflowAlias({ name: row.name, legacyAlias: row.alias }),
      elementAssetType: getElementActiveReferenceSetAssetType(row.metadata),
      elementStatus: row.status,
      profileImageUrl: await toSignedProfileImageUrl(row.metadata),
      profileImageTransform: getElementProfileImageTransform(row.metadata),
      updatedAt: row.updated_at ?? new Date().toISOString(),
    }))
  );
  return items;
};

const createElementDraftRow = async ({
  name = DEFAULT_ELEMENT_NAME,
}: {
  name?: string;
} = {}): Promise<{ elementId: string; updatedAt: string }> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const defaultState = createDefaultElementReferenceSetState();
  const { data: elementRow, error: elementError } = await supabase
    .from("elements")
    .insert({
      user_id: userId,
      name,
      alias: deriveElementAliasFromName(name),
      status: "draft",
      metadata: {
        [ELEMENT_ACTIVE_REFERENCE_SET_ID_KEY]: defaultState.activeSetId,
        [ELEMENT_ACTIVE_REFERENCE_SET_ASSET_TYPE_KEY]: "image",
        [ELEMENT_REFERENCE_SET_TAB_ORDER_KEY]: defaultState.tabOrder,
      },
    })
    .select("id, updated_at")
    .single();
  if (elementError || !elementRow?.id) {
    throw new Error(asErrorMessage(elementError, "Failed to create element."));
  }

  const { error: setError } = await supabase.from("element_reference_sets").insert({
    element_id: elementRow.id,
    user_id: userId,
    set_key: "1",
    label: defaultState.tabLabels["1"],
    description: "",
    asset_type: "image",
    deck_reference_urls: [],
    image_reference_urls: [],
    video_reference_url: null,
  });
  if (setError) {
    await supabase.from("elements").delete().eq("user_id", userId).eq("id", elementRow.id);
    throw new Error(asErrorMessage(setError, "Failed to create element reference set."));
  }

  return {
    elementId: elementRow.id,
    updatedAt: elementRow.updated_at ?? new Date().toISOString(),
  };
};

export const saveElementManagerDraft = async ({
  name,
  profileImageTransform,
  description,
  assetType,
  imageReferenceUrls,
  videoReferenceUrl,
}: SaveElementManagerDraftInput): Promise<ElementManagerDraftSnapshot> => {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Element name must be at least 2 characters.");
  }

  const { supabase, userId } = await resolveSupabaseContext();
  const created = await createElementDraftRow({ name: trimmedName });

  const cleanupCreatedDraft = async () => {
    await supabase
      .from("element_reference_sets")
      .delete()
      .eq("user_id", userId)
      .eq("element_id", created.elementId);
    await supabase.from("elements").delete().eq("user_id", userId).eq("id", created.elementId);
  };

  try {
    await saveElementManagerDraftSnapshot({
      elementId: created.elementId,
      name: trimmedName,
      profileImageTransform,
      description,
      assetType,
      imageReferenceUrls,
      videoReferenceUrl,
    });
  } catch (error) {
    await cleanupCreatedDraft();
    throw error;
  }

  return await loadElementManagerDraftByElementId(created.elementId);
};

export const loadElementManagerDraftByElementId = async (
  elementId: string
): Promise<ElementManagerDraftSnapshot> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: elementRow, error: elementError } = await supabase
    .from("elements")
    .select("id, name, alias, status, metadata, updated_at")
    .eq("user_id", userId)
    .eq("id", elementId)
    .neq("status", "archived")
    .maybeSingle();
  if (elementError) {
    throw new Error(asErrorMessage(elementError, "Failed to load element."));
  }
  if (!elementRow) {
    throw new Error("Element is no longer available.");
  }

  const { data: referenceRows, error: referenceError } = await supabase
    .from("element_reference_sets")
    .select(
      "id, element_id, set_key, label, description, asset_type, deck_reference_urls, image_reference_urls, video_reference_url, updated_at"
    )
    .eq("user_id", userId)
    .eq("element_id", elementId);
  if (referenceError) {
    throw new Error(asErrorMessage(referenceError, "Failed to load element reference sets."));
  }

  const row = elementRow as ElementRow;
  const status = row.status === "ready" ? "ready" : "draft";
  return {
    userId,
    elementId: row.id,
    name: row.name,
    alias: row.alias,
    status,
    profileImageUrl: await toSignedProfileImageUrl(row.metadata),
    profileImageTransform: getElementProfileImageTransform(row.metadata),
    ...flattenReferenceSetState(
      await buildReferenceSetState(row.metadata, (referenceRows ?? []) as ElementReferenceSetRow[])
    ),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  };
};

export const saveElementManagerDraftSnapshot = async ({
  elementId,
  name,
  profileImageTransform,
  description,
  assetType,
  imageReferenceUrls,
  videoReferenceUrl,
}: {
  elementId: string;
  name: string;
  profileImageTransform: ElementProfileImageTransform;
  description: string;
  assetType: ElementAssetType;
  imageReferenceUrls: string[];
  videoReferenceUrl: string | null;
}): Promise<{ updatedAt: string; status: ElementStatus }> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: existingRow, error: existingError } = await supabase
    .from("elements")
    .select("name, alias, metadata")
    .eq("user_id", userId)
    .eq("id", elementId)
    .maybeSingle();
  if (existingError) {
    throw new Error(asErrorMessage(existingError, "Failed to load element metadata."));
  }
  if (!existingRow) {
    throw new Error("Element is no longer available.");
  }

  const nextTransform = normalizeProfileImageTransform(profileImageTransform);
  const legacyReferenceSetState = buildLegacyReferenceSetStateFromFlatDraft({
    assetType,
    description,
    imageReferenceUrls,
    videoReferenceUrl,
  });
  const existingElementRow = existingRow as { name?: unknown; alias?: unknown; metadata: unknown };
  const nextMetadata = toObjectRecord(existingElementRow.metadata);
  nextMetadata[ELEMENT_ACTIVE_REFERENCE_SET_ID_KEY] = legacyReferenceSetState.activeSetId;
  nextMetadata[ELEMENT_ACTIVE_REFERENCE_SET_ASSET_TYPE_KEY] =
    legacyReferenceSetState.sets[legacyReferenceSetState.activeSetId]?.assetType ?? "image";
  nextMetadata[ELEMENT_REFERENCE_SET_TAB_ORDER_KEY] = legacyReferenceSetState.tabOrder;
  nextMetadata[ELEMENT_PROFILE_IMAGE_ZOOM_KEY] = nextTransform.zoom;
  nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_X_KEY] = nextTransform.offsetX;
  nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_Y_KEY] = nextTransform.offsetY;

  const resolvedName = name.trim() || DEFAULT_ELEMENT_NAME;
  const resolvedAlias = deriveElementAliasFromName(resolvedName);
  const existingName = typeof existingElementRow.name === "string" ? existingElementRow.name : "";
  const existingAlias =
    typeof existingElementRow.alias === "string" ? existingElementRow.alias.trim() : "";
  const previousCanonicalAlias = deriveElementAliasFromName(existingName);
  // Keep one legacy token available so renamed elements can still rewrite older prompts/snapshots.
  const compatibilityAlias =
    resolvedAlias === previousCanonicalAlias
      ? existingAlias || resolvedAlias
      : existingAlias && existingAlias.toLowerCase() !== previousCanonicalAlias.toLowerCase()
        ? existingAlias
        : previousCanonicalAlias || existingAlias || resolvedAlias;
  const nextStatus: ElementStatus = name.trim().length >= 2 ? "ready" : "draft";
  const { data: updatedRow, error: updateError } = await supabase
    .from("elements")
    .update({
      name: resolvedName,
      alias: compatibilityAlias,
      status: nextStatus,
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", elementId)
    .select("updated_at")
    .single();
  if (updateError) {
    throw new Error(asErrorMessage(updateError, "Failed to save element."));
  }

  const setRows = legacyReferenceSetState.tabOrder.map((setId) => {
    const set = legacyReferenceSetState.sets[setId];
    return {
      element_id: elementId,
      user_id: userId,
      set_key: setId,
      label:
        legacyReferenceSetState.tabLabels[setId] ?? createDefaultElementReferenceSetLabels()[setId],
      description: set.description.trim(),
      asset_type: set.assetType,
      deck_reference_urls: set.deckReferenceUrls.filter(Boolean).slice(0, 6),
      image_reference_urls: set.imageReferenceUrls.filter(Boolean).slice(0, 6),
      video_reference_url: set.videoReferenceUrl.trim() || null,
    };
  });

  if (setRows.length) {
    const { error: upsertError } = await supabase.from("element_reference_sets").upsert(setRows, {
      onConflict: "element_id,set_key",
    });
    if (upsertError) {
      throw new Error(asErrorMessage(upsertError, "Failed to save element reference sets."));
    }
  }

  const staleSetIds = ELEMENT_REFERENCE_SET_IDS.filter(
    (setId) => !legacyReferenceSetState.tabOrder.includes(setId)
  );
  if (staleSetIds.length) {
    const { error: deleteError } = await supabase
      .from("element_reference_sets")
      .delete()
      .eq("user_id", userId)
      .eq("element_id", elementId)
      .in("set_key", staleSetIds);
    if (deleteError) {
      throw new Error(asErrorMessage(deleteError, "Failed to prune element reference sets."));
    }
  }

  return {
    updatedAt: updatedRow?.updated_at ?? new Date().toISOString(),
    status: nextStatus,
  };
};

export const uploadElementProfileImage = async ({
  elementId,
  file,
}: {
  elementId: string;
  file: File;
}): Promise<{
  profileImageUrl: string;
  profileImageTransform: ElementProfileImageTransform;
  mediaAssetId: string;
  storagePath: string;
}> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: elementRow, error: elementError } = await supabase
    .from("elements")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", elementId)
    .maybeSingle();
  if (elementError) {
    throw new Error(asErrorMessage(elementError, "Failed to load element profile metadata."));
  }
  if (!elementRow) {
    throw new Error("Element is no longer available.");
  }

  const existingProfile = getElementProfileImageMetadata(
    (elementRow as { metadata: unknown }).metadata
  );
  const mimeType = file.type || "image/jpeg";
  const storagePath = createElementProfileStoragePath({
    userId,
    elementId,
    filename: file.name,
    mimeType,
  });
  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(storagePath, file, {
      upsert: false,
      contentType: mimeType,
    });
  if (uploadError) {
    throw new Error(asErrorMessage(uploadError, "Failed to upload element profile image."));
  }

  let mediaAssetId: string;
  try {
    const createdAsset = await createElementMediaAsset({
      userId,
      elementId,
      storagePath,
      filename: file.name,
      fileType: "image",
      fileSize: file.size,
      metadata: {
        role: "element_profile",
      },
    });
    mediaAssetId = createdAsset.id;
  } catch (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([storagePath]);
    throw new Error(asErrorMessage(error, "Failed to save element profile metadata."));
  }

  const nextMetadata = toObjectRecord((elementRow as { metadata: unknown }).metadata);
  nextMetadata[ELEMENT_PROFILE_IMAGE_STORAGE_PATH_KEY] = storagePath;
  nextMetadata[ELEMENT_PROFILE_IMAGE_MEDIA_ASSET_ID_KEY] = mediaAssetId;
  nextMetadata[ELEMENT_PROFILE_IMAGE_ZOOM_KEY] = DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM.zoom;
  nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_X_KEY] =
    DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM.offsetX;
  nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_Y_KEY] =
    DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM.offsetY;

  const { error: updateError } = await supabase
    .from("elements")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", elementId);
  if (updateError) {
    await cleanupOrphanedElementMedia({
      mediaAssetId,
      storagePath,
    });
    throw new Error(asErrorMessage(updateError, "Failed to save element profile image."));
  }

  if (existingProfile.mediaAssetId && existingProfile.mediaAssetId !== mediaAssetId) {
    await cleanupOrphanedElementMedia({
      mediaAssetId: existingProfile.mediaAssetId,
      storagePath: existingProfile.storagePath,
    });
  }

  const profileImageUrl =
    (await getSignedMediaUrl({
      bucket: MEDIA_BUCKET,
      storagePath,
      forceRefresh: true,
    })) ?? null;
  if (!profileImageUrl) {
    throw new Error("Element profile image saved, but preview URL could not be created.");
  }
  return {
    profileImageUrl,
    profileImageTransform: DEFAULT_ELEMENT_PROFILE_IMAGE_TRANSFORM,
    mediaAssetId,
    storagePath,
  };
};

export const clearElementProfileImage = async ({
  elementId,
}: {
  elementId: string;
}): Promise<void> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: elementRow, error: elementError } = await supabase
    .from("elements")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", elementId)
    .maybeSingle();
  if (elementError) {
    throw new Error(asErrorMessage(elementError, "Failed to load element profile metadata."));
  }
  if (!elementRow) {
    throw new Error("Element is no longer available.");
  }

  const existingProfile = getElementProfileImageMetadata(
    (elementRow as { metadata: unknown }).metadata
  );
  if (!existingProfile.mediaAssetId && !existingProfile.storagePath) {
    return;
  }

  const nextMetadata = toObjectRecord((elementRow as { metadata: unknown }).metadata);
  delete nextMetadata[ELEMENT_PROFILE_IMAGE_STORAGE_PATH_KEY];
  delete nextMetadata[ELEMENT_PROFILE_IMAGE_MEDIA_ASSET_ID_KEY];
  delete nextMetadata[ELEMENT_PROFILE_IMAGE_ZOOM_KEY];
  delete nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_X_KEY];
  delete nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_Y_KEY];

  const { error: updateError } = await supabase
    .from("elements")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", elementId);
  if (updateError) {
    throw new Error(asErrorMessage(updateError, "Failed to clear element profile image."));
  }

  if (existingProfile.mediaAssetId) {
    await cleanupOrphanedElementMedia({
      mediaAssetId: existingProfile.mediaAssetId,
      storagePath: existingProfile.storagePath,
    });
  }
};

export const saveElementProfileImageAdjustments = async ({
  elementId,
  transform,
}: {
  elementId: string;
  transform: ElementProfileImageTransform;
}): Promise<ElementProfileImageTransform> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: elementRow, error: elementError } = await supabase
    .from("elements")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", elementId)
    .maybeSingle();
  if (elementError) {
    throw new Error(asErrorMessage(elementError, "Failed to load element profile metadata."));
  }
  if (!elementRow) {
    throw new Error("Element is no longer available.");
  }

  const nextTransform = normalizeProfileImageTransform(transform);
  const nextMetadata = toObjectRecord((elementRow as { metadata: unknown }).metadata);
  nextMetadata[ELEMENT_PROFILE_IMAGE_ZOOM_KEY] = nextTransform.zoom;
  nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_X_KEY] = nextTransform.offsetX;
  nextMetadata[ELEMENT_PROFILE_IMAGE_OFFSET_Y_KEY] = nextTransform.offsetY;

  const { error: updateError } = await supabase
    .from("elements")
    .update({
      metadata: nextMetadata,
    })
    .eq("user_id", userId)
    .eq("id", elementId);
  if (updateError) {
    throw new Error(asErrorMessage(updateError, "Failed to save element profile adjustments."));
  }
  return nextTransform;
};

export const deleteElementManagerDraft = async ({
  elementId,
}: {
  elementId: string;
}): Promise<void> => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: elementRow, error: elementError } = await supabase
    .from("elements")
    .select("metadata")
    .eq("user_id", userId)
    .eq("id", elementId)
    .maybeSingle();
  if (elementError) {
    throw new Error(asErrorMessage(elementError, "Failed to load element for deletion."));
  }
  if (!elementRow) {
    return;
  }

  const existingProfile = getElementProfileImageMetadata(
    (elementRow as { metadata: unknown }).metadata
  );
  const { error: deleteError } = await supabase
    .from("elements")
    .delete()
    .eq("user_id", userId)
    .eq("id", elementId);
  if (deleteError) {
    throw new Error(asErrorMessage(deleteError, "Failed to delete element."));
  }

  if (existingProfile.mediaAssetId) {
    await cleanupOrphanedElementMedia({
      mediaAssetId: existingProfile.mediaAssetId,
      storagePath: existingProfile.storagePath,
    });
  }
};

export const cleanupOrphanedElementMedia = async ({
  mediaAssetId,
  storagePath,
}: {
  mediaAssetId: string;
  storagePath: string | null;
}) => {
  const { supabase, userId } = await resolveSupabaseContext();
  const { data: rows, error: rowsError } = await supabase
    .from("elements")
    .select("metadata")
    .eq("user_id", userId);
  if (rowsError) {
    throw new Error(asErrorMessage(rowsError, "Failed to validate element media references."));
  }
  const isStillReferenced = (rows ?? []).some((row) => {
    const metadata = toObjectRecord((row as { metadata: unknown }).metadata);
    return asText(metadata[ELEMENT_PROFILE_IMAGE_MEDIA_ASSET_ID_KEY]) === mediaAssetId;
  });
  if (isStillReferenced) {
    return;
  }

  const { data: deletedRows, error: deleteError } = await supabase
    .from("element_media_assets")
    .delete()
    .eq("user_id", userId)
    .eq("id", mediaAssetId)
    .select("id");
  if (deleteError) {
    throw new Error(asErrorMessage(deleteError, "Failed to clean up unused element media."));
  }
  if (!deletedRows?.length) {
    return;
  }

  if (storagePath) {
    const { error: removeStorageError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .remove([storagePath]);
    if (removeStorageError) {
      // Storage cleanup is best-effort for deleted/missing objects.
    }
    invalidateSignedMediaUrl(MEDIA_BUCKET, storagePath);
  }
};
