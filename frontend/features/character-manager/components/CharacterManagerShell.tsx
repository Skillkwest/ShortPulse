/**
 * Character Manager page shell.
 * Provides a simplified character creation uploader and a placeholder manage tab.
 */
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  CaretDown,
  Plus,
  PencilSimpleLine,
  ShieldCheck,
  Trash,
  UploadSimple,
  XCircle,
} from "phosphor-react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import {
  isAdaptiveSurfaceEnabled,
  logAdaptiveDetailFullQualityUsed,
  resolveAdaptiveMedia,
  resolveAdaptiveSourceKind,
} from "../../../lib/adaptive-media";
import { reportAppError } from "../../../lib/appErrorReporter";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "../../billing/catalog";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { isTrustedMediaDirectPreviewUrl } from "../../../lib/mediaPreviewTrustPolicy";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import {
  CHARACTER_MANAGER_SLOT_DEFINITIONS,
  CHARACTER_MANAGER_SLOT_LABEL_BY_KEY,
  CHARACTER_SHEET_DROP_ZONES,
  CHARACTER_SHEET_PRESET_IDS,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import type {
  CharacterProfileImageTransform,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
  CharacterSheetPresetId,
  CharacterReferenceSlotKey,
} from "../types";

type CharacterWorkflowTab = "create" | "manage";
type CharacterManagerShellSurface = "page" | "panel";
type CharacterManagerShellProps = {
  surface?: CharacterManagerShellSurface;
  beginnerModeOverride?: boolean;
};
const SIMPLE_REFERENCE_IMAGE_LIMIT = 10;
const PROFILE_ZOOM_MIN = 1;
const PROFILE_ZOOM_MAX = 2.4;
const PROFILE_OFFSET_MIN = -40;
const PROFILE_OFFSET_MAX = 40;
const PROFILE_PREVIEW_IMAGE_SIZE = 172;
const PROFILE_PREVIEW_IMAGE_EMBEDDED_SIZE = 84;
const CHARACTER_CHIP_AVATAR_SIZE = 44;
const CHARACTER_DESCRIPTION_MAX_LENGTH = 150;
const CHARACTER_DESCRIPTION_HELPER_TEXT =
  "Tip: Character description will be used as part of consistency generation.";
const DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO = 4 / 5;
const DEFAULT_PLAN_TIER = "business";
const DND_REFERENCE_SLOT_KEY = "application/x-shortpulse-reference-slot-key";
const DND_CHARACTER_SHEET_ZONE_KEY = "application/x-shortpulse-character-sheet-zone-key";
const DROPPED_IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const SUPABASE_STORAGE_OBJECT_URL_PATTERN =
  /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/i;
const DRAG_GHOST_SCALE = 0.74;
const CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY = "shortpulse.character_manager.beginner_mode";
const MEDIA_BUCKET = "media_library";
const DROPPED_REFERENCE_TELEMETRY_SOURCE = "client.character_manager.drop_reference";

const DEFAULT_PROFILE_IMAGE_TRANSFORM: CharacterProfileImageTransform = {
  zoom: PROFILE_ZOOM_MIN,
  offsetX: 0,
  offsetY: 0,
};

const PLAN_MAP: Record<string, { label: string; className: string }> = {
  free: { label: "Free", className: "plan-free" },
  media: { label: "Media", className: "plan-media" },
  studio: { label: "Studio", className: "plan-studio" },
  business: { label: "Business", className: "plan-business" },
};

function clampReferencePreviewAspectRatio(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO;
  }
  return Math.min(Math.max(value, 0.45), 2.8);
}

function buildProfileImageTransformStyle(
  transform: CharacterProfileImageTransform,
  renderSize: number
): React.CSSProperties {
  const offsetScale = renderSize / PROFILE_PREVIEW_IMAGE_SIZE;
  const offsetX = Math.round(transform.offsetX * offsetScale * 100) / 100;
  const offsetY = Math.round(transform.offsetY * offsetScale * 100) / 100;
  return {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${transform.zoom})`,
    transformOrigin: "center center",
  };
}

const resolveInitialBeginnerMode = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY);
    if (stored == null) return true;
    return stored === "true";
  } catch {
    return true;
  }
};

type DroppedImageReference = {
  url: string;
  mimeType: string | null;
  mediaFileId: string | null;
};

type DroppedStorageCandidate = {
  bucket: string;
  storagePath: string;
};

const sanitizeFilenameSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const parseDropUrlCandidate = (value: string | null | undefined): string | null => {
  const candidate = (value ?? "").trim();
  if (!candidate || /^data:video\//i.test(candidate)) return null;
  if (/^data:image\//i.test(candidate)) return candidate;
  if (/^blob:/i.test(candidate)) return candidate;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
};

const parseDropMediaFileId = (value: string | null | undefined): string | null => {
  const candidate = (value ?? "").trim();
  return candidate.length ? candidate : null;
};

const isTrustedDroppedImageUrl = (url: string): boolean => {
  if (/^data:image\//i.test(url)) return true;
  if (/^blob:/i.test(url)) return true;
  return isTrustedMediaDirectPreviewUrl(url, { requireUserScope: false });
};

const extractFirstUriListEntry = (value: string | null | undefined): string | null =>
  (value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0 && !entry.startsWith("#")) ?? null;

const inferMimeTypeFromUrl = (url: string): string | null => {
  if (/^data:image\//i.test(url)) {
    const match = url.match(/^data:(image\/[^;,]+)[;,]/i);
    return match?.[1]?.toLowerCase() ?? "image/png";
  }
  if (!DROPPED_IMAGE_URL_PATTERN.test(url)) return null;
  const extension = url.split("?")[0]?.split("#")[0]?.split(".").pop()?.toLowerCase();
  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    case "bmp":
      return "image/bmp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    default:
      return null;
  }
};

const parseDroppedStorageCandidateFromUrl = (url: string): DroppedStorageCandidate | null => {
  try {
    const parsedUrl = new URL(url);
    const pathMatch = parsedUrl.pathname.match(SUPABASE_STORAGE_OBJECT_URL_PATTERN);
    if (!pathMatch) return null;
    const bucket = (pathMatch[1] ?? "").trim();
    const storagePath = decodeURIComponent(pathMatch[2] ?? "")
      .replace(/^\/+/, "")
      .trim();
    if (!bucket || !storagePath) return null;
    return {
      bucket,
      storagePath,
    };
  } catch {
    return null;
  }
};

const dedupeDroppedStorageCandidates = (
  candidates: DroppedStorageCandidate[]
): DroppedStorageCandidate[] => {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.bucket}:${candidate.storagePath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const resolveDroppedStorageCandidates = async (
  reference: DroppedImageReference
): Promise<DroppedStorageCandidate[]> => {
  const candidates: DroppedStorageCandidate[] = [];
  const urlCandidate = parseDroppedStorageCandidateFromUrl(reference.url);
  if (urlCandidate) {
    candidates.push(urlCandidate);
  }

  if (reference.mediaFileId) {
    try {
      const supabase = ensureSupabaseClient();
      const { data, error } = await supabase
        .from("media_files")
        .select("storage_path")
        .eq("id", reference.mediaFileId)
        .maybeSingle();
      if (!error) {
        const mediaRow = data as { storage_path: string | null } | null;
        const storagePath = (mediaRow?.storage_path ?? "").trim();
        if (storagePath) {
          candidates.unshift({
            bucket: MEDIA_BUCKET,
            storagePath,
          });
        }
      }
    } catch {
      // Fallback-only lookup: ignore metadata-query failures and rely on URL-based download.
    }
  }

  return dedupeDroppedStorageCandidates(candidates);
};

const downloadDroppedReferenceBlob = async (
  reference: DroppedImageReference
): Promise<{ blob: Blob; resolvedStoragePath: string | null }> => {
  let directFetchError: Error | null = null;
  try {
    const response = await fetch(reference.url);
    if (response.ok) {
      return {
        blob: await response.blob(),
        resolvedStoragePath: null,
      };
    }
    directFetchError = new Error(`Failed to read dropped image (${response.status}).`);
  } catch (nextError) {
    directFetchError =
      nextError instanceof Error ? nextError : new Error("Failed to read dropped image.");
  }

  const storageCandidates = await resolveDroppedStorageCandidates(reference);
  if (storageCandidates.length) {
    let downloadError: Error | null = null;
    const supabase = ensureSupabaseClient();
    for (const candidate of storageCandidates) {
      const { data, error } = await supabase.storage
        .from(candidate.bucket)
        .download(candidate.storagePath);
      if (error || !data) {
        downloadError = new Error(
          `Failed to read dropped image from storage (${candidate.bucket}/${candidate.storagePath}).`
        );
        continue;
      }
      return {
        blob: data,
        resolvedStoragePath: candidate.storagePath,
      };
    }
    if (downloadError) {
      throw downloadError;
    }
  }

  if (directFetchError) {
    throw directFetchError;
  }
  throw new Error("Failed to read dropped image.");
};

const resolveDroppedImageReference = (transfer: DataTransfer | null | undefined) => {
  if (!transfer) return null;
  const mediaFileId =
    parseDropMediaFileId(transfer.getData("text/reference-media-id")) ??
    parseDropMediaFileId(transfer.getData("text/reference-id"));

  const explicitReferenceUrl = parseDropUrlCandidate(transfer.getData("text/reference-url"));
  if (explicitReferenceUrl && isTrustedDroppedImageUrl(explicitReferenceUrl)) {
    return {
      url: explicitReferenceUrl,
      mimeType: inferMimeTypeFromUrl(explicitReferenceUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  const uriListEntry = extractFirstUriListEntry(transfer.getData("text/uri-list"));
  const uriListUrl = parseDropUrlCandidate(uriListEntry);
  if (
    uriListUrl &&
    isTrustedDroppedImageUrl(uriListUrl) &&
    (DROPPED_IMAGE_URL_PATTERN.test(uriListUrl) || /^data:image\//i.test(uriListUrl))
  ) {
    return {
      url: uriListUrl,
      mimeType: inferMimeTypeFromUrl(uriListUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  const imageUrl = parseDropUrlCandidate(transfer.getData("image/url"));
  if (imageUrl && isTrustedDroppedImageUrl(imageUrl)) {
    return {
      url: imageUrl,
      mimeType: inferMimeTypeFromUrl(imageUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  const plainTextUrl = parseDropUrlCandidate(transfer.getData("text/plain"));
  if (
    plainTextUrl &&
    isTrustedDroppedImageUrl(plainTextUrl) &&
    (DROPPED_IMAGE_URL_PATTERN.test(plainTextUrl) || /^data:image\//i.test(plainTextUrl))
  ) {
    return {
      url: plainTextUrl,
      mimeType: inferMimeTypeFromUrl(plainTextUrl),
      mediaFileId,
    } satisfies DroppedImageReference;
  }

  return null;
};

const hasDroppedImageReferenceTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  const transferTypes = Array.from(transfer.types ?? []).map((value) => value.toLowerCase());
  if (
    transferTypes.includes("text/reference-url") ||
    transferTypes.includes("text/uri-list") ||
    transferTypes.includes("image/url")
  ) {
    return true;
  }
  return Boolean(resolveDroppedImageReference(transfer));
};

const toDroppedReferenceFile = async (reference: DroppedImageReference): Promise<File> => {
  const { blob, resolvedStoragePath } = await downloadDroppedReferenceBlob(reference);
  const resolvedMimeType = (blob.type || reference.mimeType || "").toLowerCase() || "image/jpeg";
  if (!resolvedMimeType.startsWith("image/")) {
    throw new Error("Dropped media is not an image.");
  }
  const extension = (() => {
    switch (resolvedMimeType) {
      case "image/jpeg":
        return "jpg";
      case "image/png":
        return "png";
      case "image/webp":
        return "webp";
      case "image/gif":
        return "gif";
      case "image/svg+xml":
        return "svg";
      case "image/avif":
        return "avif";
      case "image/bmp":
        return "bmp";
      case "image/heic":
        return "heic";
      case "image/heif":
        return "heif";
      default:
        return "jpg";
    }
  })();

  const parsedName = (() => {
    const storagePathSegment = resolvedStoragePath?.split("/").pop() ?? "";
    const cleanedStoragePathSegment = sanitizeFilenameSegment(storagePathSegment);
    if (cleanedStoragePathSegment) {
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(cleanedStoragePathSegment);
      return hasExtension ? cleanedStoragePathSegment : `${cleanedStoragePathSegment}.${extension}`;
    }
    try {
      const pathSegment = new URL(reference.url).pathname.split("/").pop() ?? "";
      const cleaned = sanitizeFilenameSegment(pathSegment);
      if (!cleaned) return null;
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(cleaned);
      return hasExtension ? cleaned : `${cleaned}.${extension}`;
    } catch {
      return null;
    }
  })();
  const fallbackName = `reference-drop-${Date.now()}.${extension}`;

  return new File([blob], parsedName ?? fallbackName, {
    type: resolvedMimeType,
  });
};

/**
 * Orchestrates simple character creation flow while advanced uploader remains hidden.
 */
export function CharacterManagerShell({
  surface = "page",
  beginnerModeOverride,
}: CharacterManagerShellProps) {
  const {
    characters,
    selectedCharacterId,
    characterName,
    characterDescription,
    activeCharacterSheetPresetId,
    characterSheetPresetAssignments,
    profileImageUrl,
    profileImageTransform,
    slots,
    error,
    loading,
    isSavingName,
    isCreatingCharacter,
    isDeletingCharacter,
    isSwitchingCharacter,
    isSavingProfileImage,
    isSavingCharacterSheetPreset,
    setCharacterName,
    setCharacterDescription,
    setProfileImageFile,
    saveProfileImageTransform,
    clearProfileImage,
    setActiveCharacterSheetPreset,
    saveCharacterSheetPresetAssignments,
    setCharacterSheetPresetFile,
    setSlotFile,
    clearSlot,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    isSlotBusy,
    clearMessages,
  } = useCharacterManagerDraft();

  const [activeTab, setActiveTab] = useState<CharacterWorkflowTab>("create");
  const [isDropActive, setIsDropActive] = useState(false);
  const [isQuickSwapCollapsed, setIsQuickSwapCollapsed] = useState(false);
  const [draggedReferenceSlotKey, setDraggedReferenceSlotKey] =
    useState<CharacterReferenceSlotKey | null>(null);
  const [draggedCharacterSheetZoneKey, setDraggedCharacterSheetZoneKey] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [activeCharacterSheetDropZone, setActiveCharacterSheetDropZone] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [isProfileAdjusterVisible, setIsProfileAdjusterVisible] = useState(false);
  const [profileAdjustDraft, setProfileAdjustDraft] =
    useState<CharacterProfileImageTransform | null>(null);
  const [deleteTargetCharacter, setDeleteTargetCharacter] = useState<{
    characterId: string;
    characterName: string;
  } | null>(null);
  const [referencePreview, setReferencePreview] = useState<{
    index: number;
    aspectRatio: number;
  } | null>(null);
  const [referencePreviewSignedUrl, setReferencePreviewSignedUrl] = useState<{
    slotKey: CharacterReferenceSlotKey;
    url: string;
  } | null>(null);
  const [pendingCharacterSheetUploadZoneKey, setPendingCharacterSheetUploadZoneKey] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [pendingReferenceUploadSlotKey, setPendingReferenceUploadSlotKey] =
    useState<CharacterReferenceSlotKey | null>(null);
  const [beginnerMode, setBeginnerMode] = useState(resolveInitialBeginnerMode);
  const [user, setUser] = useState<User | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState<{ label: string; className: string } | null>(
    null
  );
  const characterNameInputRef = useRef<HTMLInputElement | null>(null);
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);
  const simpleFileInputRef = useRef<HTMLInputElement | null>(null);
  const characterSheetFileInputRef = useRef<HTMLInputElement | null>(null);
  const dragGhostMapRef = useRef(new Map<HTMLElement, HTMLElement>());
  const fileDragDepthRef = useRef(0);
  const pageBusy =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isDeletingCharacter ||
    isSavingProfileImage ||
    isSavingCharacterSheetPreset;
  const profileInitials = useMemo(() => {
    const words = characterName.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!words.length) return "NC";
    return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  }, [characterName]);
  const accountDisplayName =
    (user?.user_metadata?.display_name as string | undefined) ??
    (user?.user_metadata?.full_name as string | undefined) ??
    user?.email ??
    "ShortPulse";
  const accountInitials = useMemo(() => {
    return (
      accountDisplayName
        .split(" ")
        .filter((part) => part.trim().length > 0)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase() || "SP"
    );
  }, [accountDisplayName]);
  const fallbackPlanTier = normalizePlanId(
    (user?.user_metadata?.plan as string | undefined) ?? DEFAULT_PLAN_TIER
  );
  const fallbackPlanMeta = PLAN_MAP[fallbackPlanTier] ?? PLAN_MAP.business;
  const planMeta = resolvedPlan ?? fallbackPlanMeta;
  const activeProfileImageTransform =
    isProfileAdjusterVisible && profileAdjustDraft ? profileAdjustDraft : profileImageTransform;
  const resolvedCharacterSheetPresetAssignments = useMemo(
    () => characterSheetPresetAssignments ?? createEmptyCharacterSheetPresetAssignments(),
    [characterSheetPresetAssignments]
  );

  const simpleReferenceSlotKeys = useMemo(
    () =>
      CHARACTER_MANAGER_SLOT_DEFINITIONS.map((slot) => slot.key).slice(
        0,
        SIMPLE_REFERENCE_IMAGE_LIMIT
      ),
    []
  );

  const availableReferenceSlotKeys = useMemo(
    () => simpleReferenceSlotKeys.filter((slotKey) => !slots[slotKey]),
    [simpleReferenceSlotKeys, slots]
  );

  const uploadedReferenceEntries = useMemo(
    () =>
      simpleReferenceSlotKeys
        .map((slotKey) => {
          const slotFile = slots[slotKey];
          if (!slotFile) return null;
          return {
            slotKey,
            slotFile,
            slotLabel: CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey],
          };
        })
        .filter(
          (
            entry
          ): entry is {
            slotKey: (typeof simpleReferenceSlotKeys)[number];
            slotFile: NonNullable<(typeof slots)[(typeof simpleReferenceSlotKeys)[number]]>;
            slotLabel: string;
          } => Boolean(entry)
        ),
    [simpleReferenceSlotKeys, slots]
  );
  const referencePreviewEntry =
    referencePreview && uploadedReferenceEntries[referencePreview.index]
      ? uploadedReferenceEntries[referencePreview.index]
      : null;
  const resolveCharacterGridPreviewUrl = useCallback(
    (url: string | null | undefined, cardLongEdgePx: number): string | null => {
      const trimmed = url?.trim();
      if (!trimmed) return null;
      if (!isAdaptiveSurfaceEnabled("character-grid")) return trimmed;
      const resolved = resolveAdaptiveMedia({
        surface: "character-grid",
        mediaKind: "image",
        source: resolveAdaptiveSourceKind(trimmed),
        urls: {
          previewUrl: trimmed,
          fullUrl: trimmed,
        },
        storage: {},
        pressureLevel: 0,
        cardLongEdgePx,
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        strictPreviewLadder: true,
        adaptivePreviewQuality: true,
      });
      return resolved.previewUrl ?? trimmed;
    },
    []
  );
  const uploadedReferenceBySlotKey = useMemo(
    () => new Map(uploadedReferenceEntries.map((entry) => [entry.slotKey, entry])),
    [uploadedReferenceEntries]
  );
  const isEmbeddedSurface = surface === "panel";
  const RootContainer: "div" | "main" = isEmbeddedSurface ? "div" : "main";
  const profileImageRenderSize = isEmbeddedSurface
    ? PROFILE_PREVIEW_IMAGE_EMBEDDED_SIZE
    : PROFILE_PREVIEW_IMAGE_SIZE;
  const isBeginnerModeControlled = typeof beginnerModeOverride === "boolean";
  const effectiveBeginnerMode = isBeginnerModeControlled ? beginnerModeOverride : beginnerMode;
  const quickSwapContentId = useId();
  const rootClassName = isEmbeddedSurface
    ? "character-manager-page character-manager-page--embedded"
    : "page page-wide character-manager-page";

  useVisibleErrorTelemetry({
    source: "client.character_manager.error_banner",
    scope: "app",
    severity: "medium",
    message: error,
    metadata: {
      surface,
      active_tab: activeTab,
      beginner_mode: effectiveBeginnerMode,
      selected_character_id: selectedCharacterId,
    },
  });

  useEffect(() => {
    if (isBeginnerModeControlled) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CHARACTER_MANAGER_BEGINNER_MODE_STORAGE_KEY, String(beginnerMode));
  }, [beginnerMode, isBeginnerModeControlled]);

  useEffect(() => {
    let active = true;
    if (!referencePreviewEntry) return () => void (active = false);
    logAdaptiveDetailFullQualityUsed({
      surface: "detail-modal",
      mediaKind: "image",
    });
    void getSignedMediaUrl({
      bucket: MEDIA_BUCKET,
      storagePath: referencePreviewEntry.slotFile.storagePath,
      expiresInSeconds: 3600,
      forceRefresh: false,
    }).then((signedUrl) => {
      if (!active || !signedUrl) return;
      setReferencePreviewSignedUrl({
        slotKey: referencePreviewEntry.slotKey,
        url: signedUrl,
      });
    });

    return () => {
      active = false;
    };
  }, [referencePreviewEntry]);

  useEffect(() => {
    if (isEmbeddedSurface) return;
    let active = true;
    let unsubscribe: (() => void) | null = null;

    const bootstrapUser = async () => {
      try {
        const supabase = ensureSupabaseClient();
        const { data } = await supabase.auth.getUser();
        if (!active) return;
        setUser(data.user ?? null);
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "USER_UPDATED" || event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
            setUser(session?.user ?? null);
          }
          if (event === "SIGNED_OUT") {
            setUser(null);
          }
        });
        unsubscribe = () => authListener?.subscription?.unsubscribe();
      } catch {
        if (active) {
          setUser(null);
        }
      }
    };

    void bootstrapUser();
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [isEmbeddedSurface]);

  useEffect(() => {
    if (isEmbeddedSurface) return;
    let active = true;

    const loadPlan = async () => {
      if (!user) {
        if (!active) return;
        setResolvedPlan(null);
        return;
      }

      try {
        const supabase = ensureSupabaseClient();
        const [billingProfileResponse, billingPlansResponse] = await Promise.all([
          supabase.from("billing_profiles").select("plan_id").eq("user_id", user.id).maybeSingle(),
          supabase
            .from("billing_plans")
            .select("id, display_name, monthly_price_cents, monthly_credits_cents, is_active")
            .eq("is_active", true),
        ]);

        const billingPlanId =
          !billingProfileResponse.error && billingProfileResponse.data
            ? ((billingProfileResponse.data as { plan_id: string | null }).plan_id ?? null)
            : null;
        const effectivePlanId =
          billingPlanId ?? (user.user_metadata?.plan as string | undefined) ?? DEFAULT_PLAN_TIER;
        const normalizedPlanId = normalizePlanId(effectivePlanId);
        const plans =
          !billingPlansResponse.error && Array.isArray(billingPlansResponse.data)
            ? (billingPlansResponse.data as BillingPlanRecord[])
            : [];
        const planView = buildPlanView({
          planId: normalizedPlanId,
          plans,
        });
        const planFallback = PLAN_MAP[normalizedPlanId] ?? PLAN_MAP.business;
        const nextPlanLabel = plans.length > 0 ? planView.displayName : planFallback.label;

        if (!active) return;
        setResolvedPlan({
          label: nextPlanLabel,
          className: planView.className,
        });
      } catch {
        if (!active) return;
        setResolvedPlan(null);
      }
    };

    void loadPlan();
    return () => {
      active = false;
    };
  }, [isEmbeddedSurface, user]);

  useEffect(
    () => () => {
      for (const ghost of dragGhostMapRef.current.values()) {
        ghost.remove();
      }
      dragGhostMapRef.current.clear();
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const clearDropActiveState = () => {
      fileDragDepthRef.current = 0;
      setIsDropActive(false);
    };
    window.addEventListener("drop", clearDropActiveState);
    window.addEventListener("dragend", clearDropActiveState);
    return () => {
      window.removeEventListener("drop", clearDropActiveState);
      window.removeEventListener("dragend", clearDropActiveState);
    };
  }, []);

  const uploadSimpleFiles = useCallback(
    async (
      incomingFiles: FileList | File[],
      preferredSlotKey: CharacterReferenceSlotKey | null = null
    ) => {
      const files = Array.from(incomingFiles);
      if (!files.length || pageBusy || !availableReferenceSlotKeys.length) return;

      clearMessages();
      const targetSlotKeys = [...availableReferenceSlotKeys];
      if (preferredSlotKey && targetSlotKeys.includes(preferredSlotKey)) {
        targetSlotKeys.splice(targetSlotKeys.indexOf(preferredSlotKey), 1);
        targetSlotKeys.unshift(preferredSlotKey);
      }

      const assignableFiles = files.slice(0, targetSlotKeys.length);
      for (let index = 0; index < assignableFiles.length; index += 1) {
        const slotKey = targetSlotKeys[index];
        const file = assignableFiles[index];
        if (!slotKey || !file) continue;
        // Keep mapping deterministic: first dropped files fill first open reference slots.
        await setSlotFile(slotKey, file);
      }
    },
    [availableReferenceSlotKeys, clearMessages, pageBusy, setSlotFile]
  );

  const isFileDragEvent = useCallback((event: React.DragEvent<HTMLElement>) => {
    const transfer = event.dataTransfer;
    if (!transfer) return false;
    if (Array.from(transfer.types ?? []).includes("Files")) return true;
    if (transfer.items?.length) {
      return Array.from(transfer.items).some((item) => item.kind === "file");
    }
    return Boolean(transfer.files?.length);
  }, []);

  const isDroppedImageReferenceEvent = useCallback((event: React.DragEvent<HTMLElement>) => {
    return hasDroppedImageReferenceTransfer(event.dataTransfer);
  }, []);

  const handleSimpleFileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";
      const targetSlotKey = pendingReferenceUploadSlotKey;
      setPendingReferenceUploadSlotKey(null);
      if (!files.length) return;
      void uploadSimpleFiles(files, targetSlotKey);
    },
    [pendingReferenceUploadSlotKey, uploadSimpleFiles]
  );

  const openCharacterSheetPicker = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => {
      if (pageBusy) return;
      clearMessages();
      setPendingCharacterSheetUploadZoneKey(dropZoneKey);
      characterSheetFileInputRef.current?.click();
    },
    [clearMessages, pageBusy]
  );

  const openProfilePicker = useCallback(() => {
    if (pageBusy) return;
    if (profileImageUrl && !isProfileAdjusterVisible) {
      setProfileAdjustDraft(profileImageTransform);
      setIsProfileAdjusterVisible(true);
      return;
    }
    clearMessages();
    profileFileInputRef.current?.click();
  }, [clearMessages, isProfileAdjusterVisible, pageBusy, profileImageTransform, profileImageUrl]);

  const openSimpleReferenceSlotPicker = useCallback(
    (slotKey: CharacterReferenceSlotKey) => {
      if (pageBusy || isSlotBusy(slotKey)) return;
      clearMessages();
      setPendingReferenceUploadSlotKey(slotKey);
      simpleFileInputRef.current?.click();
    },
    [clearMessages, isSlotBusy, pageBusy]
  );

  const handleProfileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || pageBusy) return;
      void setProfileImageFile(file);
      setProfileAdjustDraft(DEFAULT_PROFILE_IMAGE_TRANSFORM);
      setIsProfileAdjusterVisible(true);
    },
    [pageBusy, setProfileImageFile]
  );

  const clearProfilePreview = useCallback(() => {
    void clearProfileImage();
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);
    if (profileFileInputRef.current) {
      profileFileInputRef.current.value = "";
    }
  }, [clearProfileImage]);

  const handleCreateNewCharacter = useCallback(() => {
    setActiveTab("create");
    setProfileAdjustDraft(null);
    setIsProfileAdjusterVisible(false);

    void createCharacter().finally(() => {
      setActiveTab("create");
      window.requestAnimationFrame(() => {
        characterNameInputRef.current?.focus();
      });
    });
  }, [createCharacter]);

  const saveProfileAdjustments = useCallback(async () => {
    if (!profileImageUrl) {
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
      return;
    }

    const didSave = await saveProfileImageTransform({
      zoom: activeProfileImageTransform.zoom,
      offsetX: activeProfileImageTransform.offsetX,
      offsetY: activeProfileImageTransform.offsetY,
    });
    if (didSave) {
      setProfileAdjustDraft(null);
      setIsProfileAdjusterVisible(false);
    }
  }, [activeProfileImageTransform, profileImageUrl, saveProfileImageTransform]);

  const getCharacterInitials = useCallback((name: string) => {
    const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!words.length) return "NC";
    return words.map((word) => word[0]?.toUpperCase() ?? "").join("");
  }, []);

  const cancelDeleteCharacter = useCallback(() => {
    if (isDeletingCharacter) return;
    setDeleteTargetCharacter(null);
  }, [isDeletingCharacter]);

  const confirmDeleteCharacter = useCallback(async () => {
    if (!deleteTargetCharacter) return;
    const deleted = await deleteCharacter(deleteTargetCharacter.characterId);
    if (deleted) {
      setDeleteTargetCharacter(null);
    }
  }, [deleteCharacter, deleteTargetCharacter]);

  const applyDragGhost = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    const transfer = event.dataTransfer;
    try {
      const rect = dragNode.getBoundingClientRect();
      const ghost = dragNode.cloneNode(true) as HTMLElement;
      const scaledWidth = Math.max(56, rect.width * DRAG_GHOST_SCALE);
      const scaledHeight = Math.max(72, rect.height * DRAG_GHOST_SCALE);
      ghost.classList.add("character-drag-ghost");
      ghost.style.boxSizing = "border-box";
      ghost.style.width = `${scaledWidth}px`;
      ghost.style.height = `${scaledHeight}px`;
      ghost.style.transform = `scale(${DRAG_GHOST_SCALE}) rotate(-2deg)`;
      ghost.style.transformOrigin = "center";
      ghost.style.position = "absolute";
      ghost.style.top = "-9999px";
      ghost.style.left = "-9999px";
      ghost.style.pointerEvents = "none";
      ghost.style.opacity = "0.96";

      document.body.appendChild(ghost);
      dragGhostMapRef.current.set(dragNode, ghost);
      transfer.setDragImage(ghost, scaledWidth / 2, scaledHeight / 2);
    } catch {
      transfer.setDragImage(dragNode, dragNode.offsetWidth / 2, dragNode.offsetHeight / 2);
    }
    dragNode.classList.add("is-dragging");
  }, []);

  const persistCharacterSheetPresetAssignments = useCallback(
    (nextAssignments: CharacterSheetPresetAssignments) => {
      if (!selectedCharacterId) return;
      void saveCharacterSheetPresetAssignments(nextAssignments);
    },
    [saveCharacterSheetPresetAssignments, selectedCharacterId]
  );

  const assignReferenceToCharacterSheetSlot = useCallback(
    (
      characterSheetSlotKey: CharacterSheetDropZoneKey,
      referenceSlotKey: CharacterReferenceSlotKey
    ) => {
      if (!selectedCharacterId) return;
      const referenceEntry = uploadedReferenceBySlotKey.get(referenceSlotKey);
      if (!referenceEntry) return;
      const nextAssignments = {
        ...resolvedCharacterSheetPresetAssignments,
        [characterSheetSlotKey]: {
          mediaFileId: referenceEntry.slotFile.mediaFileId,
          storagePath: referenceEntry.slotFile.storagePath,
          previewUrl: referenceEntry.slotFile.previewUrl,
        },
      };
      persistCharacterSheetPresetAssignments(nextAssignments);
    },
    [
      persistCharacterSheetPresetAssignments,
      resolvedCharacterSheetPresetAssignments,
      selectedCharacterId,
      uploadedReferenceBySlotKey,
    ]
  );

  const handleCharacterSheetFileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0] ?? null;
      event.target.value = "";
      const targetDropZone = pendingCharacterSheetUploadZoneKey;
      setPendingCharacterSheetUploadZoneKey(null);

      if (!file || !targetDropZone || pageBusy) return;
      void setCharacterSheetPresetFile(targetDropZone, file);
    },
    [pageBusy, pendingCharacterSheetUploadZoneKey, setCharacterSheetPresetFile]
  );

  const setCharacterSheetFileFromDroppedReference = useCallback(
    async (zoneKey: CharacterSheetDropZoneKey, reference: DroppedImageReference) => {
      try {
        const file = await toDroppedReferenceFile(reference);
        await setCharacterSheetPresetFile(zoneKey, file);
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to process dropped Character Sheet reference.";
        void reportAppError({
          source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
          scope: "app",
          severity: "low",
          message: "character_sheet_drop_reference_failed",
          metadata: {
            target: "character_sheet",
            drop_zone_key: zoneKey,
            reference_media_file_id: reference.mediaFileId,
            reason: errorMessage,
          },
        });
      }
    },
    [setCharacterSheetPresetFile]
  );

  const addDroppedReferenceToQuickSwap = useCallback(
    async (reference: DroppedImageReference) => {
      try {
        const file = await toDroppedReferenceFile(reference);
        await uploadSimpleFiles([file]);
      } catch (error) {
        const errorMessage =
          error instanceof Error && error.message.trim().length
            ? error.message
            : "Failed to process dropped QuickSwap reference.";
        void reportAppError({
          source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
          scope: "app",
          severity: "low",
          message: "quickswap_drop_reference_failed",
          metadata: {
            target: "quickswap",
            reference_media_file_id: reference.mediaFileId,
            reason: errorMessage,
          },
        });
      }
    },
    [uploadSimpleFiles]
  );

  const openReferencePreview = useCallback((index: number, aspectRatio: number | null) => {
    setReferencePreview({
      index,
      aspectRatio: clampReferencePreviewAspectRatio(aspectRatio),
    });
  }, []);

  const closeReferencePreview = useCallback(() => {
    setReferencePreview(null);
    setReferencePreviewSignedUrl(null);
  }, []);

  const navigateReferencePreview = useCallback(
    (step: -1 | 1) => {
      setReferencePreview((current) => {
        if (!current || uploadedReferenceEntries.length === 0) return current;
        const total = uploadedReferenceEntries.length;
        const nextIndex = (current.index + step + total) % total;
        const nextEntry = uploadedReferenceEntries[nextIndex];
        return {
          index: nextIndex,
          aspectRatio: clampReferencePreviewAspectRatio(
            nextEntry?.slotFile.validationNotes.aspectRatio ?? null
          ),
        };
      });
    },
    [uploadedReferenceEntries]
  );

  const handleReferenceDragStart = useCallback(
    (slotKey: CharacterReferenceSlotKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy || isSlotBusy(slotKey)) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DND_REFERENCE_SLOT_KEY, slotKey);
      event.dataTransfer.setData("text/plain", slotKey);
      setDraggedReferenceSlotKey(slotKey);
      setDraggedCharacterSheetZoneKey(null);
      applyDragGhost(event);
    },
    [applyDragGhost, isSlotBusy, pageBusy]
  );

  const handleCharacterSheetDragStart = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy) {
        event.preventDefault();
        return;
      }
      const assignedReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
      if (!assignedReference) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(DND_CHARACTER_SHEET_ZONE_KEY, characterSheetSlotKey);
      event.dataTransfer.setData(DND_REFERENCE_SLOT_KEY, assignedReference.mediaFileId);
      event.dataTransfer.setData("text/plain", assignedReference.mediaFileId);
      setDraggedCharacterSheetZoneKey(characterSheetSlotKey);
      setDraggedReferenceSlotKey(null);
      applyDragGhost(event);
    },
    [applyDragGhost, pageBusy, resolvedCharacterSheetPresetAssignments]
  );

  const handleReferenceDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    dragNode.classList.remove("is-dragging");
    const ghost = dragGhostMapRef.current.get(dragNode);
    if (ghost) {
      ghost.remove();
      dragGhostMapRef.current.delete(dragNode);
    }
    setDraggedReferenceSlotKey(null);
    setDraggedCharacterSheetZoneKey(null);
    setActiveCharacterSheetDropZone(null);
  }, []);

  const handleCharacterSheetDragOver = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(DND_CHARACTER_SHEET_ZONE_KEY) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      const droppedSlotKey =
        (event.dataTransfer.getData(DND_REFERENCE_SLOT_KEY) as CharacterReferenceSlotKey | "") ||
        (event.dataTransfer.getData("text/plain") as CharacterReferenceSlotKey | "") ||
        draggedReferenceSlotKey;
      const normalizedDroppedSlotKey =
        typeof droppedSlotKey === "string" && droppedSlotKey.length > 0
          ? (droppedSlotKey as CharacterReferenceSlotKey)
          : null;
      const hasExternalImageReference = hasDroppedImageReferenceTransfer(event.dataTransfer);
      const isInternalSheetDrag =
        Boolean(sourceCharacterSheetZoneKey) &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey);
      const isInternalReferenceDrag =
        normalizedDroppedSlotKey !== null &&
        uploadedReferenceBySlotKey.has(normalizedDroppedSlotKey);
      if (!isInternalSheetDrag && !isInternalReferenceDrag && !hasExternalImageReference) return;
      event.preventDefault();
      event.dataTransfer.dropEffect =
        isInternalSheetDrag || isInternalReferenceDrag ? "move" : "copy";
      setActiveCharacterSheetDropZone(characterSheetSlotKey);
    },
    [draggedCharacterSheetZoneKey, draggedReferenceSlotKey, pageBusy, uploadedReferenceBySlotKey]
  );

  const clearCharacterSheetAssignment = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => {
      if (!selectedCharacterId) return;
      const assignedReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
      if (!assignedReference) return;
      const nextAssignments = {
        ...resolvedCharacterSheetPresetAssignments,
        [characterSheetSlotKey]: null,
      };
      persistCharacterSheetPresetAssignments(nextAssignments);
    },
    [
      persistCharacterSheetPresetAssignments,
      resolvedCharacterSheetPresetAssignments,
      selectedCharacterId,
    ]
  );

  const handleCharacterSheetDrop = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      event.preventDefault();
      setActiveCharacterSheetDropZone(null);
      if (pageBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(DND_CHARACTER_SHEET_ZONE_KEY) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      if (
        sourceCharacterSheetZoneKey &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey)
      ) {
        const sourceReference =
          resolvedCharacterSheetPresetAssignments[sourceCharacterSheetZoneKey];
        if (!sourceReference) return;
        if (sourceCharacterSheetZoneKey === characterSheetSlotKey) return;
        const targetReference = resolvedCharacterSheetPresetAssignments[characterSheetSlotKey];
        const nextAssignments = {
          ...resolvedCharacterSheetPresetAssignments,
          [sourceCharacterSheetZoneKey]: targetReference ?? null,
          [characterSheetSlotKey]: sourceReference,
        };
        persistCharacterSheetPresetAssignments(nextAssignments);
        return;
      }

      const droppedSlotKey =
        (event.dataTransfer.getData(DND_REFERENCE_SLOT_KEY) as CharacterReferenceSlotKey | "") ||
        (event.dataTransfer.getData("text/plain") as CharacterReferenceSlotKey | "") ||
        draggedReferenceSlotKey;
      if (droppedSlotKey && uploadedReferenceBySlotKey.has(droppedSlotKey)) {
        assignReferenceToCharacterSheetSlot(characterSheetSlotKey, droppedSlotKey);
        return;
      }

      const droppedReference = resolveDroppedImageReference(event.dataTransfer);
      if (!droppedReference) {
        void reportAppError({
          source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
          scope: "app",
          severity: "low",
          message: "character_sheet_drop_reference_blocked_by_trust_policy",
          metadata: {
            target: "character_sheet",
            drop_zone_key: characterSheetSlotKey,
            transfer_types: Array.from(event.dataTransfer.types ?? []),
          },
        });
        return;
      }
      void setCharacterSheetFileFromDroppedReference(characterSheetSlotKey, droppedReference);
    },
    [
      assignReferenceToCharacterSheetSlot,
      draggedCharacterSheetZoneKey,
      draggedReferenceSlotKey,
      pageBusy,
      persistCharacterSheetPresetAssignments,
      resolvedCharacterSheetPresetAssignments,
      setCharacterSheetFileFromDroppedReference,
      uploadedReferenceBySlotKey,
    ]
  );

  const handleCharacterSheetCardClick = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => () => {
      if (pageBusy) return;
      const assignedReference = resolvedCharacterSheetPresetAssignments[dropZoneKey];
      if (assignedReference) return;
      openCharacterSheetPicker(dropZoneKey);
    },
    [openCharacterSheetPicker, pageBusy, resolvedCharacterSheetPresetAssignments]
  );

  useEffect(() => {
    if (!referencePreview) return;
    const handleModalKeyboardShortcuts = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeReferencePreview();
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        navigateReferencePreview(1);
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        navigateReferencePreview(-1);
      }
    };
    window.addEventListener("keydown", handleModalKeyboardShortcuts);
    return () => {
      window.removeEventListener("keydown", handleModalKeyboardShortcuts);
    };
  }, [closeReferencePreview, navigateReferencePreview, referencePreview]);

  return (
    <RootContainer
      id={isEmbeddedSurface ? undefined : "main-content"}
      className={rootClassName}
      data-beginner-mode={effectiveBeginnerMode ? "on" : "off"}
      data-surface={surface}
    >
      {!isEmbeddedSurface ? (
        <section className="panel saved-header-bar saved-hero hero-image-card character-manager-hero">
          <div className="saved-header-left">
            <div className="saved-title-stack">
              <div className="saved-title-row">
                <h1 className="title">Character Manager</h1>
              </div>
              <p className="subdued">
                Start with a simple uploader to define your character and add reference images.
              </p>
            </div>
          </div>
          <div className="character-manager-header-right">
            <div className="header-cards character-manager-header-cards">
              <div className="header-stat-card" aria-label="Plan status">
                <div className="status-icon compact" aria-hidden="true">
                  <ShieldCheck size={16} weight="bold" />
                </div>
                <div className="header-card-body">
                  <p className="metric-label tiny">Plan</p>
                  <p className={`status-value small ${planMeta.className ?? ""}`}>
                    {planMeta.label}
                  </p>
                </div>
              </div>
            </div>
            <Link
              href="/profile?section=account"
              className="avatar-card character-manager-profile-link"
              aria-label="Account and profile settings"
            >
              <div className="avatar">{accountInitials}</div>
            </Link>
          </div>
        </section>
      ) : null}

      <section
        className="panel media-panel character-mode-panel"
        aria-label="Character workflow tabs"
      >
        <div className="character-mode-row">
          {!isEmbeddedSurface ? (
            <DashboardNavPrefab variant="inline" className="character-mode-dashboard-link" />
          ) : null}
          <div
            className="character-mode-tab-row"
            role="tablist"
            aria-label="Character workflow mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "create"}
              className={`character-mode-tab character-mode-tab--profile ${
                activeTab === "create" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("create")}
            >
              Character Profile
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "manage"}
              className={`character-mode-tab character-mode-tab--manage ${
                activeTab === "manage" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("manage")}
            >
              Manage Characters
            </button>
          </div>
          {activeTab === "create" && !isEmbeddedSurface ? (
            <div className="toolbar-beginner-toggle character-mode-beginner-toggle">
              <div className="toolbar-beginner-copy">
                <span className="toolbar-label">Beginner mode</span>
              </div>
              <button
                type="button"
                className={`reference-toggle beginner-toggle ${effectiveBeginnerMode ? "is-active" : ""}`}
                aria-pressed={effectiveBeginnerMode}
                aria-label={
                  effectiveBeginnerMode ? "Disable beginner mode" : "Enable beginner mode"
                }
                onClick={() => setBeginnerMode((current) => !current)}
              >
                <span className="reference-toggle-track" aria-hidden="true">
                  <span className="reference-toggle-dot" />
                </span>
              </button>
            </div>
          ) : null}
          {activeTab === "create" && effectiveBeginnerMode && !isEmbeddedSurface ? (
            <p className="character-mode-guidance" role="note">
              <span className="character-mode-guidance-label">Tip:</span>
              Swap out your character&apos;s style on the fly by dragging and dropping references
              from the QuickSwap Deck.
            </p>
          ) : null}
          {activeTab === "manage" && !isEmbeddedSurface ? (
            <button
              type="button"
              className="character-mode-create-btn"
              onClick={handleCreateNewCharacter}
              disabled={isCreatingCharacter || loading}
            >
              {isCreatingCharacter ? (
                "Creating..."
              ) : (
                <>
                  <Plus
                    size={14}
                    weight="bold"
                    className="character-mode-create-btn-icon"
                    aria-hidden
                  />
                  <span>Create New Character</span>
                </>
              )}
            </button>
          ) : null}
        </div>
      </section>

      {error ? (
        <div className="character-feedback error" role="status">
          <XCircle size={16} weight="fill" />
          <span>{error}</span>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {isSavingName ? "Saving character name..." : ""}
      </p>

      {activeTab === "create" ? (
        <section className="character-simple-panel">
          <div className="character-create-flow">
            <div className="character-create-primary-column">
              <section className="character-section character-section--profile">
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    {effectiveBeginnerMode ? (
                      <span className="character-step-badge" aria-hidden="true">
                        1
                      </span>
                    ) : null}
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">Identity</h3>
                      {effectiveBeginnerMode ? (
                        <p className="character-section-helper tiny subdued">
                          Set the photo, name, and description that define this character.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="character-profile-card">
                  <div className="character-profile-card-top-row">
                    <div className="character-profile-photo-stack">
                      <button
                        type="button"
                        className={`character-profile-photo-btn ${profileImageUrl ? "has-image" : ""}`}
                        onClick={openProfilePicker}
                        disabled={pageBusy}
                        aria-label={
                          profileImageUrl && !isProfileAdjusterVisible
                            ? "Edit profile photo adjustments"
                            : "Upload profile photo"
                        }
                      >
                        {profileImageUrl ? (
                          <Image
                            src={profileImageUrl}
                            alt="Character profile"
                            className="character-profile-photo"
                            style={buildProfileImageTransformStyle(
                              activeProfileImageTransform,
                              profileImageRenderSize
                            )}
                            width={profileImageRenderSize}
                            height={profileImageRenderSize}
                            unoptimized
                          />
                        ) : (
                          <span className="character-profile-initials" aria-hidden>
                            {profileInitials}
                          </span>
                        )}
                      </button>
                      {profileImageUrl ? (
                        <span className="character-profile-edit-indicator" aria-hidden="true">
                          <PencilSimpleLine size={14} weight="bold" />
                          <span>Edit photo</span>
                        </span>
                      ) : null}
                      {profileImageUrl && isProfileAdjusterVisible ? (
                        <div
                          className="character-profile-adjuster"
                          role="group"
                          aria-label="Profile crop controls"
                        >
                          <div className="character-profile-adjuster-row">
                            <label
                              className="character-profile-adjuster-label"
                              htmlFor="profile-adjust-zoom"
                            >
                              <span>Zoom</span>
                              <span>{Math.round(activeProfileImageTransform.zoom * 100)}%</span>
                            </label>
                            <input
                              id="profile-adjust-zoom"
                              className="character-profile-adjuster-range"
                              type="range"
                              min={PROFILE_ZOOM_MIN}
                              max={PROFILE_ZOOM_MAX}
                              step={0.01}
                              value={activeProfileImageTransform.zoom}
                              onChange={(event) => {
                                const nextZoom = Number(event.target.value);
                                setProfileAdjustDraft((previous) => ({
                                  ...(previous ?? profileImageTransform),
                                  zoom: nextZoom,
                                }));
                              }}
                            />
                          </div>
                          <div className="character-profile-adjuster-row">
                            <label
                              className="character-profile-adjuster-label"
                              htmlFor="profile-adjust-x"
                            >
                              <span>Horizontal</span>
                              <span>
                                {activeProfileImageTransform.offsetX > 0
                                  ? `+${activeProfileImageTransform.offsetX}`
                                  : activeProfileImageTransform.offsetX}
                              </span>
                            </label>
                            <input
                              id="profile-adjust-x"
                              className="character-profile-adjuster-range"
                              type="range"
                              min={PROFILE_OFFSET_MIN}
                              max={PROFILE_OFFSET_MAX}
                              step={1}
                              value={activeProfileImageTransform.offsetX}
                              onChange={(event) => {
                                const nextOffsetX = Number(event.target.value);
                                setProfileAdjustDraft((previous) => ({
                                  ...(previous ?? profileImageTransform),
                                  offsetX: nextOffsetX,
                                }));
                              }}
                            />
                          </div>
                          <div className="character-profile-adjuster-row">
                            <label
                              className="character-profile-adjuster-label"
                              htmlFor="profile-adjust-y"
                            >
                              <span>Vertical</span>
                              <span>
                                {activeProfileImageTransform.offsetY > 0
                                  ? `+${activeProfileImageTransform.offsetY}`
                                  : activeProfileImageTransform.offsetY}
                              </span>
                            </label>
                            <input
                              id="profile-adjust-y"
                              className="character-profile-adjuster-range"
                              type="range"
                              min={PROFILE_OFFSET_MIN}
                              max={PROFILE_OFFSET_MAX}
                              step={1}
                              value={activeProfileImageTransform.offsetY}
                              onChange={(event) => {
                                const nextOffsetY = Number(event.target.value);
                                setProfileAdjustDraft((previous) => ({
                                  ...(previous ?? profileImageTransform),
                                  offsetY: nextOffsetY,
                                }));
                              }}
                            />
                          </div>
                          <button
                            type="button"
                            className="ghost-btn small character-profile-adjuster-reset"
                            onClick={() => {
                              void saveProfileAdjustments();
                            }}
                            disabled={pageBusy}
                          >
                            {isSavingProfileImage ? "Saving..." : "Save"}
                          </button>
                          <button
                            type="button"
                            className="ghost-btn small character-profile-adjuster-remove character-remove-btn"
                            onClick={clearProfilePreview}
                            disabled={pageBusy}
                          >
                            Remove photo
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="character-profile-fields character-profile-fields--label-serif">
                      <label
                        className="control-row character-simple-field"
                        htmlFor="character-manager-name"
                      >
                        <span className="input-label">Name:</span>
                        <input
                          ref={characterNameInputRef}
                          id="character-manager-name"
                          className="character-name-input"
                          type="text"
                          value={characterName}
                          maxLength={80}
                          onChange={(event) => setCharacterName(event.target.value)}
                          placeholder="Enter character name"
                          disabled={loading}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="character-profile-description-block character-profile-fields character-profile-fields--label-serif">
                    <label
                      className="control-row character-simple-field"
                      htmlFor="character-manager-description"
                    >
                      <div className="character-description-label-row">
                        <span className="input-label">Description:</span>
                        {effectiveBeginnerMode ? (
                          <p className="character-description-helper character-description-helper--inline tiny subdued">
                            {CHARACTER_DESCRIPTION_HELPER_TEXT}
                          </p>
                        ) : null}
                      </div>
                      <textarea
                        id="character-manager-description"
                        className="character-description-input"
                        rows={isEmbeddedSurface ? 3 : 4}
                        value={characterDescription}
                        maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
                        onChange={(event) => setCharacterDescription(event.target.value)}
                        placeholder="A gorgeous woman in her early 30s with brown hair and dark amber eyes, she has a slim, toned waist, a curvy lower body, and thick thighs."
                        disabled={loading}
                      />
                      <div className="character-description-footer-row">
                        {!effectiveBeginnerMode ? (
                          <p className="character-description-helper tiny subdued">
                            {CHARACTER_DESCRIPTION_HELPER_TEXT}
                          </p>
                        ) : null}
                        <p className="character-description-count tiny subdued">
                          {characterDescription.length}/{CHARACTER_DESCRIPTION_MAX_LENGTH}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </section>

              <section
                className={`character-section character-section--reference-drop ${
                  isQuickSwapCollapsed ? "is-collapsed" : ""
                }`}
                onDragEnter={(event) => {
                  if (isQuickSwapCollapsed) return;
                  if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                  event.preventDefault();
                  if (pageBusy || !availableReferenceSlotKeys.length) return;
                  fileDragDepthRef.current += 1;
                  setIsDropActive(true);
                }}
                onDragOver={(event) => {
                  if (isQuickSwapCollapsed) return;
                  if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                  event.preventDefault();
                  if (pageBusy || !availableReferenceSlotKeys.length) {
                    event.dataTransfer.dropEffect = "none";
                    return;
                  }
                  event.dataTransfer.dropEffect = "copy";
                  if (!isDropActive) setIsDropActive(true);
                }}
                onDragLeave={(event) => {
                  if (isQuickSwapCollapsed) return;
                  if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                  if (pageBusy || !availableReferenceSlotKeys.length) return;
                  fileDragDepthRef.current = Math.max(0, fileDragDepthRef.current - 1);
                  if (fileDragDepthRef.current === 0) {
                    setIsDropActive(false);
                  }
                }}
                onDrop={(event) => {
                  if (isQuickSwapCollapsed) return;
                  if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                  event.preventDefault();
                  fileDragDepthRef.current = 0;
                  setIsDropActive(false);
                  if (pageBusy || !availableReferenceSlotKeys.length) return;
                  const files = event.dataTransfer?.files;
                  if (files?.length) {
                    void uploadSimpleFiles(files);
                    return;
                  }
                  const droppedReference = resolveDroppedImageReference(event.dataTransfer);
                  if (!droppedReference) {
                    void reportAppError({
                      source: DROPPED_REFERENCE_TELEMETRY_SOURCE,
                      scope: "app",
                      severity: "low",
                      message: "quickswap_drop_reference_blocked_by_trust_policy",
                      metadata: {
                        target: "quickswap",
                        transfer_types: Array.from(event.dataTransfer.types ?? []),
                      },
                    });
                    return;
                  }
                  void addDroppedReferenceToQuickSwap(droppedReference);
                }}
              >
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    {effectiveBeginnerMode ? (
                      <span className="character-step-badge" aria-hidden="true">
                        2
                      </span>
                    ) : null}
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">QuickSwap Deck</h3>
                      {effectiveBeginnerMode && !isQuickSwapCollapsed ? (
                        <p className="character-section-helper tiny subdued">
                          The quick swap deck is a small library of images you can quickly access to
                          swap out your character&apos;s style on the fly.
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="character-section-head-actions">
                    <button
                      type="button"
                      className="ghost-btn mini character-section-collapse-btn"
                      aria-label={`${isQuickSwapCollapsed ? "Expand" : "Collapse"} QuickSwap Deck`}
                      aria-expanded={!isQuickSwapCollapsed}
                      aria-controls={quickSwapContentId}
                      onClick={(event) => {
                        event.stopPropagation();
                        fileDragDepthRef.current = 0;
                        setIsDropActive(false);
                        setIsQuickSwapCollapsed((current) => !current);
                      }}
                    >
                      <CaretDown
                        size={16}
                        weight="bold"
                        className="character-section-collapse-icon"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
                <div
                  id={quickSwapContentId}
                  className="character-reference-drop-content"
                  hidden={isQuickSwapCollapsed}
                >
                  {availableReferenceSlotKeys.length && isDropActive ? (
                    <div className="character-reference-drop-overlay" aria-hidden="true">
                      <div className="character-reference-drop-overlay-content">
                        <UploadSimple
                          size={34}
                          weight="bold"
                          className="character-reference-drop-overlay-icon"
                        />
                        <p className="character-reference-drop-overlay-title">
                          Drop reference images here
                        </p>
                        <p className="tiny subdued">
                          {`Up to ${availableReferenceSlotKeys.length} more image(s) can be added (max ${SIMPLE_REFERENCE_IMAGE_LIMIT})`}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div
                    className="character-reference-upload-grid character-reference-upload-grid--drop-card"
                    role="list"
                    aria-label="Uploaded references"
                  >
                    {uploadedReferenceEntries.map((entry, index) => (
                      <article
                        key={entry.slotKey}
                        role="listitem"
                        className={`character-reference-upload-card ${
                          draggedReferenceSlotKey === entry.slotKey ? "is-dragging" : ""
                        }`}
                        draggable={!pageBusy && !isSlotBusy(entry.slotKey)}
                        onDragStart={handleReferenceDragStart(entry.slotKey)}
                        onDragEnd={handleReferenceDragEnd}
                      >
                        <button
                          type="button"
                          className="character-list-delete-btn character-reference-delete-btn"
                          aria-label={`Remove reference ${index + 1}`}
                          onClick={() => {
                            void clearSlot(entry.slotKey);
                          }}
                          disabled={pageBusy || isSlotBusy(entry.slotKey)}
                        >
                          <Trash size={12} weight="bold" />
                        </button>
                        <div
                          className="character-reference-upload-image-wrap"
                          onDoubleClick={() => {
                            openReferencePreview(index, entry.slotFile.validationNotes.aspectRatio);
                          }}
                          title="Double-click to preview this reference image"
                        >
                          <Image
                            src={
                              resolveCharacterGridPreviewUrl(entry.slotFile.previewUrl, 320) ??
                              entry.slotFile.previewUrl
                            }
                            alt={`Reference ${index + 1}: ${entry.slotLabel}`}
                            className="character-reference-upload-image"
                            width={320}
                            height={240}
                            unoptimized
                          />
                        </div>
                      </article>
                    ))}
                    {availableReferenceSlotKeys.map((slotKey) => (
                      <button
                        key={`reference-upload-placeholder-${slotKey}`}
                        type="button"
                        className="character-reference-upload-placeholder"
                        onClick={() => openSimpleReferenceSlotPicker(slotKey)}
                        disabled={pageBusy || isSlotBusy(slotKey)}
                        aria-label={`Upload ${CHARACTER_MANAGER_SLOT_LABEL_BY_KEY[slotKey]} reference image`}
                      >
                        <UploadSimple
                          size={16}
                          weight="bold"
                          className="character-reference-upload-placeholder-icon"
                          aria-hidden="true"
                        />
                        <span className="character-reference-upload-placeholder-label">
                          Click to upload
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="character-create-secondary-column">
              <section className="character-section character-section--references">
                <div className="character-section-head">
                  <div className="character-section-title-row">
                    {effectiveBeginnerMode ? (
                      <span className="character-step-badge" aria-hidden="true">
                        3
                      </span>
                    ) : null}
                    <div className="character-section-title-copy">
                      <h3 className="character-section-title">Character Sheet</h3>
                      {effectiveBeginnerMode ? (
                        <p className="character-section-helper tiny subdued">
                          Drag or upload references into each slot. These images are used to train
                          your character generations.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div
                  className="character-sheet-preset-tab-row"
                  role="tablist"
                  aria-label="Character sheet style presets"
                >
                  {CHARACTER_SHEET_PRESET_IDS.map((presetId) => (
                    <button
                      key={presetId}
                      type="button"
                      role="tab"
                      aria-selected={activeCharacterSheetPresetId === presetId}
                      className={`character-sheet-preset-tab ${
                        activeCharacterSheetPresetId === presetId ? "is-active" : ""
                      }`}
                      onClick={() => {
                        void setActiveCharacterSheetPreset(presetId as CharacterSheetPresetId);
                      }}
                      disabled={pageBusy}
                    >
                      {presetId}
                    </button>
                  ))}
                </div>

                <div className="character-reference-empty-grid">
                  {CHARACTER_SHEET_DROP_ZONES.map((dropZone) => {
                    const assignedReference = resolvedCharacterSheetPresetAssignments[dropZone.key];
                    const isDropActive = activeCharacterSheetDropZone === dropZone.key;
                    const isRequiredSlot = dropZone.key === "portrait";
                    const slotRequirementCopy = isRequiredSlot ? "(Required)" : "(Optional)";
                    return (
                      <article
                        key={dropZone.key}
                        className={`character-character-sheet-card ${
                          assignedReference ? "is-filled" : "is-empty"
                        } ${isDropActive ? "is-drop-active" : ""} ${
                          draggedCharacterSheetZoneKey === dropZone.key ? "is-dragging" : ""
                        }`}
                        draggable={!pageBusy && Boolean(assignedReference)}
                        onClick={handleCharacterSheetCardClick(dropZone.key)}
                        onDragStart={handleCharacterSheetDragStart(dropZone.key)}
                        onDragEnd={handleReferenceDragEnd}
                        onDragOver={handleCharacterSheetDragOver(dropZone.key)}
                        onDragLeave={() => {
                          setActiveCharacterSheetDropZone((current) =>
                            current === dropZone.key ? null : current
                          );
                        }}
                        onDrop={handleCharacterSheetDrop(dropZone.key)}
                      >
                        {assignedReference ? (
                          <button
                            type="button"
                            className="character-list-delete-btn character-reference-delete-btn character-character-sheet-delete-btn"
                            aria-label={`Clear ${dropZone.label} reference`}
                            onClick={(event) => {
                              event.stopPropagation();
                              clearCharacterSheetAssignment(dropZone.key);
                            }}
                            disabled={pageBusy}
                          >
                            <Trash size={12} weight="bold" />
                          </button>
                        ) : null}
                        <div className="character-character-sheet-media">
                          {assignedReference?.previewUrl ? (
                            <Image
                              src={
                                resolveCharacterGridPreviewUrl(assignedReference.previewUrl, 300) ??
                                assignedReference.previewUrl
                              }
                              alt={`${dropZone.label} reference`}
                              className="character-character-sheet-image"
                              width={240}
                              height={300}
                              unoptimized
                            />
                          ) : (
                            <span className="character-character-sheet-drop-copy tiny">
                              <UploadSimple
                                size={14}
                                weight="bold"
                                className="character-character-sheet-drop-icon"
                                aria-hidden="true"
                              />
                              <span>Drop reference or click to upload</span>
                              <span
                                className={`character-character-sheet-drop-requirement ${
                                  isRequiredSlot ? "is-required" : "is-optional"
                                }`}
                              >
                                {slotRequirementCopy}
                              </span>
                            </span>
                          )}
                        </div>
                        <span className="character-reference-empty-hint">{dropZone.label}</span>
                      </article>
                    );
                  })}
                </div>
              </section>

              {isEmbeddedSurface && effectiveBeginnerMode ? (
                <p className="character-mode-guidance character-mode-guidance--sheet" role="note">
                  <span className="character-mode-guidance-label">Tip:</span>
                  Swap out your character&apos;s style on the fly by dragging and dropping
                  references from the QuickSwap Deck.
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : (
        <section className="panel media-panel character-manage-panel">
          <div className={isEmbeddedSurface ? "character-manage-panel-header" : undefined}>
            <div>
              <h2>Character Library</h2>
              <p className="tiny subdued">Select a character to edit their character profile.</p>
            </div>
            {isEmbeddedSurface ? (
              <button
                type="button"
                className="character-mode-create-btn character-mode-create-btn--inline"
                onClick={handleCreateNewCharacter}
                disabled={isCreatingCharacter || loading}
              >
                {isCreatingCharacter ? (
                  "Creating..."
                ) : (
                  <>
                    <Plus
                      size={14}
                      weight="bold"
                      className="character-mode-create-btn-icon"
                      aria-hidden
                    />
                    <span>Create New Character</span>
                  </>
                )}
              </button>
            ) : null}
          </div>

          <div className="character-manage-list" role="list" aria-label="Character list">
            {characters.map((character) => {
              const isSelected = character.characterId === selectedCharacterId;
              const chipName = character.characterName || "Untitled character";
              const chipInitials = getCharacterInitials(chipName);
              return (
                <article
                  key={character.characterId}
                  role="listitem"
                  className={`character-list-card ${isSelected ? "is-active" : ""} ${
                    pageBusy ? "is-disabled" : ""
                  }`}
                >
                  <button
                    type="button"
                    className="character-list-select-btn"
                    onClick={() => {
                      void selectCharacter(character.characterId);
                      setActiveTab("create");
                    }}
                    disabled={pageBusy}
                  >
                    <div className="character-list-main">
                      <span className="character-list-avatar" aria-hidden="true">
                        {character.profileImageUrl ? (
                          <Image
                            src={
                              resolveCharacterGridPreviewUrl(
                                character.profileImageUrl,
                                CHARACTER_CHIP_AVATAR_SIZE
                              ) ?? character.profileImageUrl
                            }
                            alt=""
                            className="character-list-avatar-image"
                            style={
                              character.profileImageTransform
                                ? buildProfileImageTransformStyle(
                                    character.profileImageTransform,
                                    CHARACTER_CHIP_AVATAR_SIZE
                                  )
                                : undefined
                            }
                            width={CHARACTER_CHIP_AVATAR_SIZE}
                            height={CHARACTER_CHIP_AVATAR_SIZE}
                            unoptimized
                          />
                        ) : (
                          <span className="character-list-avatar-initials">{chipInitials}</span>
                        )}
                      </span>
                      <div className="character-list-copy">
                        <p className="metric-label tiny">{isSelected ? "Selected" : "Character"}</p>
                        <p className="character-list-name">{chipName}</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="character-list-delete-btn"
                    aria-label={`Delete character: ${chipName}`}
                    onClick={() => {
                      setDeleteTargetCharacter({
                        characterId: character.characterId,
                        characterName: chipName,
                      });
                    }}
                    disabled={pageBusy}
                  >
                    <Trash size={12} weight="bold" />
                  </button>
                </article>
              );
            })}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {isSwitchingCharacter ? "Loading selected character..." : ""}
          </p>
        </section>
      )}

      {referencePreview && referencePreviewEntry ? (
        <div className="character-reference-preview-overlay" role="dialog" aria-modal="true">
          <div
            className="character-reference-preview-modal"
            style={
              {
                "--character-reference-preview-aspect-ratio": String(referencePreview.aspectRatio),
              } as React.CSSProperties
            }
          >
            <button
              type="button"
              className="character-reference-preview-close"
              onClick={closeReferencePreview}
              aria-label="Close reference preview"
            >
              X
            </button>
            <Image
              src={
                referencePreviewSignedUrl &&
                referencePreviewSignedUrl.slotKey === referencePreviewEntry.slotKey
                  ? referencePreviewSignedUrl.url
                  : referencePreviewEntry.slotFile.previewUrl
              }
              alt={`Reference ${referencePreview.index + 1}: ${referencePreviewEntry.slotLabel}`}
              className="character-reference-preview-image"
              width={1600}
              height={1600}
              onLoadingComplete={(loadedImage) => {
                const loadedAspectRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
                if (!Number.isFinite(loadedAspectRatio) || loadedAspectRatio <= 0) return;
                const clampedAspectRatio = clampReferencePreviewAspectRatio(loadedAspectRatio);
                setReferencePreview((current) => {
                  if (!current) return current;
                  const currentEntry = uploadedReferenceEntries[current.index];
                  if (!currentEntry || currentEntry.slotKey !== referencePreviewEntry.slotKey) {
                    return current;
                  }
                  if (Math.abs(current.aspectRatio - clampedAspectRatio) < 0.001) return current;
                  return { ...current, aspectRatio: clampedAspectRatio };
                });
              }}
              unoptimized
            />
          </div>
        </div>
      ) : null}

      {deleteTargetCharacter ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-character-title"
        >
          <div className="modal-card character-delete-confirm-card">
            <h3 id="delete-character-title">Delete this character?</h3>
            <p className="subdued tiny character-delete-confirm-copy">
              This will permanently remove <strong>{deleteTargetCharacter.characterName}</strong>{" "}
              and its reference images from Character Manager. This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelDeleteCharacter}
                disabled={isDeletingCharacter}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger character-delete-confirm-btn"
                onClick={() => {
                  void confirmDeleteCharacter();
                }}
                disabled={isDeletingCharacter}
              >
                {isDeletingCharacter ? "Deleting..." : "Yes, delete character"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <input
        ref={profileFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleProfileSelection}
        hidden
      />

      <input
        ref={simpleFileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleSimpleFileSelection}
        hidden
      />

      <input
        ref={characterSheetFileInputRef}
        data-testid="character-sheet-upload-input"
        type="file"
        accept="image/*"
        onChange={handleCharacterSheetFileSelection}
        hidden
      />
    </RootContainer>
  );
}
