/**
 * AI Studio Media Library left-panel surface.
 * Provides folder-aware browsing for media + prompts with adaptive preview/signing parity.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderSimple, Folders, MagnifyingGlass, Plus } from "phosphor-react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import {
  MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
  type MediaSignBudget,
} from "../../../lib/mediaPreviewRuntimePolicy";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaPreviewRecoveryController } from "../../media-library/hooks/useMediaPreviewRecoveryController";
import { useMediaPreviewSigningController } from "../../media-library/hooks/useMediaPreviewSigningController";
import {
  AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED,
  MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED,
  MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
} from "../../media-library/logic/mediaLibraryFeatureFlags";
import {
  deleteMediaFileWithStorage,
  deleteMediaPromptById,
  logMediaEvent,
} from "../../media-library/logic/mediaLibraryDataEffects";
import {
  fetchMediaListPage,
  type MediaListCursor,
  type MediaListMediaKind,
} from "../../media-library/logic/mediaListApi";
import { resolveSignedSelectionUrl } from "../../media-library/logic/mediaPreviewResolver";
import {
  hydrateMediaPreviewViaStorageDownload,
  resolveAndApplySignedPreviewUrlsByRows,
  signMediaStoragePath,
} from "../../media-library/logic/mediaPreviewRuntimeShared";
import {
  BUCKET,
  createMediaTabBooleanState,
  getMediaDataTabForRow,
  isNextImageOptimizerUrl,
  isVideoFile,
  normalizeMediaSearchTerm,
  resolveMediaMetadataPromptText,
  resolveModalSignBudget,
  resolveNextImageOptimizerSourceUrl,
  sortByCreatedAtDesc,
  type MediaDataTab,
  type MediaFileRow,
  type MediaTab,
  type PromptRow,
} from "../logic/mediaLibraryModalModel";
import {
  applyMediaFolderMembershipBatch,
  fetchMediaPromptListPage,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  type PromptListCursor,
} from "../logic/mediaLibraryPanelApi";
import {
  attachMediaLibraryDragGhost,
  clearMediaLibraryDragGhost,
} from "../logic/mediaLibraryDragGhost";
import { writeMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import { resolveMediaLibraryPanelCardPreviewUrl } from "../logic/mediaLibraryPanelPreviewResolver";
import { downloadBlobToFile } from "../logic/referenceDownload";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { useMediaLibraryFoldersState } from "../hooks/useMediaLibraryFoldersState";
import { useMediaLibraryFolderDropController } from "../hooks/useMediaLibraryFolderDropController";
import type { InternalReferenceDragPayload } from "../utils/dragDrop";
import type { ResolveCanvasDropReference } from "./canvas/canvasTypes";
import { MediaLibraryFolderCanvas } from "./MediaLibraryFolderCanvas";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryPanelPreviewModal } from "./media-library-modal/MediaLibraryPanelPreviewModal";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "prompts";
type RootMediaLibraryTab = "images" | "videos" | "prompts";

type FolderContextMenuState = {
  folderId: string;
  folderName: string;
  x: number;
  y: number;
};

type PendingLibraryDeleteState =
  | {
      kind: "media";
      file: MediaFileRow;
    }
  | {
      kind: "prompt";
      prompt: PromptRow;
    };

type MediaLibraryPanelProps = {
  onSelectMedia: (payload: {
    id: string;
    url: string;
    fileType: "image" | "video";
    filename?: string | null;
    promptText?: string | null;
    source?: string | null;
    previewStoragePath?: string | null;
    fullStoragePath?: string | null;
    previewUrl?: string | null;
    fullUrl?: string | null;
  }) => void;
  onSelectPrompt: (payload: { id: string; promptText: string; title?: string | null }) => void;
  resolveInternalDropItem?: (payload: InternalReferenceDragPayload) => Promise<{
    kind: "media" | "prompt";
    id: string;
  } | null>;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
};

const MEDIA_PAGE_SIZE = 36;
const PROMPT_PAGE_SIZE = 36;
const INFINITE_LOAD_BOTTOM_THRESHOLD_PX = 220;
const ROOT_FOLDER_LABEL = "All Media";
const EMPTY_SELECTED_IDS = new Set<string>();
const FOLDER_CONTEXT_MENU_WIDTH_PX = 156;
const FOLDER_CONTEXT_MENU_HEIGHT_PX = 84;
const FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX = 10;

const resolveMediaKind = (itemType: MediaLibraryPanelItemType): MediaListMediaKind => {
  if (itemType === "images") return "images";
  if (itemType === "videos") return "videos";
  return "all";
};

const resolveSigningTab = (itemType: MediaLibraryPanelItemType): MediaDataTab => {
  if (itemType === "videos") return "uploaded_videos";
  return "uploaded_images";
};

const createdAtTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const MediaLibraryPanel = React.memo(function MediaLibraryPanel({
  onSelectMedia,
  onSelectPrompt,
  resolveInternalDropItem,
  resolveCanvasDropReference,
}: MediaLibraryPanelProps) {
  const {
    folders,
    orderedFolders,
    activeFolderId,
    setActiveFolderId,
    folderError,
    setFolderError,
    creatingFolder,
    createFolder,
    editingFolderId,
    editingFolderName,
    setEditingFolderName,
    startFolderRename,
    cancelFolderRename,
    commitFolderRename,
    deleteFolder,
  } = useMediaLibraryFoldersState();

  const isRootFolderSelected = activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const [rootTab, setRootTab] = useState<RootMediaLibraryTab>("images");
  const itemType: MediaLibraryPanelItemType = isRootFolderSelected ? rootTab : "all";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [mediaRows, setMediaRows] = useState<MediaFileRow[]>([]);
  const [promptRows, setPromptRows] = useState<PromptRow[]>([]);
  const [mediaCursor, setMediaCursor] = useState<MediaListCursor | null>(null);
  const [promptCursor, setPromptCursor] = useState<PromptListCursor | null>(null);
  const [mediaHasMore, setMediaHasMore] = useState(false);
  const [promptHasMore, setPromptHasMore] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);
  const [pendingLibraryDelete, setPendingLibraryDelete] =
    useState<PendingLibraryDeleteState | null>(null);
  const [deleteConfirmSubmitting, setDeleteConfirmSubmitting] = useState(false);
  const [previewModalFile, setPreviewModalFile] = useState<MediaFileRow | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalLoading, setPreviewModalLoading] = useState(false);
  const [previewModalError, setPreviewModalError] = useState<string | null>(null);

  const selectedIds = EMPTY_SELECTED_IDS;
  const [folderContextMenu, setFolderContextMenu] = useState<FolderContextMenuState | null>(null);

  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const signAttemptRef = useRef<Record<string, number>>({});
  const downloadFallbackInFlightRef = useRef<Record<string, boolean>>({});
  const mediaDownloadInFlightRef = useRef<Record<string, boolean>>({});
  const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const mediaRequestTokenRef = useRef(0);
  const promptRequestTokenRef = useRef(0);
  const activeTabRef = useRef<MediaTab>("uploaded_images");
  const activeMediaQueryRef = useRef("");
  const mediaSignInFlightRef = useRef(createMediaTabBooleanState());

  const panelBodyRef = useRef<HTMLDivElement | null>(null);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const mediaCardNodesRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const mediaCardRefCallbacksRef = useRef<Record<string, (node: HTMLButtonElement | null) => void>>(
    {}
  );
  const mediaCardObserverRef = useRef<IntersectionObserver | null>(null);
  const visibleMediaIdsRef = useRef<Set<string>>(new Set());
  const [visibleMediaVersion, setVisibleMediaVersion] = useState(0);
  const folderContextMenuRef = useRef<HTMLDivElement | null>(null);
  const previewResolveTokenRef = useRef(0);
  const autoLoadInFlightRef = useRef<{ media: boolean; prompts: boolean }>({
    media: false,
    prompts: false,
  });

  const [signPassNonce, setSignPassNonce] = useState(0);
  const [signBudget, setSignBudget] = useState<MediaSignBudget>(resolveModalSignBudget);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );
  const mediaRowsRef = useRef<MediaFileRow[]>([]);
  const promptRowsRef = useRef<PromptRow[]>([]);
  const mediaCursorRef = useRef<MediaListCursor | null>(null);
  const promptCursorRef = useRef<PromptListCursor | null>(null);

  const adaptivePreviewQualityEnabled =
    isAdaptiveSurfaceEnabled("media-library-modal-grid") ||
    isAdaptiveSurfaceEnabled("media-library-grid");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-modal",
    enabled: adaptivePreviewQualityEnabled,
  });

  const normalizedSearch = useMemo(
    () => normalizeMediaSearchTerm(debouncedSearch),
    [debouncedSearch]
  );
  const visiblePromptRows = useMemo(() => sortByCreatedAtDesc(promptRows), [promptRows]);
  const visibleImageRows = useMemo(
    () => mediaRows.filter((row) => !isVideoFile(row.file_type)),
    [mediaRows]
  );
  const visibleVideoRows = useMemo(
    () => mediaRows.filter((row) => isVideoFile(row.file_type)),
    [mediaRows]
  );
  const shouldShowMedia = itemType !== "prompts";
  const shouldShowPrompts = itemType === "prompts" || itemType === "all";
  const showFolderCanvas =
    activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID && shouldShowMedia && shouldShowPrompts;
  const activeMediaTab = useMemo<MediaDataTab | null>(() => {
    if (!shouldShowMedia || mediaRows.length === 0) return null;
    return resolveSigningTab(itemType);
  }, [itemType, mediaRows.length, shouldShowMedia]);
  const foldersSplit = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: 0.3,
    minTopSectionHeightPx: 0,
    minTopRatioFloor: 0,
    minBottomSectionHeightPx: 240,
    allRefsSnapTopHeightPx: 120,
    collapseTopHeightPx: 86,
    ariaLabel: "Resize folders and references sections",
  });

  useVisibleErrorTelemetry({
    source: "client.ai_studio.media_library_panel_error",
    scope: "app",
    severity: "medium",
    message: error || folderError,
    metadata: {
      folder_id: activeFolderId,
      item_type: itemType,
      has_media_rows: mediaRows.length > 0,
      has_prompt_rows: promptRows.length > 0,
    },
  });

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 220);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    activeMediaQueryRef.current = normalizedSearch;
  }, [normalizedSearch]);

  useEffect(() => {
    mediaRowsRef.current = mediaRows;
  }, [mediaRows]);

  useEffect(() => {
    promptRowsRef.current = promptRows;
  }, [promptRows]);

  useEffect(() => {
    mediaCursorRef.current = mediaCursor;
  }, [mediaCursor]);

  useEffect(() => {
    promptCursorRef.current = promptCursor;
  }, [promptCursor]);

  useEffect(() => {
    activeTabRef.current = activeMediaTab ?? "saved_prompts";
  }, [activeMediaTab]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    const refreshBudget = () => {
      setSignBudget((prev) => {
        const next = resolveModalSignBudget();
        if (
          prev.initialSignLimit === next.initialSignLimit &&
          prev.prefetchWindow === next.prefetchWindow &&
          prev.signBatchSize === next.signBatchSize
        ) {
          return prev;
        }
        return next;
      });
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void ensureSupabaseClient()
      .auth.getSession()
      .then(({ data }) => {
        if (cancelled) return;
        currentUserIdRef.current = data.session?.user?.id ?? null;
      })
      .catch(() => {
        if (cancelled) return;
        currentUserIdRef.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(
    () => () => {
      for (const objectUrl of Object.values(objectUrlByMediaIdRef.current)) {
        URL.revokeObjectURL(objectUrl);
      }
      objectUrlByMediaIdRef.current = {};
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    signAttemptRef.current = {};
    setOptimizerFallbackMediaIds(new Set());
  }, [activeFolderId, itemType, normalizedSearch]);

  useEffect(() => {
    if (!folderContextMenu) return;
    const dismissContextMenu = () => {
      setFolderContextMenu(null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        dismissContextMenu();
        return;
      }
      if (folderContextMenuRef.current?.contains(target)) return;
      dismissContextMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissContextMenu();
      }
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", dismissContextMenu, true);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", dismissContextMenu, true);
    };
  }, [folderContextMenu]);

  const applySignedUrlsToMediaRows = useCallback(
    (_tab: MediaDataTab, signedById: Map<string, string>) => {
      if (!signedById.size) return;
      setMediaRows((previous) =>
        previous.map((row) => {
          const signedUrl = signedById.get(row.id);
          if (!signedUrl || row.signedUrl === signedUrl) return row;
          return { ...row, signedUrl };
        })
      );
    },
    []
  );

  const setObjectUrlForMediaRow = useCallback(
    (row: MediaFileRow, objectUrl: string) => {
      const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
      if (previousObjectUrl && previousObjectUrl !== objectUrl) {
        URL.revokeObjectURL(previousObjectUrl);
      }
      objectUrlByMediaIdRef.current[row.id] = objectUrl;
      applySignedUrlsToMediaRows(resolveSigningTab(itemType), new Map([[row.id, objectUrl]]));
    },
    [applySignedUrlsToMediaRows, itemType]
  );

  const hydrateViaStorageDownload = useCallback(
    async (row: MediaFileRow): Promise<string | null> => {
      if (downloadFallbackInFlightRef.current[row.id]) return null;
      downloadFallbackInFlightRef.current[row.id] = true;
      try {
        const supabase = ensureSupabaseClient();
        return await hydrateMediaPreviewViaStorageDownload({
          row,
          currentUserId: currentUserIdRef.current,
          downloadFromStoragePath: async (storagePath) => {
            const { data, error: downloadError } = await supabase.storage
              .from(BUCKET)
              .download(storagePath);
            if (downloadError || !data) return null;
            return data as Blob;
          },
          applyObjectUrlForRow: setObjectUrlForMediaRow,
        });
      } catch {
        return null;
      } finally {
        downloadFallbackInFlightRef.current[row.id] = false;
      }
    },
    [setObjectUrlForMediaRow]
  );

  const resolveSignedUrlsByMediaIds = useCallback(
    async (_tab: MediaDataTab, rows: MediaFileRow[]): Promise<Set<string>> => {
      const rowsByTab = new Map<MediaDataTab, MediaFileRow[]>();
      for (const row of rows) {
        const tab = getMediaDataTabForRow(row);
        const bucketRows = rowsByTab.get(tab) ?? [];
        bucketRows.push(row);
        rowsByTab.set(tab, bucketRows);
      }
      const unresolved = new Set<string>();
      for (const [tab, tabRows] of rowsByTab.entries()) {
        const unresolvedInTab = await resolveAndApplySignedPreviewUrlsByRows({
          tab,
          rows: tabRows,
          applySignedUrlsToTab: applySignedUrlsToMediaRows,
          surface: "media-library-panel",
        });
        unresolvedInTab.forEach((id) => unresolved.add(id));
      }
      return unresolved;
    },
    [applySignedUrlsToMediaRows]
  );

  const signStoragePath = useCallback(
    (
      storagePath: string,
      options?: {
        forceRefresh?: boolean;
        previewProfile?: MediaPreviewTransformProfile;
      }
    ): Promise<string | null> => signMediaStoragePath(storagePath, options),
    []
  );

  const { refreshSignedUrl, handleMediaPreviewError } =
    useMediaPreviewRecoveryController<MediaFileRow>({
      applySignedUrlsToTab: applySignedUrlsToMediaRows,
      currentUserIdRef,
      resolveSignedUrlsByMediaIds,
      hydrateViaStorageDownload,
      signStoragePath,
      signedUrlRetryRef,
      objectUrlByMediaIdRef,
      resolveTabForRow: getMediaDataTabForRow,
      previewProfile: "media-library-panel-image-card",
      beforeRetry: ({ row, failedUrl }) => {
        if (!isNextImageOptimizerUrl(failedUrl)) return;
        const sourceUrl = resolveNextImageOptimizerSourceUrl(failedUrl);
        if (!sourceUrl) return;
        applySignedUrlsToMediaRows(getMediaDataTabForRow(row), new Map([[row.id, sourceUrl]]));
        setOptimizerFallbackMediaIds((previous) => {
          if (previous.has(row.id)) return previous;
          const next = new Set(previous);
          next.add(row.id);
          return next;
        });
      },
    });

  useMediaPreviewSigningController({
    activeMediaTab,
    activeMediaCacheLoading: mediaLoading,
    activeMediaCachePagesLoaded: 1,
    activeMediaQueryRef,
    activeTabRef,
    applySignedUrlsToTab: applySignedUrlsToMediaRows,
    currentUserIdRef,
    filteredMedia: mediaRows,
    hydrateViaStorageDownload,
    isMountedRef,
    mediaSignInFlightRef,
    resolveSignedUrlsByMediaIds,
    setSignPassNonce,
    signAttemptRef,
    signBudget,
    signPassNonce,
    visibleMediaIdsRef,
    visibleMediaVersion,
    isSigningPassEnabled: shouldShowMedia,
    surface: "media-library-panel",
    unresolvedWarningPrefix: "[media-library-panel]",
    maxSignAttemptsPerItem: MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
    maxSignCandidatesPerRow: 4,
    isSignPrefetchEnabled: MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED,
  });

  const getMediaCardRef = useCallback((fileId: string) => {
    const existing = mediaCardRefCallbacksRef.current[fileId];
    if (existing) return existing;
    const callback = (node: HTMLButtonElement | null) => {
      const previousNode = mediaCardNodesRef.current.get(fileId);
      if (previousNode && previousNode !== node) {
        mediaCardObserverRef.current?.unobserve(previousNode);
      }
      if (!node) {
        mediaCardNodesRef.current.delete(fileId);
        if (visibleMediaIdsRef.current.delete(fileId)) {
          setVisibleMediaVersion((previousVersion) => previousVersion + 1);
        }
        return;
      }
      node.dataset.mediaId = fileId;
      mediaCardNodesRef.current.set(fileId, node);
      mediaCardObserverRef.current?.observe(node);
    };
    mediaCardRefCallbacksRef.current[fileId] = callback;
    return callback;
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const visibleIds = visibleMediaIdsRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        for (const entry of entries) {
          const mediaId = (entry.target as HTMLElement).dataset.mediaId;
          if (!mediaId) continue;
          if (entry.isIntersecting) {
            if (!visibleIds.has(mediaId)) {
              visibleIds.add(mediaId);
              changed = true;
            }
            continue;
          }
          if (visibleIds.delete(mediaId)) {
            changed = true;
          }
        }
        if (changed) {
          setVisibleMediaVersion((previousVersion) => previousVersion + 1);
        }
      },
      {
        root: panelBodyRef.current,
        rootMargin: "460px 0px",
        threshold: 0.01,
      }
    );
    mediaCardObserverRef.current = observer;
    for (const node of mediaCardNodesRef.current.values()) {
      observer.observe(node);
    }
    return () => {
      observer.disconnect();
      mediaCardObserverRef.current = null;
      visibleIds.clear();
    };
  }, []);

  const loadMediaPage = useCallback(
    async ({ reset }: { reset: boolean }) => {
      const requestToken = mediaRequestTokenRef.current + 1;
      mediaRequestTokenRef.current = requestToken;
      setMediaLoading(true);
      if (reset) {
        setMediaCursor(null);
        setMediaHasMore(false);
      }
      try {
        const result = await fetchMediaListPage<MediaFileRow>({
          tab: null,
          mediaKind: resolveMediaKind(itemType),
          query: normalizedSearch,
          cursor: reset ? null : mediaCursorRef.current,
          limit: MEDIA_PAGE_SIZE,
          surface: "media-library-panel",
          folderId: activeFolderId,
        });
        if (!result) {
          throw new Error("Unable to load media.");
        }
        if (mediaRequestTokenRef.current !== requestToken) return;
        const signedById = result.signedById;
        const rowById = new Map<string, MediaFileRow>();
        const existingRows = reset ? [] : mediaRowsRef.current;
        for (const row of [...existingRows, ...result.rows]) {
          const signedUrl = row.signedUrl || signedById.get(row.id) || null;
          rowById.set(row.id, { ...row, signedUrl });
        }
        const nextRows = Array.from(rowById.values());
        nextRows.sort((left, right) => {
          const createdDelta = createdAtTime(right.created_at) - createdAtTime(left.created_at);
          if (createdDelta !== 0) return createdDelta;
          return right.id.localeCompare(left.id);
        });
        setMediaRows(nextRows);
        setMediaCursor(result.nextCursor);
        setMediaHasMore(result.hasMore);
        setError(null);
      } catch (loadError) {
        if (mediaRequestTokenRef.current !== requestToken) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load media.");
      } finally {
        if (mediaRequestTokenRef.current === requestToken) {
          setMediaLoading(false);
        }
      }
    },
    [activeFolderId, itemType, normalizedSearch]
  );

  const loadPromptPage = useCallback(
    async ({ reset }: { reset: boolean }) => {
      const requestToken = promptRequestTokenRef.current + 1;
      promptRequestTokenRef.current = requestToken;
      setPromptLoading(true);
      if (reset) {
        setPromptCursor(null);
        setPromptHasMore(false);
      }
      try {
        const result = await fetchMediaPromptListPage({
          folderId: activeFolderId,
          query: normalizedSearch,
          cursor: reset ? null : promptCursorRef.current,
          limit: PROMPT_PAGE_SIZE,
        });
        if (promptRequestTokenRef.current !== requestToken) return;
        const normalizedRows: PromptRow[] = result.rows.map((row) => ({
          id: row.id,
          title: row.title,
          prompt_text: row.prompt_text,
          mode: row.mode,
          source: row.source,
          created_at: row.created_at,
        }));
        const nextRows = reset
          ? normalizedRows
          : [...promptRowsRef.current, ...normalizedRows].filter(
              (row, index, rows) => rows.findIndex((candidate) => candidate.id === row.id) === index
            );
        setPromptRows(nextRows);
        setPromptCursor(result.nextCursor);
        setPromptHasMore(result.hasMore);
        setError(null);
      } catch (loadError) {
        if (promptRequestTokenRef.current !== requestToken) return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load prompts.");
      } finally {
        if (promptRequestTokenRef.current === requestToken) {
          setPromptLoading(false);
        }
      }
    },
    [activeFolderId, normalizedSearch]
  );

  useEffect(() => {
    setMembershipMessage(null);
    if (shouldShowMedia) {
      void loadMediaPage({ reset: true });
    } else {
      setMediaRows([]);
      setMediaHasMore(false);
      setMediaCursor(null);
    }
    if (shouldShowPrompts) {
      void loadPromptPage({ reset: true });
    } else {
      setPromptRows([]);
      setPromptHasMore(false);
      setPromptCursor(null);
    }
  }, [
    activeFolderId,
    itemType,
    loadMediaPage,
    loadPromptPage,
    normalizedSearch,
    shouldShowMedia,
    shouldShowPrompts,
  ]);

  const handleSelectPromptCard = useCallback(
    (prompt: PromptRow) => {
      onSelectPrompt({
        id: prompt.id,
        promptText: prompt.prompt_text,
        title: prompt.title,
      });
    },
    [onSelectPrompt]
  );

  const addMediaReferenceFromFile = useCallback(
    async (file: MediaFileRow) => {
      const nextUrl =
        (await resolveSignedSelectionUrl({
          row: file,
          currentUserId: currentUserIdRef.current,
          signStoragePath,
        })) ??
        (await refreshSignedUrl(file)) ??
        file.signedUrl;
      if (!nextUrl) return false;
      const previewStoragePath = file.preview_storage_path ?? file.storage_path;
      const fullStoragePath = file.storage_path;
      const previewUrl = file.signedUrl ?? nextUrl;
      const fullUrl = nextUrl;
      onSelectMedia({
        id: file.id,
        url: nextUrl,
        fileType: isVideoFile(file.file_type) ? "video" : "image",
        filename: file.filename,
        promptText: resolveMediaMetadataPromptText(file.metadata),
        source: file.source ?? "upload",
        previewStoragePath,
        fullStoragePath,
        previewUrl,
        fullUrl,
      });
      return true;
    },
    [onSelectMedia, refreshSignedUrl, signStoragePath]
  );

  const handleSelectMediaFile = useCallback((file: MediaFileRow) => {
    if (AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED) return;
    void file;
  }, []);

  const resolvePreviewModalUrl = useCallback(
    async (file: MediaFileRow): Promise<string | null> => {
      const nextUrl =
        (await resolveSignedSelectionUrl({
          row: file,
          currentUserId: currentUserIdRef.current,
          signStoragePath,
        })) ??
        (await refreshSignedUrl(file)) ??
        file.signedUrl;
      const normalized = (nextUrl ?? "").trim();
      return normalized || null;
    },
    [refreshSignedUrl, signStoragePath]
  );

  const closePreviewModal = useCallback(() => {
    previewResolveTokenRef.current += 1;
    setPreviewModalFile(null);
    setPreviewModalUrl(null);
    setPreviewModalLoading(false);
    setPreviewModalError(null);
  }, []);

  const handleMediaCardDoubleClick = useCallback(
    (file: MediaFileRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      const nextToken = previewResolveTokenRef.current + 1;
      previewResolveTokenRef.current = nextToken;
      setPreviewModalFile(file);
      setPreviewModalUrl((file.signedUrl ?? "").trim() || null);
      setPreviewModalLoading(true);
      setPreviewModalError(null);
      void resolvePreviewModalUrl(file)
        .then((resolvedUrl) => {
          if (previewResolveTokenRef.current !== nextToken) return;
          if (resolvedUrl) {
            setPreviewModalUrl(resolvedUrl);
            return;
          }
          setPreviewModalError("Failed to load preview.");
        })
        .catch(() => {
          if (previewResolveTokenRef.current !== nextToken) return;
          setPreviewModalError("Failed to load preview.");
        })
        .finally(() => {
          if (previewResolveTokenRef.current !== nextToken) return;
          setPreviewModalLoading(false);
        });
    },
    [activeFolderId, resolvePreviewModalUrl]
  );

  const refreshActiveRows = useCallback(async () => {
    if (shouldShowMedia) {
      await loadMediaPage({ reset: true });
    }
    if (shouldShowPrompts) {
      await loadPromptPage({ reset: true });
    }
  }, [loadMediaPage, loadPromptPage, shouldShowMedia, shouldShowPrompts]);

  const maybeAutoLoadMore = useCallback(() => {
    const container = panelBodyRef.current;
    if (!container || showFolderCanvas) return;
    if (container.clientHeight <= 0 || container.scrollHeight <= 0) return;
    const remaining = container.scrollHeight - (container.scrollTop + container.clientHeight);
    if (!Number.isFinite(remaining) || remaining > INFINITE_LOAD_BOTTOM_THRESHOLD_PX) return;

    if (shouldShowMedia && mediaHasMore && !mediaLoading && !autoLoadInFlightRef.current.media) {
      autoLoadInFlightRef.current.media = true;
      void loadMediaPage({ reset: false }).finally(() => {
        autoLoadInFlightRef.current.media = false;
      });
      return;
    }

    if (
      shouldShowPrompts &&
      promptHasMore &&
      !promptLoading &&
      !autoLoadInFlightRef.current.prompts
    ) {
      autoLoadInFlightRef.current.prompts = true;
      void loadPromptPage({ reset: false }).finally(() => {
        autoLoadInFlightRef.current.prompts = false;
      });
    }
  }, [
    loadMediaPage,
    loadPromptPage,
    mediaHasMore,
    mediaLoading,
    promptHasMore,
    promptLoading,
    shouldShowMedia,
    shouldShowPrompts,
    showFolderCanvas,
  ]);

  useEffect(() => {
    const container = panelBodyRef.current;
    if (!container) return;
    let rafId = 0;
    const onScroll = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        maybeAutoLoadMore();
      });
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (rafId !== 0) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [maybeAutoLoadMore]);

  const handleRemoveItemFromActiveFolder = useCallback(
    async (item: { kind: "media" | "prompt"; id: string }) => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await applyMediaFolderMembershipBatch({
          folderId: activeFolderId,
          action: "unassign",
          mediaIds: item.kind === "media" ? [item.id] : [],
          promptIds: item.kind === "prompt" ? [item.id] : [],
        });
        setMembershipMessage("Removed from this folder.");
        if (item.kind === "media") {
          setMediaRows((previous) => previous.filter((row) => row.id !== item.id));
        } else {
          setPromptRows((previous) => previous.filter((row) => row.id !== item.id));
        }
        await refreshActiveRows();
      } catch (membershipError) {
        setFolderError(
          membershipError instanceof Error
            ? membershipError.message
            : "Unable to update folder membership."
        );
      }
    },
    [activeFolderId, refreshActiveRows, setFolderError]
  );

  const handleAssignItemToActiveFolder = useCallback(
    async (item: { kind: "media" | "prompt"; id: string }): Promise<boolean> => {
      if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return false;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await applyMediaFolderMembershipBatch({
          folderId: activeFolderId,
          action: "assign",
          mediaIds: item.kind === "media" ? [item.id] : [],
          promptIds: item.kind === "prompt" ? [item.id] : [],
        });
        setMembershipMessage("Added to this folder.");
        await refreshActiveRows();
        return true;
      } catch (membershipError) {
        setFolderError(
          membershipError instanceof Error
            ? membershipError.message
            : "Unable to update folder membership."
        );
        return false;
      }
    },
    [activeFolderId, refreshActiveRows, setFolderError]
  );

  const handleDeleteMediaFromLibrary = useCallback(
    async (file: MediaFileRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await deleteMediaFileWithStorage(file);
        setMediaRows((previous) => previous.filter((row) => row.id !== file.id));
        setMembershipMessage("Deleted from All Media.");
        void logMediaEvent("delete", "media_file", file.id, {
          storage_path: file.storage_path,
          surface: "ai-studio-media-library-panel",
        });
      } catch (deleteError) {
        setFolderError(
          deleteError instanceof Error ? deleteError.message : "Unable to delete media."
        );
      }
    },
    [activeFolderId, setFolderError]
  );

  const handleDeletePromptFromLibrary = useCallback(
    async (prompt: PromptRow) => {
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      setMembershipMessage(null);
      setFolderError(null);
      try {
        await deleteMediaPromptById(prompt.id);
        setPromptRows((previous) => previous.filter((row) => row.id !== prompt.id));
        setMembershipMessage("Deleted from All Media.");
        void logMediaEvent("delete", "media_prompt", prompt.id, {
          surface: "ai-studio-media-library-panel",
        });
      } catch (deleteError) {
        setFolderError(
          deleteError instanceof Error ? deleteError.message : "Unable to delete prompt."
        );
      }
    },
    [activeFolderId, setFolderError]
  );

  const closeDeleteConfirm = useCallback(() => {
    if (deleteConfirmSubmitting) return;
    setPendingLibraryDelete(null);
  }, [deleteConfirmSubmitting]);

  const confirmDeleteFromLibrary = useCallback(async () => {
    if (!pendingLibraryDelete) return;
    if (deleteConfirmSubmitting) return;
    setDeleteConfirmSubmitting(true);
    try {
      if (pendingLibraryDelete.kind === "media") {
        await handleDeleteMediaFromLibrary(pendingLibraryDelete.file);
      } else {
        await handleDeletePromptFromLibrary(pendingLibraryDelete.prompt);
      }
      setPendingLibraryDelete(null);
    } finally {
      setDeleteConfirmSubmitting(false);
    }
  }, [
    deleteConfirmSubmitting,
    handleDeleteMediaFromLibrary,
    handleDeletePromptFromLibrary,
    pendingLibraryDelete,
  ]);

  useEffect(() => {
    setPendingLibraryDelete(null);
    setDeleteConfirmSubmitting(false);
    closePreviewModal();
  }, [activeFolderId, closePreviewModal]);

  const foldersDropController = useMediaLibraryFolderDropController({
    folders,
    setFolderError,
    setMembershipMessage,
    refreshActiveRows,
    resolveInternalDropItem,
  });

  const handleMediaCardDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, file: MediaFileRow) => {
      const signedUrl = (file.signedUrl ?? "").trim();
      if (!signedUrl) {
        event.preventDefault();
        return;
      }
      const promptText = resolveMediaMetadataPromptText(file.metadata) ?? file.filename ?? "";
      writeMediaLibraryDragPayload(event.dataTransfer, {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: file.id,
          url: signedUrl,
          fileType: isVideoFile(file.file_type) ? "video" : "image",
          originFolderId: activeFolderId,
          filename: file.filename,
          promptText,
          source: file.source ?? null,
          previewStoragePath: file.preview_storage_path ?? file.storage_path,
          fullStoragePath: file.storage_path,
          previewUrl: signedUrl,
          fullUrl: signedUrl,
        },
      });
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/reference-url", signedUrl);
      event.dataTransfer.setData("text/uri-list", signedUrl);
      if (promptText.trim()) {
        event.dataTransfer.setData("text/prompt", promptText);
        event.dataTransfer.setData("text/plain", promptText);
      } else {
        event.dataTransfer.setData("text/plain", signedUrl);
      }
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: file.filename || "Media",
        detail: promptText,
        previewUrl: signedUrl,
        previewKind: isVideoFile(file.file_type) ? "video" : "image",
      });
    },
    [activeFolderId]
  );

  const handlePromptCardDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, prompt: PromptRow) => {
      const promptText = prompt.prompt_text.trim();
      if (!promptText) {
        event.preventDefault();
        return;
      }
      writeMediaLibraryDragPayload(event.dataTransfer, {
        kind: "libraryPrompt",
        source: "mediaLibrary",
        payload: {
          id: prompt.id,
          promptText,
          originFolderId: activeFolderId,
          title: prompt.title,
        },
      });
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/prompt", promptText);
      event.dataTransfer.setData("text/plain", promptText);
      event.currentTarget.classList.add("is-dragging");
      attachMediaLibraryDragGhost(event, {
        label: prompt.title || "Prompt",
        detail: promptText,
        previewKind: "text",
      });
    },
    [activeFolderId]
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("is-dragging");
    clearMediaLibraryDragGhost(event);
  }, []);

  const resolveDownloadBlob = useCallback(async (file: MediaFileRow): Promise<Blob | null> => {
    const primaryStoragePath = (file.storage_path ?? "").trim();
    if (primaryStoragePath) {
      try {
        const supabase = ensureSupabaseClient();
        const { data, error: downloadError } = await supabase.storage
          .from(BUCKET)
          .download(primaryStoragePath);
        if (!downloadError && data) {
          return data as Blob;
        }
      } catch {
        // Fall through to signed-url fetch fallback.
      }
    }
    const signedUrl = (file.signedUrl ?? "").trim();
    if (!signedUrl) return null;
    try {
      const response = await fetch(signedUrl, {
        method: "GET",
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) return null;
      const blob = await response.blob();
      if (!blob.size) return null;
      return blob;
    } catch {
      return null;
    }
  }, []);

  const handleDownloadMediaFile = useCallback(
    (file: MediaFileRow) => {
      const filename = (file.filename ?? "media").trim() || "media";
      if (mediaDownloadInFlightRef.current[file.id]) return;
      mediaDownloadInFlightRef.current[file.id] = true;
      void resolveDownloadBlob(file)
        .then((blob) => {
          if (blob) {
            downloadBlobToFile(blob, filename);
            return;
          }
          const signedUrl = (file.signedUrl ?? "").trim();
          if (!signedUrl) return;
          const anchor = document.createElement("a");
          anchor.href = signedUrl;
          anchor.download = filename;
          anchor.rel = "noopener";
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
        })
        .finally(() => {
          mediaDownloadInFlightRef.current[file.id] = false;
        });
    },
    [resolveDownloadBlob]
  );

  const handleMediaCardContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, file: MediaFileRow) => {
      if (!AI_STUDIO_MEDIA_LIBRARY_GESTURE_V2_ENABLED) return;
      if (activeFolderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
      event.preventDefault();
      event.stopPropagation();
      void addMediaReferenceFromFile(file);
    },
    [activeFolderId, addMediaReferenceFromFile]
  );

  const openFolderContextMenu = useCallback(
    (
      event: React.MouseEvent<HTMLElement>,
      folder: { id: string; name: string },
      isRoot: boolean
    ) => {
      event.preventDefault();
      event.stopPropagation();
      if (isRoot) {
        setFolderContextMenu(null);
        return;
      }
      setActiveFolderId(folder.id);
      const boundedX = Math.min(
        event.clientX,
        window.innerWidth - FOLDER_CONTEXT_MENU_WIDTH_PX - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
      );
      const boundedY = Math.min(
        event.clientY,
        window.innerHeight - FOLDER_CONTEXT_MENU_HEIGHT_PX - FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX
      );
      setFolderContextMenu({
        folderId: folder.id,
        folderName: folder.name,
        x: Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, boundedX),
        y: Math.max(FOLDER_CONTEXT_MENU_VIEWPORT_PADDING_PX, boundedY),
      });
    },
    [setActiveFolderId]
  );

  const handleContextRename = useCallback(() => {
    if (!folderContextMenu) return;
    startFolderRename(folderContextMenu.folderId, folderContextMenu.folderName);
    setFolderContextMenu(null);
  }, [folderContextMenu, startFolderRename]);

  const handleContextDelete = useCallback(async () => {
    if (!folderContextMenu) return;
    const folderId = folderContextMenu.folderId;
    setFolderContextMenu(null);
    await deleteFolder(folderId);
  }, [deleteFolder, folderContextMenu]);

  const activeFolderName =
    orderedFolders.find((folder) => folder.id === activeFolderId)?.name || ROOT_FOLDER_LABEL;
  const canShowFolderItemRemoveAction = !isRootFolderSelected;
  const resolvePanelCardPreviewUrl = useCallback(
    ({
      signedUrl,
      fileType,
      pressureLevel,
      adaptivePreviewQualityEnabled: isAdaptivePreviewQualityEnabled,
      shouldBypassAdaptivePreview = false,
      cardLongEdgePx,
      devicePixelRatio,
    }: {
      signedUrl: string | null | undefined;
      fileType?: string | null;
      pressureLevel: 0 | 1 | 2;
      adaptivePreviewQualityEnabled: boolean;
      shouldBypassAdaptivePreview?: boolean;
      cardLongEdgePx?: number;
      devicePixelRatio?: number;
    }) =>
      resolveMediaLibraryPanelCardPreviewUrl({
        signedUrl,
        fileType,
        pressureLevel,
        adaptivePreviewQualityEnabled: isAdaptivePreviewQualityEnabled,
        shouldBypassAdaptivePreview,
        cardLongEdgePx,
        devicePixelRatio,
        constantCompressionEnabled: MEDIA_LIBRARY_PANEL_CONSTANT_COMPRESSION_ENABLED,
      }),
    []
  );

  const renderMediaGrid = useCallback(
    (rows: MediaFileRow[]) => (
      <MediaLibraryMediaGrid
        activeMedia={rows}
        selectedIds={selectedIds}
        optimizerFallbackMediaIds={optimizerFallbackMediaIds}
        adaptivePressureLevel={mediaAdaptivePressure.previewPressureLevel}
        adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
        resolveCardPreviewUrl={resolvePanelCardPreviewUrl}
        scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
        getMediaCardRef={getMediaCardRef}
        onSelectMediaFile={(file) => {
          void handleSelectMediaFile(file);
        }}
        onMediaDoubleClick={handleMediaCardDoubleClick}
        onMediaDragStart={handleMediaCardDragStart}
        onMediaDragEnd={handleCardDragEnd}
        onMediaContextMenu={handleMediaCardContextMenu}
        showRemoveAction={canShowFolderItemRemoveAction}
        onRemoveMediaFromFolder={(file) => {
          void handleRemoveItemFromActiveFolder({ kind: "media", id: file.id });
        }}
        showDeleteAction={activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID}
        onDeleteMediaFromLibrary={(file) => {
          setPendingLibraryDelete({
            kind: "media",
            file,
          });
        }}
        onDownloadMediaFile={handleDownloadMediaFile}
        onMediaPreviewError={handleMediaPreviewError}
        onMediaPaint={() => undefined}
        onSignedUrlLoaded={(id) => {
          signedUrlRetryRef.current[id] = 0;
        }}
      />
    ),
    [
      adaptivePreviewQualityEnabled,
      canShowFolderItemRemoveAction,
      getMediaCardRef,
      handleCardDragEnd,
      handleMediaCardDoubleClick,
      handleMediaCardDragStart,
      handleMediaCardContextMenu,
      handleDownloadMediaFile,
      handleMediaPreviewError,
      handleRemoveItemFromActiveFolder,
      handleSelectMediaFile,
      mediaAdaptivePressure.previewPressureLevel,
      optimizerFallbackMediaIds,
      resolvePanelCardPreviewUrl,
      selectedIds,
      activeFolderId,
    ]
  );

  const renderPromptsSection = useCallback(
    () => (
      <section className="media-library-panel-section">
        <div className="media-library-panel-section-head">
          <p className="tiny subdued">
            Prompts ({visiblePromptRows.length})
            {promptLoading && visiblePromptRows.length > 0 ? " · Refreshing" : ""}
          </p>
        </div>
        {promptLoading && visiblePromptRows.length === 0 ? (
          <p className="tiny subdued">Loading prompts…</p>
        ) : null}
        {!promptLoading && visiblePromptRows.length === 0 ? (
          <p className="tiny subdued">No prompts found for this folder.</p>
        ) : null}
        <div id="media-library-panel-prompts-section">
          {visiblePromptRows.length > 0 ? (
            <MediaLibraryPromptGrid
              prompts={visiblePromptRows}
              sortedPrompts={visiblePromptRows}
              selectedIds={selectedIds}
              onSelectPromptCard={handleSelectPromptCard}
              onPromptDragStart={handlePromptCardDragStart}
              onPromptDragEnd={handleCardDragEnd}
              showRemoveAction={canShowFolderItemRemoveAction}
              showDeleteAction={activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID}
              onRemovePromptFromFolder={(prompt) => {
                void handleRemoveItemFromActiveFolder({ kind: "prompt", id: prompt.id });
              }}
              onDeletePromptFromLibrary={(prompt) => {
                setPendingLibraryDelete({
                  kind: "prompt",
                  prompt,
                });
              }}
              variant="reference-card"
            />
          ) : null}
          {promptHasMore ? (
            <div className="media-load-more">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  void loadPromptPage({ reset: false });
                }}
                disabled={promptLoading}
              >
                {promptLoading ? "Loading more..." : "Load more prompts"}
              </button>
            </div>
          ) : null}
        </div>
      </section>
    ),
    [
      activeFolderId,
      canShowFolderItemRemoveAction,
      handleCardDragEnd,
      handlePromptCardDragStart,
      handleRemoveItemFromActiveFolder,
      handleSelectPromptCard,
      promptHasMore,
      promptLoading,
      selectedIds,
      visiblePromptRows,
      loadPromptPage,
    ]
  );

  return (
    <section className="media-library-panel" aria-label="Media library panel">
      <header className="media-library-panel-header">
        <div>
          <p className="eyebrow">Media Library</p>
          <p className="tiny subdued helper-text">Drag references to the grid.</p>
        </div>
      </header>

      <div ref={splitContainerRef} className="media-library-panel-split">
        <div className="media-library-panel-folders-panel" style={foldersSplit.topSectionStyle}>
          <div className="media-library-panel-controls">
            <div className="search-input media-library-panel-search">
              <MagnifyingGlass size={15} weight="bold" aria-hidden />
              <input
                type="text"
                value={search}
                placeholder="Search media and prompts"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="media-library-panel-folders">
            <div className="media-library-panel-folders-head">
              <span className="tiny subdued">
                <Folders size={14} weight="bold" aria-hidden /> Folders
              </span>
            </div>
            <div
              className="media-library-panel-folder-strip"
              role="list"
              aria-label="Media folders"
            >
              {orderedFolders.map((folder) => {
                const isRoot = folder.id === MEDIA_LIBRARY_ROOT_FOLDER_ID;
                const isActive = activeFolderId === folder.id;
                const isEditing = editingFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={`media-library-panel-folder-strip-item ${
                      foldersDropController.hoveredFolderId === folder.id ? "is-drop-hover" : ""
                    }`}
                    role="listitem"
                    onContextMenu={(event) => openFolderContextMenu(event, folder, isRoot)}
                    onDragOver={(event) =>
                      foldersDropController.handleFolderDragOver(folder.id, event)
                    }
                    onDragLeave={() => foldersDropController.handleFolderDragLeave(folder.id)}
                    onDrop={(event) => {
                      void foldersDropController.handleFolderDrop(folder.id, event);
                    }}
                  >
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="media-library-panel-folder-chip is-active is-editing"
                          onClick={() => setActiveFolderId(folder.id)}
                          aria-label={`${folder.name} folder`}
                        >
                          <FolderSimple
                            size={32}
                            weight={isRoot ? "fill" : "regular"}
                            aria-hidden
                          />
                        </button>
                        <div className="media-library-panel-folder-chip-edit">
                          <input
                            className="media-library-panel-folder-chip-input"
                            type="text"
                            value={editingFolderName}
                            maxLength={64}
                            autoFocus
                            onChange={(event) => setEditingFolderName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void commitFolderRename();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelFolderRename();
                              }
                            }}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`media-library-panel-folder-chip ${isActive ? "is-active" : ""}`}
                          onClick={() => setActiveFolderId(folder.id)}
                          aria-label={`${folder.name} folder`}
                        >
                          <FolderSimple
                            size={32}
                            weight={isRoot ? "fill" : "regular"}
                            aria-hidden
                          />
                        </button>
                        <button
                          type="button"
                          className="media-library-panel-folder-chip-name tiny"
                          onClick={() => setActiveFolderId(folder.id)}
                          onDoubleClick={() => {
                            if (isRoot) return;
                            startFolderRename(folder.id, folder.name);
                          }}
                          aria-label={`${folder.name} name`}
                        >
                          {folder.name}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
              <div className="media-library-panel-folder-strip-item" role="listitem">
                <button
                  type="button"
                  className="media-library-panel-folder-chip is-create"
                  aria-label="Create new folder"
                  onClick={() => {
                    void createFolder();
                  }}
                  disabled={creatingFolder}
                >
                  <Plus size={30} weight="bold" aria-hidden />
                </button>
                <p className="media-library-panel-folder-chip-name tiny">New Folder</p>
              </div>
            </div>
          </div>
          {folderError ? <p className="tiny subdued">{folderError}</p> : null}
        </div>

        <div
          className="reference-grid-horizontal-divider-wrap media-library-panel-horizontal-divider-wrap"
          {...foldersSplit.dividerProps}
        >
          <div className="reference-grid-horizontal-divider" />
        </div>

        <div className="media-library-panel-content-panel" style={foldersSplit.bottomSectionStyle}>
          {membershipMessage ? <p className="tiny subdued">{membershipMessage}</p> : null}

          <div className="media-library-panel-body" ref={panelBodyRef}>
            {error ? <p className="tiny subdued">{error}</p> : null}

            {showFolderCanvas ? (
              <MediaLibraryFolderCanvas
                folderId={activeFolderId}
                mediaRows={mediaRows}
                promptRows={visiblePromptRows}
                onSelectMedia={onSelectMedia}
                onSelectPrompt={onSelectPrompt}
                onUnassignItem={handleRemoveItemFromActiveFolder}
                resolveCanvasDropReference={resolveCanvasDropReference}
                resolveInternalDropItem={resolveInternalDropItem}
                onAssignDroppedItem={handleAssignItemToActiveFolder}
              />
            ) : null}

            {!showFolderCanvas && shouldShowPrompts && !isRootFolderSelected
              ? renderPromptsSection()
              : null}

            {!showFolderCanvas && isRootFolderSelected ? (
              <div
                className="media-library-panel-root-tabs"
                role="tablist"
                aria-label="All Media type tabs"
              >
                <button
                  type="button"
                  role="tab"
                  className={`media-library-panel-root-tab${rootTab === "images" ? " is-active" : ""}`}
                  aria-selected={rootTab === "images"}
                  aria-controls="media-library-panel-images-section"
                  onClick={() => setRootTab("images")}
                >
                  Images
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`media-library-panel-root-tab${rootTab === "videos" ? " is-active" : ""}`}
                  aria-selected={rootTab === "videos"}
                  aria-controls="media-library-panel-videos-section"
                  onClick={() => setRootTab("videos")}
                >
                  Videos
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`media-library-panel-root-tab${rootTab === "prompts" ? " is-active" : ""}`}
                  aria-selected={rootTab === "prompts"}
                  aria-controls="media-library-panel-prompts-section"
                  onClick={() => setRootTab("prompts")}
                >
                  Prompts
                </button>
              </div>
            ) : null}

            {!showFolderCanvas &&
            shouldShowMedia &&
            isRootFolderSelected &&
            itemType === "images" ? (
              <>
                <section className="media-library-panel-section">
                  <div className="media-library-panel-section-head">
                    <p className="tiny subdued">
                      Images ({visibleImageRows.length})
                      {mediaLoading && mediaRows.length > 0 ? " · Refreshing" : ""}
                    </p>
                  </div>
                  {mediaLoading && mediaRows.length === 0 ? (
                    <p className="tiny subdued">Loading images…</p>
                  ) : null}
                  {!mediaLoading && visibleImageRows.length === 0 ? (
                    <p className="tiny subdued">No images found for this folder.</p>
                  ) : null}
                  <div id="media-library-panel-images-section">
                    {visibleImageRows.length > 0 ? renderMediaGrid(visibleImageRows) : null}
                  </div>
                </section>
              </>
            ) : null}

            {!showFolderCanvas &&
            shouldShowMedia &&
            isRootFolderSelected &&
            itemType === "videos" ? (
              <>
                <section className="media-library-panel-section">
                  <div className="media-library-panel-section-head">
                    <p className="tiny subdued">
                      Videos ({visibleVideoRows.length})
                      {mediaLoading && mediaRows.length > 0 ? " · Refreshing" : ""}
                    </p>
                  </div>
                  {mediaLoading && mediaRows.length === 0 ? (
                    <p className="tiny subdued">Loading videos…</p>
                  ) : null}
                  {!mediaLoading && visibleVideoRows.length === 0 ? (
                    <p className="tiny subdued">No videos found for this folder.</p>
                  ) : null}
                  <div id="media-library-panel-videos-section">
                    {visibleVideoRows.length > 0 ? renderMediaGrid(visibleVideoRows) : null}
                  </div>
                </section>
              </>
            ) : null}

            {!showFolderCanvas && shouldShowPrompts && isRootFolderSelected
              ? renderPromptsSection()
              : null}

            {!showFolderCanvas && shouldShowMedia && isRootFolderSelected ? (
              <section
                className="media-library-panel-section media-library-panel-root-paginator"
                data-testid="media-library-panel-root-media-paginator"
              >
                <div className="media-load-more media-load-more-inline">
                  <p className="tiny subdued">
                    Loaded {mediaRows.length}{" "}
                    {mediaRows.length === 1 ? "media item" : "media items"}
                    {mediaHasMore ? "." : " (all loaded)."}
                  </p>
                  {mediaHasMore ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        void loadMediaPage({ reset: false });
                      }}
                      disabled={mediaLoading}
                    >
                      {mediaLoading ? "Loading more..." : "Load more media"}
                    </button>
                  ) : null}
                </div>
              </section>
            ) : null}

            {!showFolderCanvas && shouldShowMedia && !isRootFolderSelected ? (
              <section className="media-library-panel-section">
                <div className="media-library-panel-section-head">
                  <p className="tiny subdued">
                    Media ({mediaRows.length})
                    {mediaLoading && mediaRows.length > 0 ? " · Refreshing" : ""}
                  </p>
                </div>
                {mediaLoading && mediaRows.length === 0 ? (
                  <p className="tiny subdued">Loading media…</p>
                ) : null}
                {!mediaLoading && mediaRows.length === 0 ? (
                  <p className="tiny subdued">No media found for this folder.</p>
                ) : null}
                <div id="media-library-panel-media-section">
                  {mediaRows.length > 0 ? renderMediaGrid(mediaRows) : null}
                  {mediaHasMore ? (
                    <div className="media-load-more">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => {
                          void loadMediaPage({ reset: false });
                        }}
                        disabled={mediaLoading}
                      >
                        {mediaLoading ? "Loading more..." : "Load more media"}
                      </button>
                    </div>
                  ) : null}
                </div>
              </section>
            ) : null}
          </div>

          <footer className="media-library-panel-footer">
            <p className="tiny subdued media-library-panel-footer-folder-label">
              <FolderSimple
                size={13}
                weight={isRootFolderSelected ? "fill" : "regular"}
                aria-hidden
              />
              <span>{activeFolderName}</span>
            </p>
          </footer>
        </div>
      </div>
      {folderContextMenu ? (
        <div
          ref={folderContextMenuRef}
          className="media-library-panel-folder-context-menu"
          role="menu"
          aria-label={`${folderContextMenu.folderName} folder actions`}
          style={{
            top: `${folderContextMenu.y}px`,
            left: `${folderContextMenu.x}px`,
          }}
        >
          <button
            type="button"
            className="media-library-panel-folder-context-menu-item"
            role="menuitem"
            onClick={handleContextRename}
          >
            Rename folder
          </button>
          <button
            type="button"
            className="media-library-panel-folder-context-menu-item is-destructive"
            role="menuitem"
            onClick={() => {
              void handleContextDelete();
            }}
          >
            Delete folder
          </button>
        </div>
      ) : null}
      <MediaLibraryPanelPreviewModal
        file={previewModalFile}
        previewUrl={previewModalUrl}
        isLoading={previewModalLoading}
        error={previewModalError}
        onClose={closePreviewModal}
      />
      {pendingLibraryDelete ? (
        <div className="art-confirm-backdrop" onClick={closeDeleteConfirm}>
          <div
            className="art-confirm-card"
            role="dialog"
            aria-modal="true"
            aria-label="Confirm delete from All Media"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="art-confirm-title">Delete from All Media?</p>
            <p className="art-confirm-copy">
              {pendingLibraryDelete.kind === "media"
                ? "This permanently deletes the selected media from your library."
                : "This permanently deletes the selected prompt from your library."}
            </p>
            <div className="art-confirm-actions">
              <button
                type="button"
                className="art-action-btn"
                onClick={closeDeleteConfirm}
                disabled={deleteConfirmSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="art-action-btn art-action-btn-danger"
                onClick={() => {
                  void confirmDeleteFromLibrary();
                }}
                disabled={deleteConfirmSubmitting}
              >
                {deleteConfirmSubmitting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
});
