/**
 * View-state controller for the Elements library panel.
 * Mirrors the embedded Character UX while persisting element data to Supabase.
 */
import React from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import type { InternalReferenceDragPayload } from "../../../lib/internalReferenceDragPayload";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import {
  ELEMENT_REFERENCE_SET_IDS,
  MAX_ELEMENT_REFERENCE_SET_TAB_COUNT,
  createDefaultElementReferenceSetState,
  createEmptyElementDraft,
} from "../constants";
import type {
  ElementAssetType,
  ElementDraft,
  ElementLibraryItem,
  ElementsWorkflowTab,
  ElementReferenceSetId,
  ElementReferenceSetState,
} from "../types";
import { useElementsManagerDraft } from "./useElementsManagerDraft";
import {
  clearElementProfileImage,
  createElementDraftRow,
  DEFAULT_ELEMENT_NAME,
  deleteElementManagerDraft,
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
  saveElementManagerDraftSnapshot,
  saveElementProfileImageAdjustments,
  uploadElementProfileImage,
} from "../logic/elementsManagerPersistence";

const MEDIA_BUCKET = "media_library";
const SUPABASE_STORAGE_OBJECT_URL_PATTERN =
  /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/]+)\/(.+)$/i;

type ElementProfileImageDropSource = {
  url?: string | null;
  mediaId?: string | null;
  storagePath?: string | null;
  loadBlob?: (() => Promise<Blob>) | null;
};

type DroppedStorageCandidate = {
  bucket: string;
  storagePath: string;
};

const getNextReferenceSetId = (
  visibleReferenceSetIds: readonly ElementReferenceSetId[]
): ElementReferenceSetId | null =>
  ELEMENT_REFERENCE_SET_IDS.find((setId) => !visibleReferenceSetIds.includes(setId)) ?? null;

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

const sanitizeFilenameSegment = (value: string): string =>
  value
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const inferProfileImageExtension = (mimeType: string, sourceUrl: string): string => {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  if (normalizedMimeType === "image/png") return "png";
  if (normalizedMimeType === "image/webp") return "webp";
  if (normalizedMimeType === "image/gif") return "gif";
  if (normalizedMimeType === "image/avif") return "avif";
  if (normalizedMimeType === "image/bmp") return "bmp";
  if (normalizedMimeType === "image/heic") return "heic";
  if (normalizedMimeType === "image/heif") return "heif";
  if (normalizedMimeType === "image/svg+xml") return "svg";
  try {
    const pathSegment = new URL(sourceUrl, window.location.href).pathname.split("/").pop() ?? "";
    const trimmed = pathSegment.trim().toLowerCase();
    const extension = trimmed.split(".").pop() ?? "";
    if (extension && extension !== trimmed) {
      return sanitizeFilenameSegment(extension) || "jpg";
    }
  } catch {
    // Ignore URL parsing failures and fall back to jpg.
  }
  return "jpg";
};

const buildProfileImageFileName = (sourceUrl: string, mimeType: string): string => {
  try {
    const parsedUrl = new URL(sourceUrl, window.location.href);
    const pathSegment = parsedUrl.pathname.split("/").pop() ?? "";
    const cleanedSegment = sanitizeFilenameSegment(pathSegment);
    if (cleanedSegment) {
      const hasExtension = /\.[a-z0-9]{2,5}$/i.test(cleanedSegment);
      if (hasExtension) {
        return cleanedSegment;
      }
      return `${cleanedSegment}.${inferProfileImageExtension(mimeType, sourceUrl)}`;
    }
  } catch {
    // Ignore URL parsing failures and fall back below.
  }
  return `element-profile.${inferProfileImageExtension(mimeType, sourceUrl)}`;
};

const parseDroppedStorageCandidateFromUrl = (url: string): DroppedStorageCandidate | null => {
  try {
    const parsedUrl = new URL(url, window.location.href);
    const pathMatch = parsedUrl.pathname.match(SUPABASE_STORAGE_OBJECT_URL_PATTERN);
    if (!pathMatch) return null;
    const bucket = (pathMatch[1] ?? "").trim();
    const storagePath = decodeURIComponent(pathMatch[2] ?? "")
      .replace(/^\/+/, "")
      .trim();
    if (!bucket || !storagePath) return null;
    return { bucket, storagePath };
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
  source: ElementProfileImageDropSource
): Promise<DroppedStorageCandidate[]> => {
  const candidates: DroppedStorageCandidate[] = [];
  const explicitStoragePath = source.storagePath?.trim() ?? "";
  if (explicitStoragePath) {
    candidates.push({
      bucket: MEDIA_BUCKET,
      storagePath: explicitStoragePath,
    });
  }

  const normalizedSourceUrl = source.url?.trim() ?? "";
  const urlCandidate = normalizedSourceUrl
    ? parseDroppedStorageCandidateFromUrl(normalizedSourceUrl)
    : null;
  if (urlCandidate) {
    candidates.push(urlCandidate);
  }

  const normalizedMediaId = source.mediaId?.trim() ?? "";
  if (normalizedMediaId) {
    try {
      const supabase = ensureSupabaseQueryClient();
      const { data, error } = await supabase
        .from("media_files")
        .select("storage_path")
        .eq("id", normalizedMediaId)
        .maybeSingle();
      if (!error) {
        const storagePath = (
          (data as { storage_path?: string | null } | null)?.storage_path ?? ""
        ).trim();
        if (storagePath) {
          candidates.unshift({
            bucket: MEDIA_BUCKET,
            storagePath,
          });
        }
      }
    } catch {
      // Best-effort lookup only.
    }
  }

  return dedupeDroppedStorageCandidates(candidates);
};

const downloadDroppedProfileImageBlob = async (
  source: ElementProfileImageDropSource
): Promise<{ blob: Blob; resolvedStoragePath: string | null }> => {
  if (source.loadBlob) {
    return {
      blob: await source.loadBlob(),
      resolvedStoragePath: source.storagePath?.trim() || null,
    };
  }

  const storageCandidates = await resolveDroppedStorageCandidates(source);
  if (storageCandidates.length > 0) {
    try {
      const supabase = ensureSupabaseQueryClient();
      for (const candidate of storageCandidates) {
        const { data, error } = await supabase.storage
          .from(candidate.bucket)
          .download(candidate.storagePath);
        if (error || !data) {
          continue;
        }
        return {
          blob: data,
          resolvedStoragePath: candidate.storagePath,
        };
      }
    } catch {
      // Fall back to direct fetch below.
    }
  }

  const normalizedSourceUrl = source.url?.trim() ?? "";
  if (!normalizedSourceUrl) {
    throw new Error("Dropped image source could not be resolved.");
  }
  const response = await fetch(normalizedSourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to read profile image (${response.status}).`);
  }
  return {
    blob: await response.blob(),
    resolvedStoragePath: null,
  };
};

const buildProfileImageFileNameFromStoragePath = (
  storagePath: string,
  mimeType: string,
  sourceUrl: string
): string => {
  const pathSegment = storagePath.split("/").pop() ?? "";
  const cleanedSegment = sanitizeFilenameSegment(pathSegment);
  if (cleanedSegment) {
    const hasExtension = /\.[a-z0-9]{2,5}$/i.test(cleanedSegment);
    if (hasExtension) {
      return cleanedSegment;
    }
    return `${cleanedSegment}.${inferProfileImageExtension(mimeType, sourceUrl)}`;
  }
  return buildProfileImageFileName(sourceUrl, mimeType);
};

const buildElementItemFromDraft = (
  draft: ElementDraft,
  options: {
    id: string;
    updatedAt?: string | null;
    status?: ElementLibraryItem["status"];
  }
): ElementLibraryItem => {
  const activeReferenceSet = draft.referenceSets[draft.activeReferenceSetId];
  return {
    id: options.id,
    name: draft.name.trim(),
    alias: draft.alias.trim(),
    description: activeReferenceSet.description.trim(),
    assetType: draft.assetType,
    profileImageUrl: draft.profileImageUrl,
    profileImageTransform: draft.profileImageTransform,
    thumbnailUrl: draft.profileImageUrl,
    deckReferenceUrls:
      draft.assetType === "image"
        ? activeReferenceSet.deckReferenceUrls.filter(Boolean).slice(0, 6)
        : [],
    imageReferenceUrls:
      draft.assetType === "image"
        ? activeReferenceSet.imageReferenceUrls.filter(Boolean).slice(0, 6)
        : [],
    videoReferenceUrl:
      draft.assetType === "video" ? activeReferenceSet.videoReferenceUrl.trim() || null : null,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    status: options.status ?? "ready",
    referenceSetState: {
      activeSetId: draft.activeReferenceSetId,
      tabOrder: draft.visibleReferenceSetIds,
      tabLabels: draft.referenceSetLabels,
      sets: draft.referenceSets,
    },
  };
};

const buildDraftFromReferenceSetState = (
  item: Pick<ElementLibraryItem, "name" | "alias" | "profileImageUrl" | "profileImageTransform"> & {
    referenceSetState: ElementReferenceSetState;
  }
): ElementDraft => {
  const activeSet = item.referenceSetState.sets[item.referenceSetState.activeSetId];
  return {
    name: item.name,
    alias: item.alias,
    description: activeSet.description,
    assetType: activeSet.assetType,
    profileImageUrl: item.profileImageUrl,
    profileImageTransform: item.profileImageTransform,
    deckReferenceUrls: activeSet.deckReferenceUrls,
    imageReferenceUrls: activeSet.imageReferenceUrls,
    videoReferenceUrl: activeSet.videoReferenceUrl,
    activeReferenceSetId: item.referenceSetState.activeSetId,
    visibleReferenceSetIds: item.referenceSetState.tabOrder,
    referenceSetLabels: item.referenceSetState.tabLabels,
    referenceSets: item.referenceSetState.sets,
  };
};

const buildElementItemFromSnapshot = (
  snapshot: Awaited<ReturnType<typeof loadElementManagerDraftByElementId>>
): ElementLibraryItem =>
  buildElementItemFromDraft(
    buildDraftFromReferenceSetState({
      name: snapshot.name,
      alias: snapshot.alias,
      profileImageUrl: snapshot.profileImageUrl,
      profileImageTransform: snapshot.profileImageTransform,
      referenceSetState: snapshot.referenceSetState,
    }),
    {
      id: snapshot.elementId,
      updatedAt: snapshot.updatedAt,
      status: snapshot.status,
    }
  );

const buildLibraryItemFromListRow = (
  row: Awaited<ReturnType<typeof fetchElementsManagerList>>[number]
): ElementLibraryItem => {
  const defaultState = createDefaultElementReferenceSetState();
  return {
    id: row.elementId,
    name: row.elementName,
    alias: row.elementAlias,
    description: "",
    assetType: row.elementAssetType,
    profileImageUrl: row.profileImageUrl,
    profileImageTransform: row.profileImageTransform,
    thumbnailUrl: row.profileImageUrl,
    deckReferenceUrls: [],
    imageReferenceUrls: [],
    videoReferenceUrl: null,
    updatedAt: row.updatedAt,
    status: row.elementStatus,
    referenceSetState: defaultState,
  };
};

const serializeDraftState = (draft: ElementDraft): string =>
  JSON.stringify({
    name: draft.name,
    alias: draft.alias,
    assetType: draft.assetType,
    profileImageUrl: draft.profileImageUrl,
    profileImageTransform: draft.profileImageTransform,
    activeReferenceSetId: draft.activeReferenceSetId,
    visibleReferenceSetIds: draft.visibleReferenceSetIds,
    referenceSetLabels: draft.referenceSetLabels,
    referenceSets: draft.referenceSets,
  });

type UseElementsManagerViewStateParams = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
};

export const useElementsManagerViewState = ({
  resolveProfileImageDropSource,
}: UseElementsManagerViewStateParams = {}) => {
  const [activeTab, setActiveTab] = React.useState<ElementsWorkflowTab>("manage");
  const [elements, setElements] = React.useState<ElementLibraryItem[]>([]);
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [pendingDeleteElementId, setPendingDeleteElementId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isCreatingElement, setIsCreatingElement] = React.useState(false);
  const [isDeletingElement, setIsDeletingElement] = React.useState(false);
  const [isSwitchingElement, setIsSwitchingElement] = React.useState(false);
  const [isSavingProfileImage, setIsSavingProfileImage] = React.useState(false);
  const { draft, hydrateDraft, setDraft, resetDraft } = useElementsManagerDraft();

  const selectedElement = elements.find((item) => item.id === selectedElementId) ?? null;
  const selectedElementIdRef = React.useRef<string | null>(null);
  const suppressNextPersistRef = React.useRef(false);
  const persistTimerRef = React.useRef<number | null>(null);
  const lastPersistedDraftRef = React.useRef<string>(
    serializeDraftState(createEmptyElementDraft())
  );

  React.useEffect(() => {
    selectedElementIdRef.current = selectedElementId;
  }, [selectedElementId]);

  const updateElementListEntry = React.useCallback((nextItem: ElementLibraryItem) => {
    setElements((current) => {
      const existingIndex = current.findIndex((item) => item.id === nextItem.id);
      if (existingIndex < 0) {
        return [nextItem, ...current];
      }
      const next = [...current];
      next[existingIndex] = nextItem;
      return next;
    });
  }, []);

  const syncElementListEntryById = React.useCallback(
    (
      elementId: string | null | undefined,
      nextDraft: ElementDraft,
      options?: { updatedAt?: string; status?: ElementLibraryItem["status"] }
    ) => {
      const targetId = elementId?.trim();
      if (!targetId) return;
      updateElementListEntry(
        buildElementItemFromDraft(nextDraft, {
          id: targetId,
          updatedAt: options?.updatedAt,
          status: options?.status,
        })
      );
    },
    [updateElementListEntry]
  );

  const loadElements = React.useCallback(async () => {
    try {
      setLoading(true);
      const list = await fetchElementsManagerList();
      setElements(list.map(buildLibraryItemFromListRow));
      setError(null);
    } catch (nextError) {
      setElements([]);
      setError(toErrorMessage(nextError, "Failed to load elements."));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadElements();
  }, [loadElements]);

  const syncSelectedElement = React.useCallback(
    (
      nextDraft: ElementDraft,
      options?: { updatedAt?: string; status?: ElementLibraryItem["status"] }
    ) => {
      syncElementListEntryById(selectedElementIdRef.current, nextDraft, options);
    },
    [syncElementListEntryById]
  );

  const updateDraftField = React.useCallback(
    <K extends keyof ElementDraft>(field: K, value: ElementDraft[K]) => {
      setDraft((current) => {
        const nextDraft: ElementDraft = { ...current, [field]: value };
        if (field === "assetType") {
          nextDraft.referenceSets = {
            ...current.referenceSets,
            [current.activeReferenceSetId]: {
              ...current.referenceSets[current.activeReferenceSetId],
              assetType: value,
            },
          };
        }
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const updateActiveReferenceSet = React.useCallback(
    (
      updater: (
        current: ElementDraft["referenceSets"][ElementReferenceSetId]
      ) => ElementDraft["referenceSets"][ElementReferenceSetId]
    ) => {
      setDraft((current) => {
        const nextReferenceSets = {
          ...current.referenceSets,
          [current.activeReferenceSetId]: updater(
            current.referenceSets[current.activeReferenceSetId]
          ),
        };
        const activeSet = nextReferenceSets[current.activeReferenceSetId];
        const nextDraft: ElementDraft = {
          ...current,
          assetType: activeSet.assetType,
          referenceSets: nextReferenceSets,
          description: activeSet.description,
          deckReferenceUrls: activeSet.deckReferenceUrls,
          imageReferenceUrls: activeSet.imageReferenceUrls,
          videoReferenceUrl: activeSet.videoReferenceUrl,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const setActiveReferenceSet = React.useCallback(
    (setId: ElementReferenceSetId) => {
      setDraft((current) => {
        const activeSet = current.referenceSets[setId];
        const nextDraft: ElementDraft = {
          ...current,
          activeReferenceSetId: setId,
          assetType: activeSet.assetType,
          description: activeSet.description,
          deckReferenceUrls: activeSet.deckReferenceUrls,
          imageReferenceUrls: activeSet.imageReferenceUrls,
          videoReferenceUrl: activeSet.videoReferenceUrl,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const handleCreateElement = React.useCallback(async () => {
    setError(null);
    setIsCreatingElement(true);
    try {
      const created = await createElementDraftRow({
        name: DEFAULT_ELEMENT_NAME,
      });
      const snapshot = await loadElementManagerDraftByElementId(created.elementId);
      const nextItem = buildElementItemFromSnapshot(snapshot);
      suppressNextPersistRef.current = true;
      lastPersistedDraftRef.current = serializeDraftState(
        buildDraftFromReferenceSetState({
          name: snapshot.name,
          alias: snapshot.alias,
          profileImageUrl: snapshot.profileImageUrl,
          profileImageTransform: snapshot.profileImageTransform,
          referenceSetState: snapshot.referenceSetState,
        })
      );
      updateElementListEntry(nextItem);
      setSelectedElementId(snapshot.elementId);
      hydrateDraft(nextItem);
      setActiveTab("profile");
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to create a new element."));
    } finally {
      setIsCreatingElement(false);
    }
  }, [hydrateDraft, updateElementListEntry]);

  const handleSelectElement = React.useCallback(
    async (elementId: string) => {
      if (!elementId) return;
      if (elementId === selectedElementIdRef.current && activeTab === "profile") return;
      setError(null);
      setIsSwitchingElement(true);
      try {
        const snapshot = await loadElementManagerDraftByElementId(elementId);
        const nextItem = buildElementItemFromSnapshot(snapshot);
        const nextDraft = buildDraftFromReferenceSetState({
          name: snapshot.name,
          alias: snapshot.alias,
          profileImageUrl: snapshot.profileImageUrl,
          profileImageTransform: snapshot.profileImageTransform,
          referenceSetState: snapshot.referenceSetState,
        });
        suppressNextPersistRef.current = true;
        lastPersistedDraftRef.current = serializeDraftState(nextDraft);
        updateElementListEntry(nextItem);
        setSelectedElementId(elementId);
        hydrateDraft(nextItem);
        setActiveTab("profile");
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to switch element."));
      } finally {
        setIsSwitchingElement(false);
      }
    },
    [activeTab, hydrateDraft, updateElementListEntry]
  );

  const handleDeleteElement = React.useCallback(async () => {
    if (!pendingDeleteElementId) return;
    setError(null);
    setIsDeletingElement(true);
    try {
      await deleteElementManagerDraft({ elementId: pendingDeleteElementId });
      setElements((current) => current.filter((item) => item.id !== pendingDeleteElementId));
      if (selectedElementIdRef.current === pendingDeleteElementId) {
        setSelectedElementId(null);
        resetDraft();
        lastPersistedDraftRef.current = serializeDraftState(createEmptyElementDraft());
        setActiveTab("manage");
      }
      setPendingDeleteElementId(null);
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to delete element."));
    } finally {
      setIsDeletingElement(false);
    }
  }, [pendingDeleteElementId, resetDraft]);

  const onAddReferenceSet = React.useCallback(() => {
    setDraft((current) => {
      if (current.visibleReferenceSetIds.length >= MAX_ELEMENT_REFERENCE_SET_TAB_COUNT) {
        return current;
      }
      const nextSetId = getNextReferenceSetId(current.visibleReferenceSetIds);
      if (!nextSetId) return current;
      const defaults = createDefaultElementReferenceSetState();
      const nextReferenceSets = {
        ...current.referenceSets,
        [nextSetId]: current.referenceSets[nextSetId] ?? defaults.sets[nextSetId],
      };
      const nextDraft = {
        ...current,
        activeReferenceSetId: nextSetId,
        assetType: "image" as const,
        visibleReferenceSetIds: [...current.visibleReferenceSetIds, nextSetId],
        referenceSetLabels: {
          ...current.referenceSetLabels,
          [nextSetId]: current.referenceSetLabels[nextSetId] ?? defaults.tabLabels[nextSetId],
        },
        referenceSets: nextReferenceSets,
        description: nextReferenceSets[nextSetId].description,
        deckReferenceUrls: nextReferenceSets[nextSetId].deckReferenceUrls,
        imageReferenceUrls: nextReferenceSets[nextSetId].imageReferenceUrls,
        videoReferenceUrl: nextReferenceSets[nextSetId].videoReferenceUrl,
      };
      syncSelectedElement(nextDraft);
      return nextDraft;
    });
  }, [setDraft, syncSelectedElement]);

  const onRenameReferenceSet = React.useCallback(
    (setId: ElementReferenceSetId, nextLabel: string) => {
      setDraft((current) => {
        const nextDraft = {
          ...current,
          referenceSetLabels: {
            ...current.referenceSetLabels,
            [setId]: nextLabel.trim() || current.referenceSetLabels[setId],
          },
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const onDeleteReferenceSet = React.useCallback(
    (setId: ElementReferenceSetId) => {
      setDraft((current) => {
        if (setId === "1") return current;
        const nextVisibleReferenceSetIds = current.visibleReferenceSetIds.filter(
          (visibleSetId) => visibleSetId !== setId
        );
        const fallbackSetId = nextVisibleReferenceSetIds[0] ?? "1";
        const nextReferenceSets = {
          ...current.referenceSets,
          [setId]: createDefaultElementReferenceSetState().sets[setId],
        };
        const fallbackSet = nextReferenceSets[fallbackSetId];
        const nextDraft = {
          ...current,
          activeReferenceSetId: fallbackSetId,
          assetType: fallbackSet.assetType,
          visibleReferenceSetIds: nextVisibleReferenceSetIds,
          referenceSets: nextReferenceSets,
          description: fallbackSet.description,
          deckReferenceUrls: fallbackSet.deckReferenceUrls,
          imageReferenceUrls: fallbackSet.imageReferenceUrls,
          videoReferenceUrl: fallbackSet.videoReferenceUrl,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const assignActiveImageReferenceAtIndex = React.useCallback(
    (index: number, referenceUrl: string) => {
      const normalizedReferenceUrl = referenceUrl.trim();
      if (!normalizedReferenceUrl) return;
      updateActiveReferenceSet((current) => {
        const nextImageReferenceUrls = [...current.imageReferenceUrls];
        while (nextImageReferenceUrls.length <= index) {
          nextImageReferenceUrls.push("");
        }
        nextImageReferenceUrls[index] = normalizedReferenceUrl;
        return {
          ...current,
          imageReferenceUrls: nextImageReferenceUrls.slice(0, 6),
        };
      });
    },
    [updateActiveReferenceSet]
  );

  const appendActiveDeckReference = React.useCallback(
    (referenceUrl: string) => {
      const normalizedReferenceUrl = referenceUrl.trim();
      if (!normalizedReferenceUrl) return;
      updateActiveReferenceSet((current) => {
        const nextDeckReferenceUrls = [...current.deckReferenceUrls];
        const nextOpenIndex = nextDeckReferenceUrls.findIndex((value) => !value.trim());
        if (nextOpenIndex >= 0) {
          nextDeckReferenceUrls[nextOpenIndex] = normalizedReferenceUrl;
        } else if (nextDeckReferenceUrls.length < 6) {
          nextDeckReferenceUrls.push(normalizedReferenceUrl);
        } else {
          return current;
        }
        return {
          ...current,
          deckReferenceUrls: nextDeckReferenceUrls.slice(0, 6),
        };
      });
    },
    [updateActiveReferenceSet]
  );

  const removeActiveDeckReferenceAtIndex = React.useCallback(
    (index: number) => {
      updateActiveReferenceSet((current) => ({
        ...current,
        deckReferenceUrls: current.deckReferenceUrls.filter(
          (_, currentIndex) => currentIndex !== index
        ),
      }));
    },
    [updateActiveReferenceSet]
  );

  const clearActiveImageReferenceAtIndex = React.useCallback(
    (index: number) => {
      updateActiveReferenceSet((current) => {
        const nextImageReferenceUrls = [...current.imageReferenceUrls];
        if (index >= nextImageReferenceUrls.length) return current;
        nextImageReferenceUrls[index] = "";
        return {
          ...current,
          imageReferenceUrls: nextImageReferenceUrls,
        };
      });
    },
    [updateActiveReferenceSet]
  );

  const assignActiveVideoReference = React.useCallback(
    (referenceUrl: string) => {
      const normalizedReferenceUrl = referenceUrl.trim();
      updateActiveReferenceSet((current) => ({
        ...current,
        videoReferenceUrl: normalizedReferenceUrl,
      }));
    },
    [updateActiveReferenceSet]
  );

  const onSetAssetType = React.useCallback(
    (assetType: ElementAssetType) => {
      setDraft((current) => {
        if (current.assetType === assetType) return current;

        const nextReferenceSet = {
          ...current.referenceSets[current.activeReferenceSetId],
          assetType,
          deckReferenceUrls: assetType === "image" ? current.deckReferenceUrls : [],
          imageReferenceUrls: assetType === "image" ? current.imageReferenceUrls : [],
          videoReferenceUrl: assetType === "video" ? current.videoReferenceUrl : "",
        };
        const nextReferenceSets = {
          ...current.referenceSets,
          [current.activeReferenceSetId]: nextReferenceSet,
        };
        const nextDraft = {
          ...current,
          assetType,
          referenceSets: nextReferenceSets,
          deckReferenceUrls: nextReferenceSet.deckReferenceUrls,
          imageReferenceUrls: nextReferenceSet.imageReferenceUrls,
          videoReferenceUrl: nextReferenceSet.videoReferenceUrl,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const clearActiveVideoReference = React.useCallback(() => {
    updateActiveReferenceSet((current) => {
      if (!current.videoReferenceUrl.trim()) return current;
      return {
        ...current,
        videoReferenceUrl: "",
      };
    });
  }, [updateActiveReferenceSet]);

  const saveProfileImageFile = React.useCallback(
    async (profileFile: File) => {
      const targetId = selectedElementIdRef.current;
      if (!targetId) return;
      setError(null);
      setIsSavingProfileImage(true);
      try {
        const result = await uploadElementProfileImage({
          elementId: targetId,
          file: profileFile,
        });
        setDraft((current) => {
          const nextDraft = {
            ...current,
            profileImageUrl: result.profileImageUrl,
            profileImageTransform: result.profileImageTransform,
          };
          lastPersistedDraftRef.current = serializeDraftState(nextDraft);
          syncElementListEntryById(targetId, nextDraft);
          return nextDraft;
        });
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save element profile image."));
      } finally {
        setIsSavingProfileImage(false);
      }
    },
    [setDraft, syncElementListEntryById]
  );

  const onSetProfileImageFile = React.useCallback(
    async (file: File) => {
      await saveProfileImageFile(file);
    },
    [saveProfileImageFile]
  );

  const onSetProfileImageFromUrl = React.useCallback(
    async (source: string | ElementProfileImageDropSource) => {
      const normalizedSource: ElementProfileImageDropSource =
        typeof source === "string" ? { url: source.trim() } : source;
      const normalizedSourceUrl = normalizedSource.url?.trim() ?? "";
      if (!normalizedSourceUrl && !normalizedSource.loadBlob) return;
      const targetId = selectedElementIdRef.current;
      if (!targetId) return;
      setError(null);
      setIsSavingProfileImage(true);
      try {
        const { blob, resolvedStoragePath } = await downloadDroppedProfileImageBlob({
          ...normalizedSource,
          url: normalizedSourceUrl,
        });
        const mimeType = blob.type.trim().toLowerCase();
        if (mimeType && !mimeType.startsWith("image/")) {
          throw new Error("Dropped content is not an image.");
        }
        const fileName = resolvedStoragePath
          ? buildProfileImageFileNameFromStoragePath(
              resolvedStoragePath,
              mimeType || "image/jpeg",
              normalizedSourceUrl || "element-profile"
            )
          : buildProfileImageFileName(
              normalizedSourceUrl || "element-profile",
              mimeType || "image/jpeg"
            );
        const file = new File([blob], fileName, {
          type: mimeType || "image/jpeg",
        });
        await saveProfileImageFile(file);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save element profile image."));
      } finally {
        setIsSavingProfileImage(false);
      }
    },
    [saveProfileImageFile]
  );

  const onSetProfileImageFromInternalDrop = React.useCallback(
    async (payload: InternalReferenceDragPayload) => {
      const referenceUrl =
        payload.referenceUrl?.trim() || payload.referenceRenderUrl?.trim() || null;
      const fallbackSource: ElementProfileImageDropSource | null =
        referenceUrl || payload.mediaId?.trim()
          ? {
              ...(referenceUrl ? { url: referenceUrl } : {}),
              mediaId: payload.mediaId?.trim() || null,
            }
          : null;

      if (!resolveProfileImageDropSource) {
        if (fallbackSource) {
          await onSetProfileImageFromUrl(fallbackSource);
        }
        return;
      }

      try {
        const resolvedSource = await resolveProfileImageDropSource(payload);
        if (resolvedSource) {
          await onSetProfileImageFromUrl({
            url:
              resolvedSource.preparedImageUrl?.trim() ||
              resolvedSource.preview.url?.trim() ||
              referenceUrl,
            mediaId: resolvedSource.mediaId?.trim() || payload.mediaId?.trim() || null,
            storagePath:
              resolvedSource.fullStoragePath?.trim() ||
              resolvedSource.previewStoragePath?.trim() ||
              null,
            loadBlob: resolvedSource.loadBlob,
          });
          return;
        }
      } catch (nextError) {
        if (!fallbackSource) {
          setError(toErrorMessage(nextError, "Failed to save element profile image."));
          return;
        }
      }

      if (fallbackSource) {
        await onSetProfileImageFromUrl(fallbackSource);
      }
    },
    [onSetProfileImageFromUrl, resolveProfileImageDropSource]
  );

  const onSaveProfileImageTransform = React.useCallback(
    async (transform: ElementDraft["profileImageTransform"]) => {
      const targetId = selectedElementIdRef.current;
      if (!targetId) return false;
      setError(null);
      try {
        const persistedTransform = await saveElementProfileImageAdjustments({
          elementId: targetId,
          transform,
        });
        setDraft((current) => {
          const nextDraft = {
            ...current,
            profileImageTransform: persistedTransform,
          };
          lastPersistedDraftRef.current = serializeDraftState(nextDraft);
          syncElementListEntryById(targetId, nextDraft);
          return nextDraft;
        });
        return true;
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to save element profile adjustments."));
        return false;
      }
    },
    [setDraft, syncElementListEntryById]
  );

  const onClearProfileImage = React.useCallback(async () => {
    const targetId = selectedElementIdRef.current;
    if (!targetId) return;
    setError(null);
    setIsSavingProfileImage(true);
    try {
      await clearElementProfileImage({
        elementId: targetId,
      });
      setDraft((current) => {
        const nextDraft = {
          ...current,
          profileImageUrl: null,
          profileImageTransform: createEmptyElementDraft().profileImageTransform,
        };
        lastPersistedDraftRef.current = serializeDraftState(nextDraft);
        syncElementListEntryById(targetId, nextDraft);
        return nextDraft;
      });
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to clear element profile image."));
    } finally {
      setIsSavingProfileImage(false);
    }
  }, [setDraft, syncElementListEntryById]);

  React.useEffect(() => {
    const targetId = selectedElementId;
    if (!targetId) return;
    const serializedDraft = serializeDraftState(draft);
    if (suppressNextPersistRef.current) {
      suppressNextPersistRef.current = false;
      lastPersistedDraftRef.current = serializedDraft;
      return;
    }
    if (serializedDraft === lastPersistedDraftRef.current) {
      return;
    }

    if (persistTimerRef.current) {
      window.clearTimeout(persistTimerRef.current);
    }
    persistTimerRef.current = window.setTimeout(() => {
      void saveElementManagerDraftSnapshot({
        elementId: targetId,
        name: draft.name,
        alias: draft.alias,
        profileImageTransform: draft.profileImageTransform,
        referenceSetState: {
          activeSetId: draft.activeReferenceSetId,
          tabOrder: draft.visibleReferenceSetIds,
          tabLabels: draft.referenceSetLabels,
          sets: draft.referenceSets,
        },
      })
        .then((result) => {
          lastPersistedDraftRef.current = serializedDraft;
          syncElementListEntryById(targetId, draft, {
            updatedAt: result.updatedAt,
            status: result.status,
          });
        })
        .catch((nextError) => {
          setError(toErrorMessage(nextError, "Failed to save element."));
        });
    }, 500);

    return () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, [draft, selectedElementId, syncElementListEntryById]);

  React.useEffect(
    () => () => {
      if (persistTimerRef.current) {
        window.clearTimeout(persistTimerRef.current);
      }
    },
    []
  );

  return {
    activeTab,
    elements,
    selectedElement,
    selectedElementId,
    pendingDeleteElementId,
    draft,
    error,
    loading,
    isCreatingElement,
    isDeletingElement,
    isSwitchingElement,
    isSavingProfileImage,
    setActiveTab,
    updateDraftField,
    updateActiveReferenceSet,
    onSetAssetType,
    setActiveReferenceSet,
    onAddReferenceSet,
    onRenameReferenceSet,
    onDeleteReferenceSet,
    assignActiveImageReferenceAtIndex,
    appendActiveDeckReference,
    removeActiveDeckReferenceAtIndex,
    clearActiveImageReferenceAtIndex,
    assignActiveVideoReference,
    clearActiveVideoReference,
    onSetProfileImageFile,
    onSetProfileImageFromUrl,
    onSetProfileImageFromInternalDrop,
    onSaveProfileImageTransform,
    onClearProfileImage,
    onCreateElement: () => {
      void handleCreateElement();
    },
    onSelectElement: (elementId: string) => {
      void handleSelectElement(elementId);
    },
    onRequestDeleteElement: setPendingDeleteElementId,
    onCancelDeleteElement: () => setPendingDeleteElementId(null),
    onConfirmDeleteElement: () => {
      void handleDeleteElement();
    },
  };
};
