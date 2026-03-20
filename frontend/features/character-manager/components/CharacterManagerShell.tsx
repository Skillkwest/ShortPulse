/**
 * Character Manager page shell.
 * Provides Character Profile + Manage Characters workflows for route and embedded surfaces.
 */
import type { User } from "@supabase/supabase-js";
import Image from "next/image";
import Link from "next/link";
import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Plus, PencilSimpleLine, ShieldCheck, Trash, UploadSimple, XCircle } from "phosphor-react";
import { DashboardNavPrefab } from "../../../components/DashboardNavPrefab";
import {
  isAdaptiveSurfaceEnabled,
  logAdaptiveDetailFullQualityUsed,
} from "../../../lib/adaptive-media";
import { buildPlanView, normalizePlanId, type BillingPlanRecord } from "../../billing/catalog";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import {
  CHARACTER_QUICK_SWAP_ACTIVE_LIMIT,
  CHARACTER_SHEET_DROP_ZONES,
  createEmptyCharacterSheetPresetAssignments,
} from "../constants";
import { useCharacterManagerDraft } from "../hooks/useCharacterManagerDraft";
import {
  useCharacterManagerDroppedReferenceController,
  type ResolveCharacterDropReference,
} from "../hooks/useCharacterManagerDroppedReferenceController";
import { useCharacterQuickSwapDeck } from "../hooks/useCharacterQuickSwapDeck";
import { useCharacterQuickSwapTipPreference } from "../hooks/useCharacterQuickSwapTipPreference";
import { useCharacterManagerShellViewState } from "../hooks/useCharacterManagerShellViewState";
import {
  CHARACTER_LIBRARY_EXPAND_STEP,
  CHARACTER_LIBRARY_SMOOTH_TARGET,
  resolveCharacterLibraryWindow,
} from "../logic/characterLibraryWindow";
import { resolveCharacterGridPreviewUrl as resolveCharacterGridPreviewUrlForSurface } from "../logic/characterGridPreviewUrl";
import { hasDroppedImageReferenceTransfer } from "../logic/characterDropPayload";
import { CharacterCreateWorkspaceLayout } from "./CharacterCreateWorkspaceLayout";
import { CharacterDescriptionEditorCard } from "./CharacterDescriptionEditorCard";
import { CharacterSheetPresetTabs, getCharacterSheetPresetTabId } from "./CharacterSheetPresetTabs";
import { CharacterQuickSwapDeckSection } from "./CharacterQuickSwapDeckSection";
import { extractInternalReferenceDragPayload } from "../../ai-studio/utils/dragDrop";
import type {
  CharacterQuickSwapItem,
  CharacterProfileImageTransform,
  CharacterSheetDropZoneKey,
  CharacterSheetPresetAssignments,
} from "../types";

type CharacterWorkflowTab = "create" | "manage";
type CharacterManagerShellSurface = "page" | "panel";
type CharacterManagerShellProps = {
  surface?: CharacterManagerShellSurface;
  initialWorkflowTab?: CharacterWorkflowTab;
  beginnerModeOverride?: boolean;
  showBeginnerModeToggle?: boolean;
  resolveCharacterDropReference?: ResolveCharacterDropReference;
};
const PROFILE_ZOOM_MIN = 1;
const PROFILE_ZOOM_MAX = 2.4;
const PROFILE_OFFSET_MIN = -40;
const PROFILE_OFFSET_MAX = 40;
const PROFILE_PREVIEW_IMAGE_SIZE = 172;
const PROFILE_PREVIEW_IMAGE_EMBEDDED_SIZE = 92;
const CHARACTER_CHIP_AVATAR_SIZE = 44;
const CHARACTER_DESCRIPTION_MAX_LENGTH = 150;
const CHARACTER_DESCRIPTION_HELPER_TEXT =
  "Tip: Character description will be used as part of consistency generation.";
const CHARACTER_REFERENCES_HELPER_TEXT =
  "These are the exact reference images sent to the model for character training and consistency generation.";
const CHARACTER_LIBRARY_PANEL_TITLE = "Characters Library";
const CHARACTER_LIBRARY_PANEL_HELPER_TEXT = "Create and manage character references.";
const DEFAULT_REFERENCE_PREVIEW_ASPECT_RATIO = 4 / 5;
const DEFAULT_PLAN_TIER = "business";
const DND_REFERENCE_SLOT_KEY = "application/x-shortpulse-reference-slot-key";
const DND_QUICK_SWAP_ITEM = "application/x-shortpulse-quickswap-item";
const DND_CHARACTER_SHEET_ZONE_KEY = "application/x-shortpulse-character-sheet-zone-key";
const DRAG_GHOST_SCALE = 0.74;
const DRAG_GHOST_IMAGE_BLOB_SELECTOR =
  ".character-reference-upload-image-wrap, .character-character-sheet-media";
const MEDIA_BUCKET = "media_library";
const CHARACTER_CARD_PREVIEW_SIGN_RETRY_LIMIT = 1;

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

/**
 * Orchestrates simple character creation flow while advanced uploader remains hidden.
 */
export function CharacterManagerShell({
  surface = "page",
  initialWorkflowTab,
  beginnerModeOverride,
  showBeginnerModeToggle = true,
  resolveCharacterDropReference,
}: CharacterManagerShellProps) {
  const {
    characters,
    selectedCharacterId,
    characterName,
    characterDescription,
    activeCharacterSheetPresetId,
    visibleCharacterSheetPresetIds,
    characterSheetPresetLabels,
    characterSheetPresetAssignments,
    profileImageUrl,
    profileImageTransform,
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
    addCharacterSheetPreset,
    renameCharacterSheetPreset,
    deleteCharacterSheetPreset,
    setCharacterSheetPresetFile,
    createCharacter,
    selectCharacter,
    deleteCharacter,
    clearMessages,
  } = useCharacterManagerDraft();

  const [isDropActive, setIsDropActive] = useState(false);
  const [draggedQuickSwapItemId, setDraggedQuickSwapItemId] = useState<string | null>(null);
  const [draggedCharacterSheetZoneKey, setDraggedCharacterSheetZoneKey] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [activeCharacterSheetDropZone, setActiveCharacterSheetDropZone] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [isProfileAdjusterVisible, setIsProfileAdjusterVisible] = useState(false);
  const [profileAdjustDraft, setProfileAdjustDraft] =
    useState<CharacterProfileImageTransform | null>(null);
  const [pendingCharacterSheetUploadZoneKey, setPendingCharacterSheetUploadZoneKey] =
    useState<CharacterSheetDropZoneKey | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState<{ label: string; className: string } | null>(
    null
  );
  const [cardPreviewUrlByStoragePath, setCardPreviewUrlByStoragePath] = useState<
    Record<string, string>
  >({});
  const cardPreviewRetryCountRef = useRef<Record<string, number>>({});
  const characterNameInputRef = useRef<HTMLInputElement | null>(null);
  const profileFileInputRef = useRef<HTMLInputElement | null>(null);
  const simpleFileInputRef = useRef<HTMLInputElement | null>(null);
  const characterSheetFileInputRef = useRef<HTMLInputElement | null>(null);
  const rootContainerRef = useRef<HTMLElement | null>(null);
  const dragGhostMapRef = useRef(new Map<HTMLElement, HTMLElement>());
  const fileDragDepthRef = useRef(0);
  const pageBusy =
    loading ||
    isSwitchingCharacter ||
    isCreatingCharacter ||
    isDeletingCharacter ||
    isSavingProfileImage;

  const {
    activeItems: quickSwapItems,
    archivedItems: quickSwapArchivedItems,
    archivedCount: quickSwapArchivedCount,
    hasMoreArchived: quickSwapHasMoreArchived,
    loading: quickSwapLoading,
    loadingArchived: quickSwapLoadingArchived,
    mutating: quickSwapMutating,
    error: quickSwapError,
    appendFiles: appendQuickSwapFilesFromHook,
    removeItem: removeQuickSwapItem,
    restoreItem: restoreQuickSwapItem,
    loadMoreArchived: loadMoreQuickSwapArchived,
    clearError: clearQuickSwapError,
  } = useCharacterQuickSwapDeck({
    characterId: selectedCharacterId,
  });
  const quickSwapActiveItems = useMemo(() => quickSwapItems, [quickSwapItems]);
  const { isQuickSwapTipHidden, markQuickSwapTipHidden } = useCharacterQuickSwapTipPreference();
  const {
    activeTab,
    setActiveTab,
    isQuickSwapCollapsed,
    setIsQuickSwapCollapsed,
    deleteTargetCharacter,
    setDeleteTargetCharacter,
    deleteTargetCharacterSheetPresetId,
    setDeleteTargetCharacterSheetPresetId,
    referencePreview,
    setReferencePreview,
    referencePreviewSignedUrl,
    setReferencePreviewSignedUrl,
    characterLibraryVisibleCount,
    setCharacterLibraryVisibleCount,
    setBeginnerMode,
    quickSwapGridColumnCount,
    quickSwapArchiveGridColumnCount,
    isEmbeddedSurface,
    effectiveBeginnerMode,
    showQuickSwapCollapseToggle,
    cancelDeleteCharacter,
    cancelDeleteCharacterSheetPreset,
    openReferencePreview,
    closeReferencePreview,
    navigateReferencePreview,
  } = useCharacterManagerShellViewState({
    initialWorkflowTab,
    surface,
    beginnerModeOverride,
    isQuickSwapTipHidden,
    markQuickSwapTipHidden,
    quickSwapActiveItems,
    isDeletingCharacter,
    isSavingCharacterSheetPreset,
  });
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
  const deferredCharacters = useDeferredValue(characters);
  const characterLibraryRequestedVisibleCount = useMemo(() => {
    if (characters.length <= CHARACTER_LIBRARY_SMOOTH_TARGET) {
      return CHARACTER_LIBRARY_SMOOTH_TARGET;
    }
    return Math.max(characterLibraryVisibleCount, CHARACTER_LIBRARY_SMOOTH_TARGET);
  }, [characterLibraryVisibleCount, characters.length]);
  const selectedCharacterListIndex = useMemo(
    () =>
      deferredCharacters.findIndex((character) => character.characterId === selectedCharacterId),
    [deferredCharacters, selectedCharacterId]
  );
  const characterLibraryWindow = useMemo(
    () =>
      resolveCharacterLibraryWindow({
        totalCharacterCount: deferredCharacters.length,
        selectedCharacterIndex: selectedCharacterListIndex,
        requestedVisibleCount: characterLibraryRequestedVisibleCount,
      }),
    [characterLibraryRequestedVisibleCount, deferredCharacters.length, selectedCharacterListIndex]
  );
  const visibleManageCharacters = useMemo(
    () => deferredCharacters.slice(0, characterLibraryWindow.visibleCount),
    [characterLibraryWindow.visibleCount, deferredCharacters]
  );
  const isCreateProfileLoading =
    (loading && deferredCharacters.length === 0) ||
    isSwitchingCharacter ||
    (quickSwapLoading && !isSwitchingCharacter);
  const isManageCharactersLoading = loading && deferredCharacters.length === 0;
  const activeProfileImageTransform =
    isProfileAdjusterVisible && profileAdjustDraft ? profileAdjustDraft : profileImageTransform;
  const resolvedCharacterSheetPresetAssignments = useMemo(
    () => characterSheetPresetAssignments ?? createEmptyCharacterSheetPresetAssignments(),
    [characterSheetPresetAssignments]
  );
  const characterGridAdaptivePreviewEnabled = isAdaptiveSurfaceEnabled("character-grid");
  const characterGridAdaptivePressure = useMediaAdaptivePressure({
    surface: "character-grid",
    enabled: characterGridAdaptivePreviewEnabled,
  });
  const quickSwapRemainingActiveCapacity = useMemo(
    () => Math.max(0, CHARACTER_QUICK_SWAP_ACTIVE_LIMIT - quickSwapActiveItems.length),
    [quickSwapActiveItems.length]
  );
  const referencePreviewEntry =
    referencePreview && quickSwapActiveItems[referencePreview.index]
      ? quickSwapActiveItems[referencePreview.index]
      : null;
  const refreshCardPreviewSignedUrl = useCallback(
    (storagePath: string | null | undefined, failedUrl?: string | null) => {
      const trimmedStoragePath = storagePath?.trim() ?? "";
      if (!trimmedStoragePath) return;
      const attempts = cardPreviewRetryCountRef.current[trimmedStoragePath] ?? 0;
      if (attempts >= CHARACTER_CARD_PREVIEW_SIGN_RETRY_LIMIT) return;
      cardPreviewRetryCountRef.current[trimmedStoragePath] = attempts + 1;

      void getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath: trimmedStoragePath,
        expiresInSeconds: 3600,
        forceRefresh: true,
      }).then((signedUrl) => {
        const nextUrl = signedUrl?.trim() ?? "";
        if (!nextUrl) return;
        if (failedUrl && failedUrl.trim() === nextUrl) return;
        setCardPreviewUrlByStoragePath((prev) => {
          if (prev[trimmedStoragePath] === nextUrl) return prev;
          return {
            ...prev,
            [trimmedStoragePath]: nextUrl,
          };
        });
      });
    },
    []
  );
  const resolveCharacterGridPreviewUrl = useCallback(
    (url: string | null | undefined, cardLongEdgePx: number): string | null => {
      return resolveCharacterGridPreviewUrlForSurface({
        url,
        adaptivePreviewEnabled: characterGridAdaptivePreviewEnabled,
        pressureLevel: characterGridAdaptivePressure.previewPressureLevel,
        cardLongEdgePx,
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      });
    },
    [characterGridAdaptivePressure.previewPressureLevel, characterGridAdaptivePreviewEnabled]
  );
  const resolveCharacterCardPreviewUrl = useCallback(
    ({
      previewUrl,
      storagePath,
      cardLongEdgePx,
    }: {
      previewUrl: string | null | undefined;
      storagePath: string | null | undefined;
      cardLongEdgePx: number;
    }): string | null => {
      const trimmedStoragePath = storagePath?.trim() ?? "";
      const signedOverride = trimmedStoragePath
        ? (cardPreviewUrlByStoragePath[trimmedStoragePath] ?? null)
        : null;
      const sourceUrl = signedOverride ?? previewUrl;
      return resolveCharacterGridPreviewUrl(sourceUrl, cardLongEdgePx) ?? sourceUrl ?? null;
    },
    [cardPreviewUrlByStoragePath, resolveCharacterGridPreviewUrl]
  );
  const quickSwapItemById = useMemo(
    () => new Map(quickSwapActiveItems.map((item) => [item.id, item])),
    [quickSwapActiveItems]
  );
  const quickSwapItemByMediaFileId = useMemo(
    () => new Map(quickSwapActiveItems.map((item) => [item.mediaFileId, item])),
    [quickSwapActiveItems]
  );
  const quickSwapItemByLegacySlotKey = useMemo(
    () =>
      new Map(
        quickSwapActiveItems
          .filter((item) => item.legacySlotKey)
          .map((item) => [item.legacySlotKey as string, item])
      ),
    [quickSwapActiveItems]
  );
  const combinedError = error ?? quickSwapError;
  const RootContainer: "div" | "main" = isEmbeddedSurface ? "div" : "main";
  const profileImageRenderSize = isEmbeddedSurface
    ? PROFILE_PREVIEW_IMAGE_EMBEDDED_SIZE
    : PROFILE_PREVIEW_IMAGE_SIZE;
  const quickSwapContentId = useId();
  const characterSheetPresetTabsIdBase = `character-sheet-preset-${useId()}`;
  const characterSheetPresetPanelId = `${characterSheetPresetTabsIdBase}-panel`;
  const activeCharacterSheetPresetTabId = getCharacterSheetPresetTabId(
    characterSheetPresetTabsIdBase,
    activeCharacterSheetPresetId
  );
  const deleteTargetCharacterSheetPresetLabel = deleteTargetCharacterSheetPresetId
    ? (characterSheetPresetLabels[deleteTargetCharacterSheetPresetId] ??
      deleteTargetCharacterSheetPresetId)
    : null;
  const rootClassName = isEmbeddedSurface
    ? "character-manager-page character-manager-page--embedded"
    : "page page-wide character-manager-page";
  useEffect(() => {
    if (!isEmbeddedSurface || activeTab !== "create") return;
    const rootNode = rootContainerRef.current;
    if (!rootNode) return;
    const propertiesPanel = rootNode.closest(".ai-properties");
    if (!(propertiesPanel instanceof HTMLElement)) return;
    const previousOverflowY = propertiesPanel.style.overflowY;
    const previousOverscrollBehaviorY = propertiesPanel.style.overscrollBehaviorY;
    propertiesPanel.style.overflowY = "hidden";
    propertiesPanel.style.overscrollBehaviorY = "none";
    return () => {
      propertiesPanel.style.overflowY = previousOverflowY;
      propertiesPanel.style.overscrollBehaviorY = previousOverscrollBehaviorY;
    };
  }, [activeTab, isEmbeddedSurface]);
  const clearAllMessages = useCallback(() => {
    clearMessages();
    clearQuickSwapError();
  }, [clearMessages, clearQuickSwapError]);
  const quickSwapDropActive =
    (showQuickSwapCollapseToggle || !isQuickSwapCollapsed) && isDropActive;
  const {
    pendingDropTarget,
    isDropResolutionBusy,
    handleCharacterSheetReferenceDrop,
    handleQuickSwapReferenceDrop,
  } = useCharacterManagerDroppedReferenceController({
    pageBusy,
    quickSwapMutating,
    clearAllMessages,
    appendQuickSwapFiles: appendQuickSwapFilesFromHook,
    setCharacterSheetPresetFile,
    resolveCharacterDropReference,
    hasQuickSwapMediaFileId: (mediaId) => quickSwapItemByMediaFileId.has(mediaId),
  });
  useEffect(() => {
    if (showQuickSwapCollapseToggle || !isQuickSwapCollapsed) return;
    fileDragDepthRef.current = 0;
  }, [showQuickSwapCollapseToggle, isQuickSwapCollapsed]);
  useEffect(() => {
    setCardPreviewUrlByStoragePath({});
    cardPreviewRetryCountRef.current = {};
  }, [selectedCharacterId]);

  useVisibleErrorTelemetry({
    source: "client.character_manager.error_banner",
    scope: "app",
    severity: "medium",
    message: combinedError,
    metadata: {
      surface,
      active_tab: activeTab,
      beginner_mode: effectiveBeginnerMode,
      selected_character_id: selectedCharacterId,
    },
  });

  useEffect(() => {
    let active = true;
    if (!referencePreviewEntry) return () => void (active = false);
    logAdaptiveDetailFullQualityUsed({
      surface: "detail-modal",
      mediaKind: "image",
    });
    void getSignedMediaUrl({
      bucket: MEDIA_BUCKET,
      storagePath: referencePreviewEntry.storagePath,
      expiresInSeconds: 3600,
      forceRefresh: false,
    }).then((signedUrl) => {
      if (!active || !signedUrl) return;
      setReferencePreviewSignedUrl({
        itemId: referencePreviewEntry.id,
        url: signedUrl,
      });
    });

    return () => {
      active = false;
    };
  }, [referencePreviewEntry, setReferencePreviewSignedUrl]);

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
    async (incomingFiles: FileList | File[]) => {
      const files = Array.from(incomingFiles);
      if (!files.length || pageBusy || quickSwapMutating || isDropResolutionBusy) return;
      clearAllMessages();
      await appendQuickSwapFilesFromHook(files);
    },
    [
      appendQuickSwapFilesFromHook,
      clearAllMessages,
      isDropResolutionBusy,
      pageBusy,
      quickSwapMutating,
    ]
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
    if (extractInternalReferenceDragPayload(event.dataTransfer)) return true;
    return hasDroppedImageReferenceTransfer(event.dataTransfer);
  }, []);

  const handleSimpleFileSelection = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      event.target.value = "";
      if (!files.length) return;
      void uploadSimpleFiles(files);
    },
    [uploadSimpleFiles]
  );

  const openCharacterSheetPicker = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => {
      if (pageBusy || isDropResolutionBusy) return;
      clearAllMessages();
      setPendingCharacterSheetUploadZoneKey(dropZoneKey);
      characterSheetFileInputRef.current?.click();
    },
    [clearAllMessages, isDropResolutionBusy, pageBusy]
  );

  const openProfilePicker = useCallback(() => {
    if (pageBusy) return;
    if (profileImageUrl && !isProfileAdjusterVisible) {
      setProfileAdjustDraft(profileImageTransform);
      setIsProfileAdjusterVisible(true);
      return;
    }
    clearAllMessages();
    profileFileInputRef.current?.click();
  }, [
    clearAllMessages,
    isProfileAdjusterVisible,
    pageBusy,
    profileImageTransform,
    profileImageUrl,
  ]);

  const openQuickSwapUploadPicker = useCallback(() => {
    if (pageBusy || quickSwapMutating || isDropResolutionBusy) return;
    clearAllMessages();
    simpleFileInputRef.current?.click();
  }, [clearAllMessages, isDropResolutionBusy, pageBusy, quickSwapMutating]);

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
  }, [createCharacter, setActiveTab]);

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

  const confirmDeleteCharacter = useCallback(async () => {
    if (!deleteTargetCharacter) return;
    const deleted = await deleteCharacter(deleteTargetCharacter.characterId);
    if (deleted) {
      setDeleteTargetCharacter(null);
    }
  }, [deleteCharacter, deleteTargetCharacter, setDeleteTargetCharacter]);

  const confirmDeleteCharacterSheetPreset = useCallback(async () => {
    if (!deleteTargetCharacterSheetPresetId) return;
    const deleted = await deleteCharacterSheetPreset(deleteTargetCharacterSheetPresetId);
    if (deleted) {
      setDeleteTargetCharacterSheetPresetId(null);
    }
  }, [
    deleteCharacterSheetPreset,
    deleteTargetCharacterSheetPresetId,
    setDeleteTargetCharacterSheetPresetId,
  ]);

  const applyDragGhost = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    const transfer = event.dataTransfer;
    try {
      const blobNode = dragNode.querySelector<HTMLElement>(DRAG_GHOST_IMAGE_BLOB_SELECTOR);
      const ghostSourceNode = blobNode ?? dragNode;
      const sourceRect = ghostSourceNode.getBoundingClientRect();
      const fallbackRect = dragNode.getBoundingClientRect();
      const sourceWidth = sourceRect.width > 0 ? sourceRect.width : fallbackRect.width;
      const sourceHeight = sourceRect.height > 0 ? sourceRect.height : fallbackRect.height;
      const ghost = ghostSourceNode.cloneNode(true) as HTMLElement;
      const scaledWidth = Math.max(56, sourceWidth * DRAG_GHOST_SCALE);
      const scaledHeight = Math.max(72, sourceHeight * DRAG_GHOST_SCALE);
      ghost.classList.add("character-drag-ghost");
      if (blobNode) {
        ghost.classList.add("character-drag-ghost--image-only");
      }
      if (ghostSourceNode.classList.contains("character-character-sheet-media")) {
        ghost.classList.add("character-drag-ghost--character-sheet-media");
      }
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
    (characterSheetSlotKey: CharacterSheetDropZoneKey, quickSwapItemId: string) => {
      if (!selectedCharacterId) return;
      const referenceEntry = quickSwapItemById.get(quickSwapItemId);
      if (!referenceEntry) return;
      const nextAssignments = {
        ...resolvedCharacterSheetPresetAssignments,
        [characterSheetSlotKey]: {
          mediaFileId: referenceEntry.mediaFileId,
          storagePath: referenceEntry.storagePath,
          previewUrl: referenceEntry.previewUrl,
        },
      };
      persistCharacterSheetPresetAssignments(nextAssignments);
    },
    [
      persistCharacterSheetPresetAssignments,
      quickSwapItemById,
      resolvedCharacterSheetPresetAssignments,
      selectedCharacterId,
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

  const resolveDraggedQuickSwapItem = useCallback(
    (transfer: DataTransfer): CharacterQuickSwapItem | null => {
      const rawPayload = transfer.getData(DND_QUICK_SWAP_ITEM);
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as { id?: string };
          const parsedId = parsed.id?.trim();
          if (parsedId && quickSwapItemById.has(parsedId)) {
            return quickSwapItemById.get(parsedId) ?? null;
          }
        } catch {
          // Ignore malformed payload and continue with compatibility fallbacks.
        }
      }
      const mediaId =
        transfer.getData(DND_REFERENCE_SLOT_KEY)?.trim() ||
        transfer.getData("text/plain")?.trim() ||
        "";
      if (!mediaId)
        return draggedQuickSwapItemId
          ? (quickSwapItemById.get(draggedQuickSwapItemId) ?? null)
          : null;
      if (quickSwapItemByMediaFileId.has(mediaId)) {
        return quickSwapItemByMediaFileId.get(mediaId) ?? null;
      }
      if (quickSwapItemByLegacySlotKey.has(mediaId)) {
        return quickSwapItemByLegacySlotKey.get(mediaId) ?? null;
      }
      return draggedQuickSwapItemId
        ? (quickSwapItemById.get(draggedQuickSwapItemId) ?? null)
        : null;
    },
    [
      draggedQuickSwapItemId,
      quickSwapItemById,
      quickSwapItemByLegacySlotKey,
      quickSwapItemByMediaFileId,
    ]
  );

  const handleReferenceDragStart = useCallback(
    (item: CharacterQuickSwapItem) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy || quickSwapMutating || isDropResolutionBusy) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        DND_QUICK_SWAP_ITEM,
        JSON.stringify({
          id: item.id,
          mediaFileId: item.mediaFileId,
          storagePath: item.storagePath,
          previewUrl: item.previewUrl,
        })
      );
      event.dataTransfer.setData(DND_REFERENCE_SLOT_KEY, item.mediaFileId);
      event.dataTransfer.setData("text/plain", item.mediaFileId);
      setDraggedQuickSwapItemId(item.id);
      setDraggedCharacterSheetZoneKey(null);
      applyDragGhost(event);
    },
    [applyDragGhost, isDropResolutionBusy, pageBusy, quickSwapMutating]
  );

  const handleCharacterSheetDragStart = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy || isDropResolutionBusy) {
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
      setDraggedQuickSwapItemId(null);
      applyDragGhost(event);
    },
    [applyDragGhost, isDropResolutionBusy, pageBusy, resolvedCharacterSheetPresetAssignments]
  );

  const handleReferenceDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    const dragNode = event.currentTarget as HTMLElement;
    dragNode.classList.remove("is-dragging");
    const ghost = dragGhostMapRef.current.get(dragNode);
    if (ghost) {
      ghost.remove();
      dragGhostMapRef.current.delete(dragNode);
    }
    setDraggedQuickSwapItemId(null);
    setDraggedCharacterSheetZoneKey(null);
    setActiveCharacterSheetDropZone(null);
  }, []);

  const handleCharacterSheetDragOver = useCallback(
    (characterSheetSlotKey: CharacterSheetDropZoneKey) => (event: React.DragEvent<HTMLElement>) => {
      if (pageBusy || isDropResolutionBusy) return;
      const sourceCharacterSheetZoneKey =
        (event.dataTransfer.getData(DND_CHARACTER_SHEET_ZONE_KEY) as
          | CharacterSheetDropZoneKey
          | "") || draggedCharacterSheetZoneKey;
      const quickSwapItem = resolveDraggedQuickSwapItem(event.dataTransfer);
      const internalReferenceGridPayload = extractInternalReferenceDragPayload(event.dataTransfer);
      const hasExternalImageReference = hasDroppedImageReferenceTransfer(event.dataTransfer);
      const isInternalSheetDrag =
        Boolean(sourceCharacterSheetZoneKey) &&
        CHARACTER_SHEET_DROP_ZONES.some((slot) => slot.key === sourceCharacterSheetZoneKey);
      const isInternalReferenceDrag = Boolean(quickSwapItem);
      const isInternalReferenceGridDrag = Boolean(
        internalReferenceGridPayload && resolveCharacterDropReference
      );
      if (
        !isInternalSheetDrag &&
        !isInternalReferenceDrag &&
        !isInternalReferenceGridDrag &&
        !hasExternalImageReference
      ) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect =
        isInternalSheetDrag || isInternalReferenceDrag ? "move" : "copy";
      setActiveCharacterSheetDropZone(characterSheetSlotKey);
    },
    [
      draggedCharacterSheetZoneKey,
      isDropResolutionBusy,
      pageBusy,
      resolveCharacterDropReference,
      resolveDraggedQuickSwapItem,
    ]
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
      if (pageBusy || isDropResolutionBusy) return;
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

      const quickSwapItem = resolveDraggedQuickSwapItem(event.dataTransfer);
      if (quickSwapItem) {
        assignReferenceToCharacterSheetSlot(characterSheetSlotKey, quickSwapItem.id);
        return;
      }

      setActiveCharacterSheetDropZone(characterSheetSlotKey);
      void handleCharacterSheetReferenceDrop(characterSheetSlotKey, event.dataTransfer).finally(
        () => {
          setActiveCharacterSheetDropZone((current) =>
            current === characterSheetSlotKey ? null : current
          );
        }
      );
    },
    [
      assignReferenceToCharacterSheetSlot,
      draggedCharacterSheetZoneKey,
      handleCharacterSheetReferenceDrop,
      isDropResolutionBusy,
      pageBusy,
      persistCharacterSheetPresetAssignments,
      resolveDraggedQuickSwapItem,
      resolvedCharacterSheetPresetAssignments,
    ]
  );

  const handleCharacterSheetCardClick = useCallback(
    (dropZoneKey: CharacterSheetDropZoneKey) => () => {
      if (pageBusy || isDropResolutionBusy) return;
      const assignedReference = resolvedCharacterSheetPresetAssignments[dropZoneKey];
      if (assignedReference) return;
      openCharacterSheetPicker(dropZoneKey);
    },
    [
      isDropResolutionBusy,
      openCharacterSheetPicker,
      pageBusy,
      resolvedCharacterSheetPresetAssignments,
    ]
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
      ref={(node) => {
        rootContainerRef.current = node;
      }}
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
        {isEmbeddedSurface ? (
          <header className="character-library-panel-header">
            <p className="eyebrow">{CHARACTER_LIBRARY_PANEL_TITLE}</p>
            <p className="tiny subdued helper-text">{CHARACTER_LIBRARY_PANEL_HELPER_TEXT}</p>
          </header>
        ) : null}
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
              aria-selected={activeTab === "manage"}
              className={`character-mode-tab character-mode-tab--manage ${
                activeTab === "manage" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("manage")}
            >
              Manage Characters
            </button>
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
          </div>
          {activeTab === "create" && !isEmbeddedSurface && showBeginnerModeToggle ? (
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
          {activeTab === "create" && !isEmbeddedSurface ? (
            <p className="character-mode-guidance" role="note">
              <span className="character-mode-guidance-label">Tip:</span>
              Swap out your character&apos;s style on the fly by dragging and dropping references
              from the QuickSwap Deck into the Character References.
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

      {combinedError ? (
        <div className="character-feedback error" role="status">
          <XCircle size={16} weight="fill" />
          <span>{combinedError}</span>
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {isSavingName ? "Saving character name..." : ""}
      </p>

      {activeTab === "create" ? (
        <section className="character-simple-panel">
          {isCreateProfileLoading ? (
            <div className="character-create-loading" role="status" aria-live="polite">
              <span className="character-create-loading-spinner" aria-hidden="true" />
              <p className="character-create-loading-title">Loading character profile...</p>
              <p className="tiny subdued character-create-loading-copy">
                Pulling your character sheet and references into view.
              </p>
              <CharacterCreateWorkspaceLayout
                surface={surface}
                quickSwap={
                  <section className="character-section character-create-loading-card">
                    <div className="character-create-loading-heading">
                      <span className="character-create-loading-line character-create-loading-line--title" />
                      <span className="character-create-loading-line character-create-loading-line--subtitle" />
                    </div>
                    <div className="character-create-loading-quickswap-grid" aria-hidden="true">
                      {Array.from({ length: 6 }, (_, index) => (
                        <span
                          key={`character-create-loading-quickswap-${index + 1}`}
                          className="character-create-loading-thumbnail"
                        />
                      ))}
                    </div>
                  </section>
                }
                characterSheet={
                  <section className="character-section character-section--references character-create-loading-card">
                    <div className="character-create-loading-heading">
                      <span className="character-create-loading-line character-create-loading-line--title" />
                      <span className="character-create-loading-line character-create-loading-line--subtitle" />
                    </div>
                    <div className="character-create-loading-profile-row">
                      <span className="character-create-loading-profile-avatar" />
                      <span className="character-create-loading-profile-name" />
                    </div>
                    <div className="character-create-loading-tab-row">
                      <span className="character-create-loading-tab" />
                      <span className="character-create-loading-tab" />
                      <span className="character-create-loading-tab character-create-loading-tab--short" />
                    </div>
                    <span className="character-create-loading-description" />
                    <div className="character-create-loading-references-grid">
                      {Array.from({ length: 4 }, (_, index) => (
                        <span
                          key={`character-create-loading-reference-${index + 1}`}
                          className="character-create-loading-reference"
                        />
                      ))}
                    </div>
                  </section>
                }
              />
            </div>
          ) : (
            <CharacterCreateWorkspaceLayout
              surface={surface}
              quickSwap={
                <CharacterQuickSwapDeckSection
                  beginnerMode={effectiveBeginnerMode}
                  showCollapseToggle={showQuickSwapCollapseToggle}
                  isCollapsed={isQuickSwapCollapsed}
                  contentId={quickSwapContentId}
                  pageBusy={
                    pageBusy ||
                    quickSwapMutating ||
                    quickSwapLoading ||
                    pendingDropTarget?.target === "quickswap"
                  }
                  isDropActive={quickSwapDropActive || pendingDropTarget?.target === "quickswap"}
                  isDropPending={pendingDropTarget?.target === "quickswap"}
                  remainingCapacityHint={quickSwapRemainingActiveCapacity}
                  activeItems={quickSwapActiveItems}
                  archivedItems={quickSwapArchivedItems}
                  archivedCount={quickSwapArchivedCount}
                  hasMoreArchived={quickSwapHasMoreArchived}
                  loadingArchived={quickSwapLoadingArchived}
                  quickSwapGridColumnCount={quickSwapGridColumnCount}
                  quickSwapArchiveGridColumnCount={quickSwapArchiveGridColumnCount}
                  onToggleCollapsed={() => {
                    fileDragDepthRef.current = 0;
                    setIsDropActive(false);
                    setIsQuickSwapCollapsed((current) => !current);
                  }}
                  onOpenUploadPicker={openQuickSwapUploadPicker}
                  onRemoveItem={(itemId) => {
                    void removeQuickSwapItem(itemId);
                  }}
                  onRestoreArchivedItem={(itemId) => {
                    void restoreQuickSwapItem(itemId);
                  }}
                  onLoadMoreArchived={() => {
                    void loadMoreQuickSwapArchived();
                  }}
                  onReferenceDragStart={handleReferenceDragStart}
                  onReferenceDragEnd={handleReferenceDragEnd}
                  onOpenReferencePreview={openReferencePreview}
                  resolveCharacterGridPreviewUrl={resolveCharacterGridPreviewUrl}
                  resolveQuickSwapPreviewUrl={(item, cardLongEdgePx) =>
                    resolveCharacterCardPreviewUrl({
                      previewUrl: item.previewUrl,
                      storagePath: item.storagePath,
                      cardLongEdgePx,
                    })
                  }
                  onCardPreviewError={(item, failedUrl) => {
                    refreshCardPreviewSignedUrl(item.storagePath, failedUrl);
                  }}
                  onDragEnter={(event) => {
                    if (isQuickSwapCollapsed) return;
                    if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                    event.preventDefault();
                    if (pageBusy || quickSwapMutating || isDropResolutionBusy) return;
                    fileDragDepthRef.current += 1;
                    setIsDropActive(true);
                  }}
                  onDragOver={(event) => {
                    if (isQuickSwapCollapsed) return;
                    if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                    event.preventDefault();
                    if (pageBusy || quickSwapMutating || isDropResolutionBusy) {
                      event.dataTransfer.dropEffect = "none";
                      return;
                    }
                    event.dataTransfer.dropEffect = "copy";
                    if (!isDropActive) setIsDropActive(true);
                  }}
                  onDragLeave={(event) => {
                    if (isQuickSwapCollapsed) return;
                    if (!isFileDragEvent(event) && !isDroppedImageReferenceEvent(event)) return;
                    if (pageBusy || quickSwapMutating || isDropResolutionBusy) return;
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
                    if (pageBusy || quickSwapMutating || isDropResolutionBusy) return;
                    const files = event.dataTransfer?.files;
                    if (files?.length) {
                      void uploadSimpleFiles(files);
                      return;
                    }
                    void handleQuickSwapReferenceDrop(event.dataTransfer).finally(() => {
                      setIsDropActive(false);
                    });
                  }}
                />
              }
              characterSheet={
                <section className="character-section character-section--references">
                  <div className="character-section-head">
                    <div className="character-section-title-row">
                      {effectiveBeginnerMode ? (
                        <span className="character-step-badge" aria-hidden="true">
                          2
                        </span>
                      ) : null}
                      <div className="character-section-title-copy">
                        <h3 className="character-section-title">Character Sheet</h3>
                        <p className="character-section-helper tiny subdued">
                          Drag or upload references into each slot. These images are used to train
                          your character generations.
                        </p>
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
                  </div>

                  <CharacterSheetPresetTabs
                    presetIds={visibleCharacterSheetPresetIds}
                    activePresetId={activeCharacterSheetPresetId}
                    presetLabels={characterSheetPresetLabels}
                    onSelectPreset={(presetId) => {
                      void setActiveCharacterSheetPreset(presetId);
                    }}
                    onAddPreset={() => {
                      void addCharacterSheetPreset();
                    }}
                    onRenamePreset={(presetId, nextLabel) => {
                      void renameCharacterSheetPreset(presetId, nextLabel);
                    }}
                    onDeletePreset={(presetId) => {
                      if (pageBusy || isSavingCharacterSheetPreset) return;
                      clearAllMessages();
                      setDeleteTargetCharacterSheetPresetId(presetId);
                    }}
                    panelId={characterSheetPresetPanelId}
                    disabled={pageBusy}
                    idBase={characterSheetPresetTabsIdBase}
                  />

                  <div
                    className="character-sheet-preset-panel"
                    role="tabpanel"
                    id={characterSheetPresetPanelId}
                    aria-labelledby={activeCharacterSheetPresetTabId}
                  >
                    <CharacterDescriptionEditorCard
                      description={characterDescription}
                      helperText={CHARACTER_DESCRIPTION_HELPER_TEXT}
                      maxLength={CHARACTER_DESCRIPTION_MAX_LENGTH}
                      rows={isEmbeddedSurface ? 3 : 4}
                      disabled={loading}
                      onChangeDescription={setCharacterDescription}
                    />
                    <div className="character-sheet-references-title-row character-profile-fields character-profile-fields--label-serif">
                      <p className="input-label">Character References:</p>
                      <p className="character-sheet-references-helper tiny subdued">
                        {CHARACTER_REFERENCES_HELPER_TEXT}
                      </p>
                    </div>
                    <div className="character-reference-empty-grid">
                      {CHARACTER_SHEET_DROP_ZONES.map((dropZone) => {
                        const assignedReference =
                          resolvedCharacterSheetPresetAssignments[dropZone.key];
                        const isDropActive = activeCharacterSheetDropZone === dropZone.key;
                        const isDropPending =
                          pendingDropTarget?.target === "character_sheet" &&
                          pendingDropTarget.zoneKey === dropZone.key;
                        const isRequiredSlot = dropZone.key === "portrait";
                        const slotRequirementCopy = isRequiredSlot ? "(Required)" : "(Optional)";
                        return (
                          <article
                            key={dropZone.key}
                            className={`character-character-sheet-card ${
                              assignedReference ? "is-filled" : "is-empty"
                            } ${isDropActive ? "is-drop-active" : ""} ${
                              draggedCharacterSheetZoneKey === dropZone.key ? "is-dragging" : ""
                            } ${isDropPending ? "is-drop-pending" : ""} ${
                              pendingDropTarget?.target === "quickswap" ? "is-drop-blocked" : ""
                            }`}
                            draggable={!pageBusy && !isDropPending && Boolean(assignedReference)}
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
                                    resolveCharacterCardPreviewUrl({
                                      previewUrl: assignedReference.previewUrl,
                                      storagePath: assignedReference.storagePath,
                                      cardLongEdgePx: 300,
                                    }) ?? assignedReference.previewUrl
                                  }
                                  alt={`${dropZone.label} reference`}
                                  className="character-character-sheet-image"
                                  width={240}
                                  height={300}
                                  onError={(event) => {
                                    refreshCardPreviewSignedUrl(
                                      assignedReference.storagePath,
                                      event.currentTarget.currentSrc ||
                                        event.currentTarget.src ||
                                        null
                                    );
                                  }}
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
                                  {isDropPending ? (
                                    <span className="character-character-sheet-drop-pending tiny">
                                      Assigning...
                                    </span>
                                  ) : null}
                                </span>
                              )}
                            </div>
                            <span className="character-reference-empty-hint">{dropZone.label}</span>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                </section>
              }
              embeddedGuidance={
                isEmbeddedSurface && !isQuickSwapTipHidden ? (
                  <p className="character-mode-guidance character-mode-guidance--sheet" role="note">
                    <span className="character-mode-guidance-label">Tip:</span>
                    Swap out your character&apos;s style on the fly by dragging and dropping
                    references from the QuickSwap Deck into the Character References.
                  </p>
                ) : undefined
              }
            />
          )}
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

          {isManageCharactersLoading ? (
            <div className="character-manage-loading" role="status" aria-live="polite">
              <span className="character-manage-loading-spinner" aria-hidden="true" />
              <p className="character-manage-loading-title">Loading characters...</p>
              <p className="tiny subdued character-manage-loading-copy">
                Pulling your character library into view.
              </p>
              <div className="character-manage-loading-skeleton" aria-hidden="true">
                {Array.from({ length: 4 }, (_, index) => (
                  <div
                    key={`character-manage-loading-skeleton-${index + 1}`}
                    className="character-manage-loading-skeleton-card"
                  >
                    <span className="character-manage-loading-skeleton-avatar" />
                    <span className="character-manage-loading-skeleton-lines">
                      <span className="character-manage-loading-skeleton-line character-manage-loading-skeleton-line--short" />
                      <span className="character-manage-loading-skeleton-line character-manage-loading-skeleton-line--long" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {characters.length > CHARACTER_LIBRARY_SMOOTH_TARGET ? (
                <div className="character-manage-window-status">
                  <p className="tiny subdued">
                    Showing {characterLibraryWindow.visibleCount} of {deferredCharacters.length}{" "}
                    characters.
                  </p>
                  {characterLibraryWindow.hiddenCount > 0 ? (
                    <div className="character-manage-window-actions">
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() =>
                          setCharacterLibraryVisibleCount(
                            characterLibraryRequestedVisibleCount + CHARACTER_LIBRARY_EXPAND_STEP
                          )
                        }
                      >
                        Show{" "}
                        {Math.min(
                          CHARACTER_LIBRARY_EXPAND_STEP,
                          characterLibraryWindow.hiddenCount
                        )}{" "}
                        more
                      </button>
                      <button
                        type="button"
                        className="ghost-btn mini"
                        onClick={() => setCharacterLibraryVisibleCount(deferredCharacters.length)}
                      >
                        Show all
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="character-manage-list" role="list" aria-label="Character list">
                {visibleManageCharacters.map((character) => {
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
                            <p className="metric-label tiny">
                              {isSelected ? "Selected" : "Character"}
                            </p>
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
            </>
          )}
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
                referencePreviewSignedUrl.itemId === referencePreviewEntry.id
                  ? referencePreviewSignedUrl.url
                  : referencePreviewEntry.previewUrl
              }
              alt={`Reference ${referencePreview.index + 1}`}
              className="character-reference-preview-image"
              width={1600}
              height={1600}
              onLoadingComplete={(loadedImage) => {
                const loadedAspectRatio = loadedImage.naturalWidth / loadedImage.naturalHeight;
                if (!Number.isFinite(loadedAspectRatio) || loadedAspectRatio <= 0) return;
                const clampedAspectRatio = clampReferencePreviewAspectRatio(loadedAspectRatio);
                setReferencePreview((current) => {
                  if (!current) return current;
                  const currentEntry = quickSwapActiveItems[current.index];
                  if (!currentEntry || currentEntry.id !== referencePreviewEntry.id) {
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

      {deleteTargetCharacterSheetPresetId ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-character-sheet-preset-title"
        >
          <div className="modal-card character-delete-confirm-card">
            <h3 id="delete-character-sheet-preset-title">
              Delete preset &ldquo;{deleteTargetCharacterSheetPresetLabel}&rdquo;?
            </h3>
            <p className="subdued tiny character-delete-confirm-copy">
              This removes saved references from this preset tab. Do you wish to continue?
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={cancelDeleteCharacterSheetPreset}
                disabled={isSavingCharacterSheetPreset}
              >
                No
              </button>
              <button
                type="button"
                className="btn-danger character-delete-confirm-btn"
                onClick={() => {
                  void confirmDeleteCharacterSheetPreset();
                }}
                disabled={isSavingCharacterSheetPreset}
              >
                {isSavingCharacterSheetPreset ? "Deleting..." : "Yes"}
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
