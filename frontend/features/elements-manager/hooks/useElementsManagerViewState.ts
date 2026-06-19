/**
 * View-state controller for the Elements library panel.
 * Owns Elements panel state transitions while persisting element data to Supabase.
 */
import React from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  buildInternalPayloadFromComposerDropPayload,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
  type InternalReferenceDragPayload,
} from "../../../lib/internalReferenceDragPayload";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import type { AgentComposerDirectDropPayload } from "../../ai-studio/logic/agentComposerDirectDropPayload";
import { uploadImageBlobToStorage, uploadImageToStorage } from "../../ai-studio/utils/imageUpload";
import {
  extractDroppedFiles,
  resolveDroppedImageReference,
} from "../../character-manager/logic/characterDropPayload";
import { readMediaLibraryDragPayload } from "../../ai-studio/logic/mediaLibraryDragPayload";
import { createEmptyElementDraft } from "../constants";
import type { ElementDraft, ElementLibraryItem } from "../types";
import {
  deleteElementManagerDraft,
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
  saveElementManagerDraftSnapshot,
} from "../logic/elementsManagerPersistence";
import {
  deriveElementStatusFromDraft,
  hasRequiredElementMediaReferences,
  normalizeElementImageReferenceUrls,
} from "../logic/elementReadiness";

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

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

const SAVE_ELEMENT_REQUIRED_REFERENCES_MESSAGE =
  "Add the first two required references before saving the element.";
const SAVE_ELEMENT_REQUIRED_VIDEO_REFERENCE_MESSAGE =
  "Add the required motion reference before saving the element.";

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
  let loadBlobError: unknown = null;
  if (source.loadBlob) {
    try {
      return {
        blob: await source.loadBlob(),
        resolvedStoragePath: source.storagePath?.trim() || null,
      };
    } catch (error) {
      loadBlobError = error;
    }
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
    if (loadBlobError instanceof Error && loadBlobError.message.trim()) {
      throw loadBlobError;
    }
    throw new Error("Dropped image source could not be resolved.");
  }
  try {
    const response = await fetch(normalizedSourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to read profile image (${response.status}).`);
    }
    return {
      blob: await response.blob(),
      resolvedStoragePath: null,
    };
  } catch (error) {
    if (loadBlobError instanceof Error && loadBlobError.message.trim()) {
      throw loadBlobError;
    }
    throw error;
  }
};

const buildElementItemFromDraft = (
  draft: ElementDraft,
  options: {
    id: string;
    updatedAt?: string | null;
    status?: ElementLibraryItem["status"];
  }
): ElementLibraryItem => {
  return {
    id: options.id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    assetType: draft.assetType,
    profileImageUrl: draft.profileImageUrl,
    profileImageTransform: draft.profileImageTransform,
    imageReferenceUrls:
      draft.assetType === "image"
        ? normalizeElementImageReferenceUrls(draft.imageReferenceUrls)
        : [],
    videoReferenceUrl: draft.assetType === "video" ? draft.videoReferenceUrl.trim() || null : null,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    status: options.status ?? deriveElementStatusFromDraft(draft),
  };
};

const buildElementItemFromSnapshot = (
  snapshot: Awaited<ReturnType<typeof loadElementManagerDraftByElementId>>
): ElementLibraryItem =>
  buildElementItemFromDraft(
    {
      name: snapshot.name,
      description: snapshot.description,
      assetType: snapshot.assetType,
      profileImageUrl: snapshot.profileImageUrl,
      profileImageTransform: snapshot.profileImageTransform,
      imageReferenceUrls: snapshot.imageReferenceUrls,
      videoReferenceUrl: snapshot.videoReferenceUrl ?? "",
    },
    {
      id: snapshot.elementId,
      updatedAt: snapshot.updatedAt,
      status: snapshot.status,
    }
  );

const buildLibraryItemFromListRow = (
  row: Awaited<ReturnType<typeof fetchElementsManagerList>>[number]
): ElementLibraryItem => {
  return {
    id: row.elementId,
    name: row.elementName,
    description: "",
    assetType: row.elementAssetType,
    profileImageUrl: row.profileImageUrl,
    profileImageTransform: row.profileImageTransform,
    imageReferenceUrls: [],
    videoReferenceUrl: null,
    updatedAt: row.updatedAt,
    status: row.elementStatus,
  };
};

const buildDraftFromItem = (item: ElementLibraryItem): ElementDraft => ({
  name: item.name,
  description: item.description,
  assetType: item.assetType,
  profileImageUrl: item.profileImageUrl,
  profileImageTransform: item.profileImageTransform,
  imageReferenceUrls: item.imageReferenceUrls,
  videoReferenceUrl: item.videoReferenceUrl ?? "",
});

const serializeDraftState = (draft: ElementDraft): string =>
  JSON.stringify({
    name: draft.name,
    assetType: draft.assetType,
    profileImageUrl: draft.profileImageUrl,
    profileImageTransform: draft.profileImageTransform,
    description: draft.description,
    imageReferenceUrls: draft.imageReferenceUrls,
    videoReferenceUrl: draft.videoReferenceUrl,
  });

const hasRequiredReferencesForInitialSave = (draft: ElementDraft): boolean => {
  return hasRequiredElementMediaReferences({
    assetType: draft.assetType,
    imageReferenceUrls: draft.imageReferenceUrls,
    videoReferenceUrl: draft.videoReferenceUrl,
  });
};

const uploadElementReferenceBlob = async (blob: Blob): Promise<string> => {
  const normalizedMimeType = blob.type.trim().toLowerCase();
  if (normalizedMimeType && !normalizedMimeType.startsWith("image/")) {
    throw new Error("Dropped content is not an image.");
  }
  return await uploadImageBlobToStorage(blob);
};

type UseElementsManagerViewStateParams = {
  resolveProfileImageDropSource?: ResolveInternalReferenceDrop;
};

export const useElementsManagerViewState = ({
  resolveProfileImageDropSource,
}: UseElementsManagerViewStateParams = {}) => {
  const [elements, setElements] = React.useState<ElementLibraryItem[]>([]);
  const [selectedElementId, setSelectedElementId] = React.useState<string | null>(null);
  const [pendingDeleteElementId, setPendingDeleteElementId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isCreatingElement, setIsCreatingElement] = React.useState(false);
  const [isDeletingElement, setIsDeletingElement] = React.useState(false);
  const [isSwitchingElement, setIsSwitchingElement] = React.useState(false);
  const [isSavingElement, setIsSavingElement] = React.useState(false);
  const [draft, setDraft] = React.useState<ElementDraft>(createEmptyElementDraft);

  const hydrateDraft = React.useCallback((item: ElementLibraryItem | null) => {
    setDraft(item ? buildDraftFromItem(item) : createEmptyElementDraft());
  }, []);

  const resetDraft = React.useCallback(() => {
    setDraft(createEmptyElementDraft());
  }, []);

  const selectedElementIdRef = React.useRef<string | null>(null);
  const suppressNextPersistRef = React.useRef(false);
  const persistTimerRef = React.useRef<number | null>(null);
  const selectionRequestIdRef = React.useRef(0);
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
      const nextDraft = createEmptyElementDraft();
      suppressNextPersistRef.current = true;
      lastPersistedDraftRef.current = serializeDraftState(nextDraft);
      setPendingDeleteElementId(null);
      setSelectedElementId(null);
      resetDraft();
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to create a new element."));
    } finally {
      setIsCreatingElement(false);
    }
  }, [resetDraft]);

  const handleSaveElement = React.useCallback(async () => {
    const targetId = selectedElementIdRef.current;

    setError(null);
    setIsSavingElement(true);
    try {
      if (targetId) {
        const result = await saveElementManagerDraftSnapshot({
          elementId: targetId,
          name: draft.name,
          profileImageTransform: draft.profileImageTransform,
          description: draft.description,
          assetType: draft.assetType,
          imageReferenceUrls: draft.imageReferenceUrls,
          videoReferenceUrl: draft.videoReferenceUrl || null,
        });
        const serializedDraft = serializeDraftState(draft);
        suppressNextPersistRef.current = true;
        lastPersistedDraftRef.current = serializedDraft;
        if (persistTimerRef.current) {
          window.clearTimeout(persistTimerRef.current);
          persistTimerRef.current = null;
        }
        syncElementListEntryById(targetId, draft, {
          updatedAt: result.updatedAt,
          status: result.status,
        });
        setPendingDeleteElementId(null);
        return true;
      }

      if (!hasRequiredReferencesForInitialSave(draft)) {
        setError(
          draft.assetType === "video"
            ? SAVE_ELEMENT_REQUIRED_VIDEO_REFERENCE_MESSAGE
            : SAVE_ELEMENT_REQUIRED_REFERENCES_MESSAGE
        );
        return false;
      }

      const snapshot = await saveElementManagerDraft({
        name: draft.name,
        profileImageTransform: draft.profileImageTransform,
        description: draft.description,
        assetType: draft.assetType,
        imageReferenceUrls: draft.imageReferenceUrls,
        videoReferenceUrl: draft.videoReferenceUrl || null,
      });
      const nextItem = buildElementItemFromSnapshot(snapshot);
      const nextDraft = buildDraftFromItem(nextItem);
      suppressNextPersistRef.current = true;
      lastPersistedDraftRef.current = serializeDraftState(nextDraft);
      updateElementListEntry(nextItem);
      setPendingDeleteElementId(null);
      setSelectedElementId(snapshot.elementId);
      hydrateDraft(nextItem);
      return true;
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to save element."));
      return false;
    } finally {
      setIsSavingElement(false);
    }
  }, [draft, hydrateDraft, syncElementListEntryById, updateElementListEntry]);

  const handleSelectElement = React.useCallback(
    async (elementId: string) => {
      if (!elementId) return;
      if (elementId === selectedElementIdRef.current) {
        setPendingDeleteElementId(null);
        return;
      }
      setError(null);
      const requestId = selectionRequestIdRef.current + 1;
      selectionRequestIdRef.current = requestId;
      setIsSwitchingElement(true);
      try {
        const snapshot = await loadElementManagerDraftByElementId(elementId);
        if (selectionRequestIdRef.current !== requestId) return;
        const nextItem = buildElementItemFromSnapshot(snapshot);
        const nextDraft = buildDraftFromItem(nextItem);
        suppressNextPersistRef.current = true;
        lastPersistedDraftRef.current = serializeDraftState(nextDraft);
        updateElementListEntry(nextItem);
        setPendingDeleteElementId(null);
        setSelectedElementId(elementId);
        hydrateDraft(nextItem);
      } catch (nextError) {
        if (selectionRequestIdRef.current !== requestId) return;
        setError(toErrorMessage(nextError, "Failed to switch element."));
      } finally {
        if (selectionRequestIdRef.current === requestId) {
          setIsSwitchingElement(false);
        }
      }
    },
    [hydrateDraft, updateElementListEntry]
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
      }
      setPendingDeleteElementId(null);
    } catch (nextError) {
      setError(toErrorMessage(nextError, "Failed to delete element."));
    } finally {
      setIsDeletingElement(false);
    }
  }, [pendingDeleteElementId, resetDraft]);

  const assignActiveImageReferenceAtIndex = React.useCallback(
    (index: number, referenceUrl: string) => {
      const normalizedReferenceUrl = referenceUrl.trim();
      if (!normalizedReferenceUrl) return;
      setDraft((current) => {
        const nextImageReferenceUrls = [...current.imageReferenceUrls];
        while (nextImageReferenceUrls.length <= index) {
          nextImageReferenceUrls.push("");
        }
        nextImageReferenceUrls[index] = normalizedReferenceUrl;
        const nextDraft = {
          ...current,
          imageReferenceUrls: nextImageReferenceUrls.slice(0, 6),
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const clearActiveImageReferenceAtIndex = React.useCallback(
    (index: number) => {
      setDraft((current) => {
        const nextImageReferenceUrls = [...current.imageReferenceUrls];
        if (index >= nextImageReferenceUrls.length) return current;
        nextImageReferenceUrls[index] = "";
        const nextDraft = {
          ...current,
          imageReferenceUrls: nextImageReferenceUrls,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const assignActiveVideoReference = React.useCallback(
    (referenceUrl: string) => {
      const normalizedReferenceUrl = referenceUrl.trim();
      setDraft((current) => {
        const nextDraft = {
          ...current,
          videoReferenceUrl: normalizedReferenceUrl,
        };
        syncSelectedElement(nextDraft);
        return nextDraft;
      });
    },
    [setDraft, syncSelectedElement]
  );

  const clearActiveVideoReference = React.useCallback(() => {
    setDraft((current) => {
      if (!current.videoReferenceUrl.trim()) return current;
      const nextDraft = {
        ...current,
        videoReferenceUrl: "",
      };
      syncSelectedElement(nextDraft);
      return nextDraft;
    });
  }, [setDraft, syncSelectedElement]);

  const onSetImageReferenceFromUrlAtIndex = React.useCallback(
    async (index: number, source: string | ElementProfileImageDropSource) => {
      const normalizedSource: ElementProfileImageDropSource =
        typeof source === "string" ? { url: source.trim() } : source;
      const normalizedSourceUrl = normalizedSource.url?.trim() ?? "";
      if (!normalizedSourceUrl && !normalizedSource.loadBlob) return;
      setError(null);
      try {
        let resolvedReferenceUrl = normalizedSourceUrl;
        if (normalizedSource.loadBlob) {
          const { blob } = await downloadDroppedProfileImageBlob({
            ...normalizedSource,
            url: normalizedSourceUrl,
          });
          resolvedReferenceUrl = await uploadElementReferenceBlob(blob);
        } else if (
          normalizedSourceUrl.startsWith("blob:") ||
          normalizedSourceUrl.startsWith("data:image/")
        ) {
          resolvedReferenceUrl = await uploadImageToStorage(normalizedSourceUrl);
        }
        assignActiveImageReferenceAtIndex(index, resolvedReferenceUrl);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to add element reference."));
      }
    },
    [assignActiveImageReferenceAtIndex]
  );

  const onSetImageReferenceFileAtIndex = React.useCallback(
    async (index: number, file: File) => {
      if (!file.type.startsWith("image/")) {
        setError("Dropped content is not an image.");
        return;
      }
      setError(null);
      try {
        const uploadedReferenceUrl = await uploadImageBlobToStorage(file);
        assignActiveImageReferenceAtIndex(index, uploadedReferenceUrl);
      } catch (nextError) {
        setError(toErrorMessage(nextError, "Failed to add element reference."));
      }
    },
    [assignActiveImageReferenceAtIndex]
  );

  const onSetImageReferenceFromInternalDropAtIndex = React.useCallback(
    async (index: number, payload: InternalReferenceDragPayload) => {
      const referenceUrl =
        payload.referenceUrl?.trim() || payload.referenceRenderUrl?.trim() || null;
      const fallbackSource: ElementProfileImageDropSource | null =
        referenceUrl || payload.mediaId?.trim() || payload.fullStoragePath?.trim()
          ? {
              ...(referenceUrl ? { url: referenceUrl } : {}),
              mediaId: payload.mediaId?.trim() || null,
              storagePath:
                payload.fullStoragePath?.trim() || payload.previewStoragePath?.trim() || null,
            }
          : null;

      if (!resolveProfileImageDropSource) {
        if (fallbackSource) {
          await onSetImageReferenceFromUrlAtIndex(index, fallbackSource);
        }
        return;
      }

      try {
        const resolvedSource = await resolveProfileImageDropSource(payload);
        if (resolvedSource) {
          await onSetImageReferenceFromUrlAtIndex(index, {
            url:
              resolvedSource.preparedImageUrl?.trim() ||
              resolvedSource.preview.url?.trim() ||
              referenceUrl,
            mediaId: resolvedSource.mediaId?.trim() || payload.mediaId?.trim() || null,
            storagePath:
              resolvedSource.fullStoragePath?.trim() ||
              resolvedSource.previewStoragePath?.trim() ||
              payload.fullStoragePath?.trim() ||
              payload.previewStoragePath?.trim() ||
              null,
            loadBlob: resolvedSource.loadBlob,
          });
          return;
        }
      } catch (nextError) {
        if (!fallbackSource) {
          setError(toErrorMessage(nextError, "Failed to add element reference."));
          return;
        }
      }

      if (fallbackSource) {
        await onSetImageReferenceFromUrlAtIndex(index, fallbackSource);
      }
    },
    [onSetImageReferenceFromUrlAtIndex, resolveProfileImageDropSource]
  );

  const onHandleImageReferenceTransferAtIndex = React.useCallback(
    async (index: number, transfer: DataTransfer) => {
      const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
      if (
        mediaLibraryPayload?.kind === "libraryMedia" &&
        mediaLibraryPayload.payload.fileType === "image"
      ) {
        await onSetImageReferenceFromUrlAtIndex(index, {
          url:
            mediaLibraryPayload.payload.fullUrl?.trim() ||
            mediaLibraryPayload.payload.url?.trim() ||
            mediaLibraryPayload.payload.previewUrl?.trim() ||
            "",
          mediaId: mediaLibraryPayload.payload.id,
          storagePath:
            mediaLibraryPayload.payload.fullStoragePath ??
            mediaLibraryPayload.payload.previewStoragePath ??
            null,
        });
        return;
      }

      const internalPayload = extractInternalReferenceDragPayload(transfer);
      if (internalPayload) {
        await onSetImageReferenceFromInternalDropAtIndex(index, internalPayload);
        return;
      }

      const composerPayload = extractComposerImageDropPayload(transfer);
      if (composerPayload) {
        const normalizedInternalPayload =
          buildInternalPayloadFromComposerDropPayload(composerPayload);
        if (normalizedInternalPayload) {
          await onSetImageReferenceFromInternalDropAtIndex(index, normalizedInternalPayload);
          return;
        }
      }

      const hasInternalReferenceHints = hasInternalReferenceDragTypeHints(transfer);
      const droppedReference = resolveDroppedImageReference(transfer);
      if (hasInternalReferenceHints) {
        if (droppedReference) {
          await onSetImageReferenceFromUrlAtIndex(index, {
            url: droppedReference.url,
            mediaId: droppedReference.characterMediaId,
            storagePath: droppedReference.storagePath ?? null,
          });
        }
        return;
      }

      const droppedFile = extractDroppedFiles(transfer).find((file) =>
        file.type.startsWith("image/")
      );
      if (droppedFile) {
        await onSetImageReferenceFileAtIndex(index, droppedFile);
        return;
      }

      if (droppedReference) {
        await onSetImageReferenceFromUrlAtIndex(index, {
          url: droppedReference.url,
          mediaId: droppedReference.characterMediaId,
          storagePath: droppedReference.storagePath ?? null,
        });
      }
    },
    [
      onSetImageReferenceFileAtIndex,
      onSetImageReferenceFromInternalDropAtIndex,
      onSetImageReferenceFromUrlAtIndex,
    ]
  );

  const onHandleCanvasTearOutImageReferenceAtIndex = React.useCallback(
    async (index: number, payload: AgentComposerDirectDropPayload): Promise<boolean> => {
      if (payload.kind !== "image") return false;
      if (payload.internalPayload) {
        await onSetImageReferenceFromInternalDropAtIndex(index, payload.internalPayload);
        return true;
      }

      if (payload.composerImagePayload) {
        const normalizedInternalPayload = buildInternalPayloadFromComposerDropPayload(
          payload.composerImagePayload
        );
        if (normalizedInternalPayload) {
          await onSetImageReferenceFromInternalDropAtIndex(index, normalizedInternalPayload);
          return true;
        }
      }

      return false;
    },
    [onSetImageReferenceFromInternalDropAtIndex]
  );

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
        profileImageTransform: draft.profileImageTransform,
        description: draft.description,
        assetType: draft.assetType,
        imageReferenceUrls: draft.imageReferenceUrls,
        videoReferenceUrl: draft.videoReferenceUrl || null,
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
    elements,
    selectedElementId,
    pendingDeleteElementId,
    draft,
    error,
    loading,
    isCreatingElement,
    isDeletingElement,
    isSwitchingElement,
    isSavingElement,
    updateDraftField,
    onHandleImageReferenceTransferAtIndex,
    onHandleCanvasTearOutImageReferenceAtIndex,
    clearActiveImageReferenceAtIndex,
    assignActiveVideoReference,
    clearActiveVideoReference,
    onCreateElement: () => {
      void handleCreateElement();
    },
    onSaveElement: handleSaveElement,
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
