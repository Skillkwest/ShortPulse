/**
 * Renders the Media Library custom-folder canvas and syncs canvas membership with folder membership.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { CanvasPropertiesPanel } from "./canvas/CanvasPropertiesPanel";
import { CANVAS_DEFAULT_CAMERA } from "./canvas/canvasGeometry";
import { useAiStudioDualCanvasWorkspaceState } from "./canvas/useAiStudioCanvasWorkspaceState";
import type {
  CanvasCamera,
  PrepareResolvedInternalCanvasDrop,
  CanvasSceneItem,
  ResolveCanvasDropReference,
} from "./canvas/canvasTypes";
import {
  getMediaFolderCanvasState,
  saveMediaFolderCanvasState,
} from "../logic/mediaLibraryPanelApi";
import { toMediaLibraryErrorText } from "../logic/mediaLibraryErrorText";
import {
  buildMediaFolderCanvasSnapshot,
  buildSeedItemsForFolderCanvas,
  getPromptIdFromCanvasOutputId,
  isFolderCanvasMembershipItemId,
  MEDIA_FOLDER_CANVAS_SCHEMA_VERSION,
  parseMediaFolderCanvasSnapshot,
  reconcileFolderMembershipCanvasItems,
} from "../logic/mediaFolderCanvasSnapshot";
import {
  BUCKET,
  isAudioFile,
  isVideoFile,
  resolveMediaMetadataPromptText,
  type MediaFileRow,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import { resolveMediaDragDimensions } from "../logic/mediaLibraryAspectRatio";
import { writeMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

type ResolvedInternalDropItem = {
  kind: "media" | "prompt";
  id: string;
} | null;

type MediaLibraryFolderCanvasProps = {
  projectId?: string | null;
  folderId: string;
  mediaRows: MediaFileRow[];
  promptRows: PromptRow[];
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video" | "audio";
    filename?: string | null;
    promptText?: string | null;
    transcriptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    fullUrl?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
  onUnassignItem: (item: { kind: "media" | "prompt"; id: string }) => Promise<void>;
  onAssignDroppedItem?: (item: { kind: "media" | "prompt"; id: string }) => Promise<boolean>;
  onDropFilesToCanvas?: (files: FileList) => Promise<MediaFileRow[]>;
  resolveInternalDropItem?: (
    payload: InternalReferenceDragPayload
  ) => Promise<ResolvedInternalDropItem>;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
};

const SAVE_DEBOUNCE_MS = 450;

export function MediaLibraryFolderCanvas({
  projectId = null,
  folderId,
  mediaRows,
  promptRows,
  onSelectMedia,
  onSelectPrompt,
  onUnassignItem,
  onAssignDroppedItem,
  onDropFilesToCanvas,
  resolveInternalDropItem,
  resolveCanvasDropReference,
}: MediaLibraryFolderCanvasProps) {
  const [loadingState, setLoadingState] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingUnassignMembershipItemIds, setPendingUnassignMembershipItemIds] = useState<
    string[]
  >([]);
  const [pendingAssignedMediaRows, setPendingAssignedMediaRows] = useState<MediaFileRow[]>([]);
  const [fullQualityUrlByMediaId, setFullQualityUrlByMediaId] = useState<Record<string, string>>(
    {}
  );

  const suppressRemovalSyncRef = useRef(false);
  const loadedFolderIdRef = useRef<string | null>(null);
  const lastSavedPayloadRef = useRef<string>("");
  const mediaRowsRef = useRef(mediaRows);
  const promptRowsRef = useRef(promptRows);
  const pendingUnassignMembershipItemSet = useMemo(
    () => new Set(pendingUnassignMembershipItemIds),
    [pendingUnassignMembershipItemIds]
  );

  const canvasMediaRows = useMemo(() => {
    if (!Object.keys(fullQualityUrlByMediaId).length) return mediaRows;
    return mediaRows.map((row) => {
      const fullQualityUrl = fullQualityUrlByMediaId[row.id];
      if (!fullQualityUrl || fullQualityUrl === row.signedUrl) return row;
      return {
        ...row,
        signedUrl: fullQualityUrl,
      };
    });
  }, [fullQualityUrlByMediaId, mediaRows]);
  const mediaById = useMemo(
    () => new Map(canvasMediaRows.map((row) => [row.id, row])),
    [canvasMediaRows]
  );
  const promptById = useMemo(() => new Map(promptRows.map((row) => [row.id, row])), [promptRows]);
  const reconciledMediaRows = useMemo(() => {
    const baseRows =
      pendingUnassignMembershipItemSet.size === 0
        ? canvasMediaRows
        : canvasMediaRows.filter((row) => !pendingUnassignMembershipItemSet.has(`media:${row.id}`));
    if (pendingAssignedMediaRows.length === 0) return baseRows;
    const rowsById = new Map(baseRows.map((row) => [row.id, row]));
    pendingAssignedMediaRows.forEach((row) => {
      if (!rowsById.has(row.id)) {
        rowsById.set(row.id, row);
      }
    });
    return Array.from(rowsById.values());
  }, [canvasMediaRows, pendingAssignedMediaRows, pendingUnassignMembershipItemSet]);
  const reconciledPromptRows = useMemo(() => {
    if (pendingUnassignMembershipItemSet.size === 0) return promptRows;
    return promptRows.filter((row) => !pendingUnassignMembershipItemSet.has(`prompt:${row.id}`));
  }, [pendingUnassignMembershipItemSet, promptRows]);

  const addPendingUnassignMembershipItemId = useCallback((itemId: string) => {
    setPendingUnassignMembershipItemIds((previous) => {
      if (previous.includes(itemId)) return previous;
      return [...previous, itemId];
    });
  }, []);

  const removePendingUnassignMembershipItemId = useCallback((itemId: string) => {
    setPendingUnassignMembershipItemIds((previous) => {
      if (!previous.includes(itemId)) return previous;
      const next = previous.filter((candidate) => candidate !== itemId);
      return next.length === previous.length ? previous : next;
    });
  }, []);

  const addPendingAssignedMediaRow = useCallback(
    (item: { mediaId: string; src: string; alt: string }) => {
      const mediaId = item.mediaId.trim();
      const src = item.src.trim();
      if (!mediaId || !src) return;
      setPendingAssignedMediaRows((previous) => {
        if (previous.some((row) => row.id === mediaId)) return previous;
        return [
          ...previous,
          {
            id: mediaId,
            filename: item.alt.trim() || "Canvas media",
            storage_path: "",
            file_type: "image/*",
            signedUrl: src,
          },
        ];
      });
    },
    []
  );

  const addPendingAssignedMediaRows = useCallback((rows: MediaFileRow[]) => {
    if (!rows.length) return;
    setPendingAssignedMediaRows((previous) => {
      const rowsById = new Map(previous.map((row) => [row.id, row]));
      rows.forEach((row) => {
        rowsById.set(row.id, row);
      });
      return Array.from(rowsById.values());
    });
  }, []);

  const prepareResolvedInternalCanvasDrop = useCallback<PrepareResolvedInternalCanvasDrop>(
    async (payload, resolved) => {
      if (resolved.kind !== "image") return resolved;
      const resolvedMediaId = resolved.mediaId?.trim() ?? "";
      let mediaId = resolvedMediaId;
      if (!mediaId) {
        if (!resolveInternalDropItem) {
          return resolved;
        }
        let resolvedItem: ResolvedInternalDropItem = null;
        try {
          resolvedItem = await resolveInternalDropItem(payload);
        } catch {
          setSaveError("Unable to resolve dropped reference.");
          return null;
        }
        if (!resolvedItem || resolvedItem.kind !== "media") {
          setSaveError("Unable to resolve dropped reference.");
          return null;
        }
        mediaId = resolvedItem.id.trim();
      }
      if (!mediaId) return resolved;
      if (onAssignDroppedItem) {
        const assigned = await onAssignDroppedItem({ kind: "media", id: mediaId });
        if (!assigned) return null;
        addPendingAssignedMediaRow({
          mediaId,
          src: resolved.src,
          alt: resolved.alt,
        });
      }
      setSaveError(null);
      return {
        ...resolved,
        mediaId,
      };
    },
    [addPendingAssignedMediaRow, onAssignDroppedItem, resolveInternalDropItem]
  );

  const resolveCanvasDropFiles = useCallback(
    async (files: FileList) => {
      if (!onDropFilesToCanvas) return null;
      let uploadedRows: MediaFileRow[] = [];
      try {
        uploadedRows = await onDropFilesToCanvas(files);
      } catch (uploadError) {
        setSaveError(toMediaLibraryErrorText(uploadError, "Unable to process dropped files."));
        return null;
      }

      const imageRows = uploadedRows.filter((row) => !isVideoFile(row.file_type));
      if (!imageRows.length) {
        setSaveError("Only image files can be dropped onto this canvas.");
        return null;
      }

      addPendingAssignedMediaRows(imageRows);
      setSaveError(null);
      return imageRows
        .map((row) => {
          const src = (row.signedUrl ?? "").trim();
          if (!src) return null;
          const dragDimensions = resolveMediaDragDimensions({
            fileType: row.file_type,
            width: row.width ?? null,
            height: row.height ?? null,
            metadata: row.metadata ?? null,
          });
          return {
            kind: "image" as const,
            outputId: null,
            mediaId: row.id,
            src,
            alt: (row.filename || "Canvas media").trim(),
            width: dragDimensions.width,
            height: dragDimensions.height,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
    },
    [addPendingAssignedMediaRows, onDropFilesToCanvas]
  );

  const workspace = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    resolveCanvasDropFiles,
    onPinTextReference: (text) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      onSelectPrompt({
        id: `folder-canvas-pin:${folderId}:${crypto.randomUUID()}`,
        promptText: trimmed,
        title: null,
      });
    },
  });

  const items = workspace.sessionState.items;
  const mainCanvasProps = workspace.mainCanvasProps;
  const isTextResizeActive = Boolean(mainCanvasProps.isTextResizeActive);
  const hydrateSessionState = workspace.hydrateSessionState;
  const previousItemsRef = useRef(workspace.sessionState.items);

  useEffect(() => {
    setFullQualityUrlByMediaId({});
  }, [folderId]);

  useEffect(() => {
    const currentIds = new Set(mediaRows.map((row) => row.id));
    setFullQualityUrlByMediaId((previous) => {
      const entries = Object.entries(previous).filter(([id]) => currentIds.has(id));
      if (entries.length === Object.keys(previous).length) return previous;
      return Object.fromEntries(entries);
    });
  }, [mediaRows]);

  useEffect(() => {
    let cancelled = false;
    const rowsToResolve = mediaRows.filter((row) => {
      if (isVideoFile(row.file_type)) return false;
      const storagePath = row.storage_path?.trim() ?? "";
      if (!storagePath) return false;
      return !fullQualityUrlByMediaId[row.id];
    });
    if (!rowsToResolve.length) return;

    void Promise.all(
      rowsToResolve.map(async (row) => {
        const storagePath = row.storage_path?.trim() ?? "";
        if (!storagePath) return null;
        const signedUrl = await getSignedMediaUrl({
          bucket: BUCKET,
          storagePath,
          previewProfile: "none",
        });
        const normalizedUrl = signedUrl?.trim() ?? "";
        if (!normalizedUrl) return null;
        return [row.id, normalizedUrl] as const;
      })
    ).then((resolvedEntries) => {
      if (cancelled) return;
      const updates = resolvedEntries.filter((entry): entry is readonly [string, string] =>
        Array.isArray(entry)
      );
      if (!updates.length) return;
      setFullQualityUrlByMediaId((previous) => {
        let changed = false;
        const next: Record<string, string> = { ...previous };
        updates.forEach(([mediaId, url]) => {
          if (next[mediaId] === url) return;
          next[mediaId] = url;
          changed = true;
        });
        return changed ? next : previous;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [fullQualityUrlByMediaId, mediaRows]);

  useEffect(() => {
    mediaRowsRef.current = canvasMediaRows;
    if (!canvasMediaRows.length) return;
    setPendingAssignedMediaRows((previous) => {
      if (!previous.length) return previous;
      const mediaIds = new Set(canvasMediaRows.map((row) => row.id));
      const next = previous.filter((row) => !mediaIds.has(row.id));
      return next.length === previous.length ? previous : next;
    });
  }, [canvasMediaRows]);

  useEffect(() => {
    promptRowsRef.current = promptRows;
  }, [promptRows]);

  useEffect(() => {
    setPendingAssignedMediaRows([]);
  }, [folderId]);

  const hydrateFolderCanvasState = useCallback(
    ({ nextItems, nextCamera }: { nextItems: CanvasSceneItem[]; nextCamera?: CanvasCamera }) => {
      suppressRemovalSyncRef.current = true;
      hydrateSessionState({
        items: nextItems,
        draftTextEntry: null,
        textEditSession: null,
        draftOwnerInstanceId: null,
        textEditOwnerInstanceId: null,
        mainCamera: nextCamera ?? CANVAS_DEFAULT_CAMERA,
        railCamera: CANVAS_DEFAULT_CAMERA,
      });
      queueMicrotask(() => {
        suppressRemovalSyncRef.current = false;
      });
    },
    [hydrateSessionState]
  );

  useEffect(() => {
    let cancelled = false;
    const loadFolderCanvas = async () => {
      setLoadingState(true);
      setError(null);
      setSaveError(null);
      setPendingUnassignMembershipItemIds([]);
      lastSavedPayloadRef.current = "";

      try {
        const state = await getMediaFolderCanvasState(folderId, projectId);
        if (cancelled) return;
        loadedFolderIdRef.current = folderId;
        const parsed = parseMediaFolderCanvasSnapshot(state?.snapshot ?? null);
        if (parsed) {
          hydrateFolderCanvasState({ nextItems: parsed.items, nextCamera: parsed.camera });
          return;
        }
        const seededItems = buildSeedItemsForFolderCanvas({
          mediaRows: mediaRowsRef.current,
          promptRows: promptRowsRef.current,
        });
        hydrateFolderCanvasState({
          nextItems: seededItems,
          nextCamera: CANVAS_DEFAULT_CAMERA,
        });
      } catch (loadError) {
        if (cancelled) return;
        setError(toMediaLibraryErrorText(loadError, "Unable to load folder canvas."));
        loadedFolderIdRef.current = folderId;
        const seededItems = buildSeedItemsForFolderCanvas({
          mediaRows: mediaRowsRef.current,
          promptRows: promptRowsRef.current,
        });
        hydrateFolderCanvasState({ nextItems: seededItems, nextCamera: CANVAS_DEFAULT_CAMERA });
      } finally {
        if (!cancelled) {
          setLoadingState(false);
        }
      }
    };

    void loadFolderCanvas();

    return () => {
      cancelled = true;
    };
  }, [folderId, hydrateFolderCanvasState, projectId]);

  useEffect(() => {
    const remainingMediaItemIds = new Set(mediaRows.map((row) => `media:${row.id}`));
    const remainingPromptItemIds = new Set(promptRows.map((row) => `prompt:${row.id}`));
    setPendingUnassignMembershipItemIds((previous) => {
      if (previous.length === 0) return previous;
      const next = previous.filter((itemId) => {
        if (itemId.startsWith("media:")) {
          return remainingMediaItemIds.has(itemId);
        }
        if (itemId.startsWith("prompt:")) {
          return remainingPromptItemIds.has(itemId);
        }
        return false;
      });
      return next.length === previous.length ? previous : next;
    });
  }, [mediaRows, promptRows]);

  useEffect(() => {
    if (isTextResizeActive) return;
    if (loadingState) return;
    if (loadedFolderIdRef.current !== folderId) return;
    const previousItems = previousItemsRef.current;
    if (previousItems.length > items.length) {
      const currentItemIds = new Set(items.map((item) => item.id));
      const removedMembershipItemExists = previousItems.some(
        (item) => !currentItemIds.has(item.id) && isFolderCanvasMembershipItemId(item.id)
      );
      if (removedMembershipItemExists) {
        return;
      }
    }
    const reconciledItems = reconcileFolderMembershipCanvasItems({
      items,
      mediaRows: reconciledMediaRows,
      promptRows: reconciledPromptRows,
    });
    if (reconciledItems.length === items.length) {
      let changed = false;
      for (let index = 0; index < reconciledItems.length; index += 1) {
        const left = reconciledItems[index];
        const right = items[index];
        if (!right || left.id !== right.id || left.kind !== right.kind) {
          changed = true;
          break;
        }
        if (left.kind === "image" && right.kind === "image") {
          if (left.src !== right.src || left.alt !== right.alt || left.mediaId !== right.mediaId) {
            changed = true;
            break;
          }
        }
        if (left.kind === "text" && right.kind === "text") {
          if (left.text !== right.text || left.outputId !== right.outputId) {
            changed = true;
            break;
          }
        }
      }
      if (!changed) return;
    }
    hydrateFolderCanvasState({
      nextItems: reconciledItems,
      nextCamera: workspace.sessionState.mainCamera,
    });
  }, [
    folderId,
    hydrateFolderCanvasState,
    isTextResizeActive,
    items,
    loadingState,
    reconciledMediaRows,
    reconciledPromptRows,
    workspace.sessionState.mainCamera,
  ]);

  useEffect(() => {
    if (loadingState || suppressRemovalSyncRef.current) {
      previousItemsRef.current = items;
      return;
    }
    const previous = previousItemsRef.current;
    previousItemsRef.current = items;
    if (previous.length <= items.length) return;

    const currentIds = new Set(items.map((item) => item.id));
    previous.forEach((item) => {
      if (currentIds.has(item.id)) return;
      if (!isFolderCanvasMembershipItemId(item.id)) return;
      if (item.kind === "image" && item.mediaId) {
        addPendingUnassignMembershipItemId(item.id);
        void onUnassignItem({ kind: "media", id: item.mediaId }).catch(() => {
          removePendingUnassignMembershipItemId(item.id);
        });
        return;
      }
      if (item.kind === "text") {
        const promptId = getPromptIdFromCanvasOutputId(item.outputId);
        if (promptId) {
          addPendingUnassignMembershipItemId(item.id);
          void onUnassignItem({ kind: "prompt", id: promptId }).catch(() => {
            removePendingUnassignMembershipItemId(item.id);
          });
        }
      }
    });
  }, [
    addPendingUnassignMembershipItemId,
    items,
    loadingState,
    onUnassignItem,
    removePendingUnassignMembershipItemId,
  ]);

  useEffect(() => {
    if (isTextResizeActive) return;
    if (loadingState) return;
    if (loadedFolderIdRef.current !== folderId) return;
    const payload = JSON.stringify({
      folderId,
      camera: workspace.sessionState.mainCamera,
      items: workspace.sessionState.items,
    });
    if (payload === lastSavedPayloadRef.current) return;

    const timeoutId = window.setTimeout(() => {
      const snapshot = buildMediaFolderCanvasSnapshot({
        camera: workspace.sessionState.mainCamera,
        items: workspace.sessionState.items,
      });
      void saveMediaFolderCanvasState({
        folderId,
        schemaVersion: MEDIA_FOLDER_CANVAS_SCHEMA_VERSION,
        snapshot,
        projectId,
      })
        .then(() => {
          lastSavedPayloadRef.current = payload;
          setSaveError(null);
        })
        .catch((saveStateError) => {
          setSaveError(
            toMediaLibraryErrorText(saveStateError, "Unable to save folder canvas state.")
          );
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    folderId,
    isTextResizeActive,
    loadingState,
    projectId,
    workspace.sessionState.items,
    workspace.sessionState.mainCamera,
  ]);

  const handleItemContextMenu = useCallback(
    (itemId: string, event: React.MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const item = workspace.sessionState.items.find((candidate) => candidate.id === itemId);
      if (!item) return;
      if (item.kind === "image") {
        const mediaId = item.mediaId?.trim() || item.id;
        const mediaRow = item.mediaId ? mediaById.get(item.mediaId) : null;
        onSelectMedia({
          id: mediaId,
          url: item.src,
          fileType:
            mediaRow && isAudioFile(mediaRow.file_type)
              ? "audio"
              : mediaRow && isVideoFile(mediaRow.file_type)
                ? "video"
                : "image",
          filename: mediaRow?.filename ?? item.alt,
          promptText: mediaRow ? resolveMediaMetadataPromptText(mediaRow.metadata) : null,
          source: mediaRow?.source ?? null,
          previewStoragePath: mediaRow?.preview_storage_path ?? mediaRow?.storage_path ?? null,
          fullStoragePath: mediaRow?.storage_path ?? null,
          previewUrl: item.src,
          fullUrl: item.src,
        });
        return;
      }
      if (item.kind !== "text") return;
      const promptId = getPromptIdFromCanvasOutputId(item.outputId);
      const promptRow = promptId ? promptById.get(promptId) : null;
      const text = item.text.trim();
      if (!text) return;
      onSelectPrompt({
        id: promptId ?? `folder-canvas-text:${folderId}:${item.id}`,
        promptText: text,
        title: promptRow?.title ?? null,
      });
    },
    [folderId, mediaById, onSelectMedia, onSelectPrompt, promptById, workspace.sessionState.items]
  );

  const handleItemDragStart = useCallback(
    (itemId: string, event: React.DragEvent<HTMLElement>) => {
      if (!event.shiftKey) {
        event.preventDefault();
        return;
      }
      const item = workspace.sessionState.items.find((candidate) => candidate.id === itemId);
      if (!item) {
        event.preventDefault();
        return;
      }

      if (item.kind === "image") {
        const mediaRow = item.mediaId ? mediaById.get(item.mediaId) : null;
        const dragDimensions = resolveMediaDragDimensions({
          fileType: mediaRow?.file_type ?? "image",
          width: mediaRow?.width ?? item.width,
          height: mediaRow?.height ?? item.height,
          metadata: mediaRow?.metadata ?? null,
        });
        writeMediaLibraryDragPayload(event.dataTransfer, {
          kind: "libraryMedia",
          source: "mediaLibrary",
          payload: {
            id: item.mediaId ?? item.id,
            url: item.src,
            fileType:
              mediaRow && isAudioFile(mediaRow.file_type)
                ? "audio"
                : mediaRow && isVideoFile(mediaRow.file_type)
                  ? "video"
                  : "image",
            createdAt: mediaRow?.created_at ?? null,
            originFolderId: folderId,
            filename: mediaRow?.filename ?? item.alt,
            promptText: mediaRow ? resolveMediaMetadataPromptText(mediaRow.metadata) : null,
            source: mediaRow?.source ?? null,
            previewStoragePath: mediaRow?.preview_storage_path ?? mediaRow?.storage_path ?? null,
            fullStoragePath: mediaRow?.storage_path ?? null,
            previewUrl: item.src,
            fullUrl: item.src,
            width: dragDimensions.width,
            height: dragDimensions.height,
          },
        });
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/reference-url", item.src);
        event.dataTransfer.setData("text/uri-list", item.src);
        event.dataTransfer.setData("text/plain", item.src);
        attachMediaLibraryDragGhost(event, {
          label: mediaRow?.filename || item.alt || "Media",
          detail: mediaRow ? resolveMediaMetadataPromptText(mediaRow.metadata) : null,
          previewUrl: item.src,
          previewKind: mediaRow && isVideoFile(mediaRow.file_type) ? "video" : "image",
        });
      } else {
        if (item.kind !== "text") {
          event.preventDefault();
          return;
        }
        const promptId = getPromptIdFromCanvasOutputId(item.outputId);
        const promptText = item.text.trim();
        if (!promptText) {
          event.preventDefault();
          return;
        }
        const promptRow = promptId ? promptById.get(promptId) : null;
        writeMediaLibraryDragPayload(event.dataTransfer, {
          kind: "libraryPrompt",
          source: "mediaLibrary",
          payload: {
            id: promptId ?? item.id,
            promptText,
            createdAt: promptRow?.created_at ?? null,
            originFolderId: folderId,
            title: promptRow?.title ?? null,
          },
        });
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("text/prompt", promptText);
        event.dataTransfer.setData("text/plain", promptText);
        attachMediaLibraryDragGhost(event, {
          label: promptRow?.title || "Prompt",
          detail: promptText,
          previewKind: "text",
        });
      }
      event.currentTarget.classList.add("is-dragging");
    },
    [folderId, mediaById, promptById, workspace.sessionState.items]
  );

  const handleItemDragEnd = useCallback((_: string, event: React.DragEvent<HTMLElement>) => {
    event.currentTarget.classList.remove("is-dragging");
    clearMediaLibraryDragGhost(event);
  }, []);

  const canvasProps = useMemo(
    () => ({
      ...mainCanvasProps,
      instanceId: "main" as const,
      onItemContextMenu: handleItemContextMenu,
      isItemDraggable: true,
      onItemDragStart: handleItemDragStart,
      onItemDragEnd: handleItemDragEnd,
    }),
    [handleItemContextMenu, handleItemDragEnd, handleItemDragStart, mainCanvasProps]
  );

  return (
    <section className="media-library-folder-canvas" aria-label="Media library folder canvas">
      {loadingState ? <p className="tiny subdued">Loading folder canvas...</p> : null}
      {error ? <p className="tiny subdued">{error}</p> : null}
      {saveError ? <p className="tiny subdued">{saveError}</p> : null}
      {!loadingState ? <CanvasPropertiesPanel {...canvasProps} /> : null}
    </section>
  );
}
