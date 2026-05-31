/**
 * View-state controller for the Elements library panel.
 * Owns Elements panel state transitions while persisting element data to Supabase.
 */
import React from "react";
import { maybePreprocessLocalImageFileForUpload } from "../../../lib/adaptive-media/localTranscode";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import {
  buildInternalPayloadFromComposerDropPayload,
  extractComposerImageDropPayload,
  extractInternalReferenceDragPayload,
  hasInternalReferenceDragTypeHints,
  type InternalReferenceDragPayload,
} from "../../../lib/internalReferenceDragPayload";
import type { ResolveInternalReferenceDrop } from "../../ai-studio/logic/referenceSource/internalReferenceSource";
import { uploadImageBlobToStorage, uploadImageToStorage } from "../../ai-studio/utils/imageUpload";
import {
  extractDroppedFiles,
  resolveDroppedImageReference,
} from "../../character-manager/logic/characterDropPayload";
import { readMediaLibraryDragPayload } from "../../ai-studio/logic/mediaLibraryDragPayload";
import { createEmptyElementDraft } from "../constants";
import type { ElementAssetType, ElementDraft, ElementLibraryItem } from "../types";
import {
  clearElementProfileImage,
  deleteElementManagerDraft,
  fetchElementsManagerList,
  loadElementManagerDraftByElementId,
  saveElementManagerDraft,
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

const toErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length ? error.message : fallback;

const SAVE_ELEMENT_FIRST_MESSAGE = "Save the element before adding a profile photo or references.";
const SAVE_ELEMENT_REQUIRED_REFERENCES_MESSAGE =
  "Add the first two required references before saving the element.";
const SAVE_ELEMENT_REQUIRED_VIDEO_REFERENCE_MESSAGE =
  "Add the required motion reference before saving the element.";
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
  return {
    id: options.id,
    name: draft.name.trim(),
    description: draft.description.trim(),
    assetType: draft.assetType,
    profileImageUrl: draft.profileImageUrl,
    profileImageTransform: draft.profileImageTransform,
    thumbnailUrl: draft.profileImageUrl,
    imageReferenceUrls:
      draft.assetType === "image" ? draft.imageReferenceUrls.filter(Boolean).slice(0, 6) : [],
    videoReferenceUrl: draft.assetType === "video" ? draft.videoReferenceUrl.trim() || null : null,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    status: options.status ?? "ready",
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
    thumbnailUrl: row.profileImageUrl,
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
  if (draft.assetType === "video") {
    return Boolean(draft.videoReferenceUrl.trim());
  }
  return Boolean(draft.imageReferenceUrls[0]?.trim() && draft.imageReferenceUrls[1]?.trim());
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
  const [isEditorOpen, setIsEditorOpen] = React.useState(false);
  const [editorMode, setEditorMode] = React.useState<"create" | "edit">("edit");
  const [pendingDiscardDraft, setPendingDiscardDraft] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isCreatingElement, setIsCreatingElement] = React.useState(false);
  const [isDeletingElement, setIsDeletingElement] = React.useState(false);
  const [isSwitchingElement, setIsSwitchingElement] = React.useState(false);
  const [isSavingElement, setIsSavingElement] = React.useState(false);
  const [isSavingProfileImage, setIsSavingProfileImage] = React.useState(false);
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
  const hasUnsavedElementDraft = selectedElementId === null;
  const isDraftDirty =
    serializeDraftState(draft) !== lastPersistedDraftRef.current &&
    serializeDraftState(draft) !== serializeDraftState(createEmptyElementDraft());

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
      setEditorMode("create");
      setPendingDiscardDraft(false);
      setIsEditorOpen(true);
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
      setEditorMode("edit");
      setPendingDiscardDraft(false);
      setIsEditorOpen(true);
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
        setEditorMode("edit");
        setPendingDiscardDraft(false);
        setIsEditorOpen(true);
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
        setEditorMode("edit");
        setPendingDiscardDraft(false);
        setIsEditorOpen(true);
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
        setPendingDiscardDraft(false);
        setIsEditorOpen(false);
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

  const onSetAssetType = React.useCallback(
    (assetType: ElementAssetType) => {
      setDraft((current) => {
        if (current.assetType === assetType) return current;
        const nextDraft = {
          ...current,
          assetType,
          imageReferenceUrls: assetType === "image" ? current.imageReferenceUrls : [],
          videoReferenceUrl: assetType === "video" ? current.videoReferenceUrl : "",
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

  const saveProfileImageFile = React.useCallback(
    async (profileFile: File) => {
      const targetId = selectedElementIdRef.current;
      if (!targetId) {
        setError(SAVE_ELEMENT_FIRST_MESSAGE);
        return;
      }
      const preparedFile = await maybePreprocessLocalImageFileForUpload(profileFile);
      setError(null);
      setIsSavingProfileImage(true);
      try {
        const result = await uploadElementProfileImage({
          elementId: targetId,
          file: preparedFile,
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
      if (!targetId) {
        setError(SAVE_ELEMENT_FIRST_MESSAGE);
        return;
      }
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

  const onSaveProfileImageTransform = React.useCallback(
    async (transform: ElementDraft["profileImageTransform"]) => {
      const targetId = selectedElementIdRef.current;
      if (!targetId) {
        setError(SAVE_ELEMENT_FIRST_MESSAGE);
        return false;
      }
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
    if (!targetId) {
      setError(SAVE_ELEMENT_FIRST_MESSAGE);
      return;
    }
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

  const closeEditor = React.useCallback(() => {
    setPendingDiscardDraft(false);
    setIsEditorOpen(false);
    setError(null);
    if (selectedElementIdRef.current === null) {
      resetDraft();
      lastPersistedDraftRef.current = serializeDraftState(createEmptyElementDraft());
    }
  }, [resetDraft]);

  const requestCloseEditor = React.useCallback(() => {
    if (selectedElementIdRef.current === null && isDraftDirty) {
      setPendingDiscardDraft(true);
      return;
    }
    closeEditor();
  }, [closeEditor, isDraftDirty]);

  return {
    elements,
    selectedElementId,
    pendingDeleteElementId,
    isEditorOpen,
    editorMode,
    pendingDiscardDraft,
    draft,
    error,
    loading,
    isCreatingElement,
    isDeletingElement,
    isSwitchingElement,
    isSavingElement,
    isSavingProfileImage,
    hasUnsavedElementDraft,
    updateDraftField,
    onSetAssetType,
    assignActiveImageReferenceAtIndex,
    onHandleImageReferenceTransferAtIndex,
    clearActiveImageReferenceAtIndex,
    assignActiveVideoReference,
    clearActiveVideoReference,
    onSetProfileImageFile,
    onSetProfileImageFromUrl,
    onSetProfileImageFromInternalDrop,
    onSaveProfileImageTransform,
    onClearProfileImage,
    onRequestCloseEditor: requestCloseEditor,
    onCancelCloseEditor: () => setPendingDiscardDraft(false),
    onConfirmCloseEditor: closeEditor,
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
    reportSaveElementRequired: () => setError(SAVE_ELEMENT_FIRST_MESSAGE),
  };
};
