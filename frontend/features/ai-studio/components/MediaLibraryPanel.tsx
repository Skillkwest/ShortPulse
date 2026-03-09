/**
 * AI Studio Media Library left-panel surface.
 * Provides folder-aware browsing for media + prompts with adaptive preview/signing parity.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  FolderSimple,
  Folders,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  TrashSimple,
  X,
} from "phosphor-react";
import { isAdaptiveSurfaceEnabled } from "../../../lib/adaptive-media";
import {
  MEDIA_PREVIEW_SIGN_BATCH_MAX_ATTEMPTS_PER_ITEM,
  type MediaSignBudget,
} from "../../../lib/mediaPreviewRuntimePolicy";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";
import { useVisibleErrorTelemetry } from "../../../lib/useVisibleErrorTelemetry";
import { useMediaAdaptivePressure } from "../../media-library/hooks/useMediaAdaptivePressure";
import { useMediaPreviewRecoveryController } from "../../media-library/hooks/useMediaPreviewRecoveryController";
import { useMediaPreviewSigningController } from "../../media-library/hooks/useMediaPreviewSigningController";
import { MEDIA_LIBRARY_SIGN_PREFETCH_ENABLED } from "../../media-library/logic/mediaLibraryFeatureFlags";
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
  formatDate,
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
  createMediaFolder,
  deleteMediaFolder,
  fetchMediaPromptListPage,
  listMediaFolders,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
  renameMediaFolder,
  type MediaFolder,
  type MediaFolderId,
  type PromptListCursor,
} from "../logic/mediaLibraryPanelApi";
import { writeMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";
import { MediaLibraryMediaGrid } from "./media-library-modal/MediaLibraryMediaGrid";
import { MediaLibraryPromptGrid } from "./media-library-modal/MediaLibraryPromptGrid";

type MediaLibraryPanelItemType = "all" | "images" | "videos" | "prompts";

type LastPickedItem =
  | { kind: "media"; row: MediaFileRow }
  | { kind: "prompt"; row: PromptRow }
  | null;

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
};

const MEDIA_PAGE_SIZE = 36;
const PROMPT_PAGE_SIZE = 36;
const FOLDERS_REQUEST_TIMEOUT_MS = 12_000;
const ROOT_FOLDER_LABEL = "All Media";
const ROOT_FOLDER: MediaFolder = {
  id: MEDIA_LIBRARY_ROOT_FOLDER_ID,
  name: ROOT_FOLDER_LABEL,
  createdAt: "",
  updatedAt: "",
};

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

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, message: string) =>
  await new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });

export const MediaLibraryPanel = React.memo(function MediaLibraryPanel({
  onSelectMedia,
  onSelectPrompt,
}: MediaLibraryPanelProps) {
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<MediaFolderId>(MEDIA_LIBRARY_ROOT_FOLDER_ID);
  const [itemType] = useState<MediaLibraryPanelItemType>("all");
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
  const [folderError, setFolderError] = useState<string | null>(null);
  const [membershipMessage, setMembershipMessage] = useState<string | null>(null);

  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFolderInput, setShowCreateFolderInput] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [savingFolderEdit, setSavingFolderEdit] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastPickedItem, setLastPickedItem] = useState<LastPickedItem>(null);
  const [assignTargetFolderId, setAssignTargetFolderId] = useState<string>("");

  const signedUrlRetryRef = useRef<Record<string, number>>({});
  const signAttemptRef = useRef<Record<string, number>>({});
  const downloadFallbackInFlightRef = useRef<Record<string, boolean>>({});
  const objectUrlByMediaIdRef = useRef<Record<string, string>>({});
  const currentUserIdRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const mediaRequestTokenRef = useRef(0);
  const promptRequestTokenRef = useRef(0);
  const foldersRequestTokenRef = useRef(0);
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

  const [signPassNonce, setSignPassNonce] = useState(0);
  const [signBudget, setSignBudget] = useState<MediaSignBudget>(resolveModalSignBudget);
  const [optimizerFallbackMediaIds, setOptimizerFallbackMediaIds] = useState<Set<string>>(
    () => new Set()
  );
  const mediaRowsRef = useRef<MediaFileRow[]>([]);
  const promptRowsRef = useRef<PromptRow[]>([]);
  const mediaCursorRef = useRef<MediaListCursor | null>(null);
  const promptCursorRef = useRef<PromptListCursor | null>(null);

  const adaptivePreviewQualityEnabled = isAdaptiveSurfaceEnabled("media-library-modal-grid");
  const mediaAdaptivePressure = useMediaAdaptivePressure({
    surface: "media-library-modal",
    enabled: adaptivePreviewQualityEnabled,
  });

  const normalizedSearch = useMemo(
    () => normalizeMediaSearchTerm(debouncedSearch),
    [debouncedSearch]
  );
  const customFolders = useMemo(
    () =>
      [...folders].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "accent" })
      ),
    [folders]
  );
  const orderedFolders = useMemo(() => [ROOT_FOLDER, ...customFolders], [customFolders]);
  const visiblePromptRows = useMemo(() => sortByCreatedAtDesc(promptRows), [promptRows]);
  const activeCustomFolder = useMemo(
    () => customFolders.find((folder) => folder.id === activeFolderId) ?? null,
    [activeFolderId, customFolders]
  );
  const shouldShowMedia = itemType !== "prompts";
  const shouldShowPrompts = itemType === "prompts" || itemType === "all";
  const activeMediaTab = useMemo<MediaDataTab | null>(() => {
    if (!shouldShowMedia || mediaRows.length === 0) return null;
    return resolveSigningTab(itemType);
  }, [itemType, mediaRows.length, shouldShowMedia]);
  const foldersSplit = useReferenceGridHorizontalSplit({
    enabled: true,
    containerRef: splitContainerRef as React.MutableRefObject<HTMLElement | null>,
    defaultTopRatio: 0.3,
    minTopSectionHeightPx: 128,
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

  const loadFolders = useCallback(async () => {
    const requestToken = foldersRequestTokenRef.current + 1;
    foldersRequestTokenRef.current = requestToken;
    setFolderError(null);
    try {
      const nextFolders = await withTimeout(
        listMediaFolders(),
        FOLDERS_REQUEST_TIMEOUT_MS,
        "Unable to load folders."
      );
      if (foldersRequestTokenRef.current !== requestToken) return;
      if (!isMountedRef.current) return;
      setFolders(nextFolders);
      setActiveFolderId((previous) => {
        if (previous === MEDIA_LIBRARY_ROOT_FOLDER_ID) return previous;
        return nextFolders.some((folder) => folder.id === previous)
          ? previous
          : MEDIA_LIBRARY_ROOT_FOLDER_ID;
      });
    } catch (loadError) {
      if (foldersRequestTokenRef.current !== requestToken) return;
      if (!isMountedRef.current) return;
      setFolderError(loadError instanceof Error ? loadError.message : "Unable to load folders.");
    }
  }, []);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (!customFolders.length) {
      setAssignTargetFolderId("");
      return;
    }
    setAssignTargetFolderId((previous) =>
      customFolders.some((folder) => folder.id === previous) ? previous : customFolders[0].id
    );
  }, [customFolders]);

  useEffect(() => {
    signAttemptRef.current = {};
    setOptimizerFallbackMediaIds(new Set());
  }, [activeFolderId, itemType, normalizedSearch]);

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
        });
        unresolvedInTab.forEach((id) => unresolved.add(id));
      }
      return unresolved;
    },
    [applySignedUrlsToMediaRows]
  );

  const signStoragePath = useCallback(
    (storagePath: string, options?: { forceRefresh?: boolean }): Promise<string | null> =>
      signMediaStoragePath(storagePath, options),
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
    surface: "media-library-modal",
    unresolvedWarningPrefix: "[media-library-modal]",
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
          surface: "media-library-modal",
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
    setSelectedIds(new Set());
    setLastPickedItem(null);
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
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.add(prompt.id);
        return next;
      });
      setLastPickedItem({ kind: "prompt", row: prompt });
      onSelectPrompt({
        id: prompt.id,
        promptText: prompt.prompt_text,
        title: prompt.title,
      });
    },
    [onSelectPrompt]
  );

  const handleSelectMediaFile = useCallback(
    async (file: MediaFileRow) => {
      const nextUrl =
        (await resolveSignedSelectionUrl({
          row: file,
          currentUserId: currentUserIdRef.current,
          signStoragePath,
        })) ??
        (await refreshSignedUrl(file)) ??
        file.signedUrl;
      if (!nextUrl) return;
      const previewStoragePath = file.preview_storage_path ?? file.storage_path;
      const fullStoragePath = file.storage_path;
      const previewUrl = file.signedUrl ?? nextUrl;
      const fullUrl = nextUrl;
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.add(file.id);
        return next;
      });
      setLastPickedItem({ kind: "media", row: file });
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
    },
    [onSelectMedia, refreshSignedUrl, signStoragePath]
  );

  const handleCreateFolder = useCallback(async () => {
    const name = newFolderName.trim();
    if (!name || creatingFolder) return;
    setCreatingFolder(true);
    setFolderError(null);
    try {
      const folder = await createMediaFolder(name);
      setFolders((previous) => [...previous, folder]);
      setNewFolderName("");
      setShowCreateFolderInput(false);
      setActiveFolderId(folder.id);
    } catch (createError) {
      setFolderError(
        createError instanceof Error ? createError.message : "Unable to create folder."
      );
    } finally {
      setCreatingFolder(false);
    }
  }, [creatingFolder, newFolderName]);

  const handleCommitFolderRename = useCallback(async () => {
    const folderId = editingFolderId;
    const nextName = editingFolderName.trim();
    if (!folderId || !nextName || savingFolderEdit) return;
    setSavingFolderEdit(true);
    setFolderError(null);
    try {
      const renamed = await renameMediaFolder({ folderId, name: nextName });
      setFolders((previous) =>
        previous.map((folder) =>
          folder.id === folderId ? { ...folder, name: renamed.name } : folder
        )
      );
      setEditingFolderId(null);
      setEditingFolderName("");
    } catch (renameError) {
      setFolderError(
        renameError instanceof Error ? renameError.message : "Unable to rename folder."
      );
    } finally {
      setSavingFolderEdit(false);
    }
  }, [editingFolderId, editingFolderName, savingFolderEdit]);

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      const target = folders.find((folder) => folder.id === folderId);
      if (!target) return;
      const confirmed = window.confirm(
        `Delete folder "${target.name}"? Items will stay in your library.`
      );
      if (!confirmed) return;
      setFolderError(null);
      try {
        await deleteMediaFolder(folderId);
        setFolders((previous) => previous.filter((folder) => folder.id !== folderId));
        if (activeFolderId === folderId) {
          setActiveFolderId(MEDIA_LIBRARY_ROOT_FOLDER_ID);
        }
      } catch (deleteError) {
        setFolderError(
          deleteError instanceof Error ? deleteError.message : "Unable to delete folder."
        );
      }
    },
    [activeFolderId, folders]
  );

  const handleAssignLastPicked = useCallback(async () => {
    if (!lastPickedItem) return;
    if (!assignTargetFolderId) return;
    setMembershipMessage(null);
    setFolderError(null);
    try {
      await applyMediaFolderMembershipBatch({
        folderId: assignTargetFolderId,
        action: "assign",
        mediaIds: lastPickedItem.kind === "media" ? [lastPickedItem.row.id] : [],
        promptIds: lastPickedItem.kind === "prompt" ? [lastPickedItem.row.id] : [],
      });
      const targetFolderName =
        customFolders.find((folder) => folder.id === assignTargetFolderId)?.name || "folder";
      setMembershipMessage(`Added to ${targetFolderName}.`);
    } catch (membershipError) {
      setFolderError(
        membershipError instanceof Error
          ? membershipError.message
          : "Unable to update folder membership."
      );
    }
  }, [assignTargetFolderId, customFolders, lastPickedItem]);

  const handleUnassignLastPicked = useCallback(async () => {
    if (!lastPickedItem) return;
    if (activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
    setMembershipMessage(null);
    setFolderError(null);
    try {
      await applyMediaFolderMembershipBatch({
        folderId: activeFolderId,
        action: "unassign",
        mediaIds: lastPickedItem.kind === "media" ? [lastPickedItem.row.id] : [],
        promptIds: lastPickedItem.kind === "prompt" ? [lastPickedItem.row.id] : [],
      });
      setMembershipMessage("Removed from this folder.");
      if (lastPickedItem.kind === "media") {
        setMediaRows((previous) => previous.filter((row) => row.id !== lastPickedItem.row.id));
      } else {
        setPromptRows((previous) => previous.filter((row) => row.id !== lastPickedItem.row.id));
      }
      setLastPickedItem(null);
    } catch (membershipError) {
      setFolderError(
        membershipError instanceof Error
          ? membershipError.message
          : "Unable to update folder membership."
      );
    }
  }, [activeFolderId, lastPickedItem]);

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
    },
    []
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
          title: prompt.title,
        },
      });
      event.dataTransfer.effectAllowed = "copy";
      event.dataTransfer.setData("text/prompt", promptText);
      event.dataTransfer.setData("text/plain", promptText);
      event.currentTarget.classList.add("is-dragging");
    },
    []
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLButtonElement>) => {
    event.currentTarget.classList.remove("is-dragging");
  }, []);

  const isRootFolderSelected = activeFolderId === MEDIA_LIBRARY_ROOT_FOLDER_ID;
  const canAssignPickedItem =
    isRootFolderSelected && Boolean(lastPickedItem) && Boolean(assignTargetFolderId);
  const canUnassignPickedItem = !isRootFolderSelected && Boolean(lastPickedItem);

  return (
    <section className="media-library-panel" aria-label="Media library panel">
      <header className="media-library-panel-header">
        <div>
          <p className="eyebrow">Media Library</p>
          <p className="tiny subdued helper-text">
            Drag references to the grid or click to add instantly.
          </p>
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
                    className={`media-library-panel-folder-strip-item ${isEditing ? "is-editing" : ""}`}
                    role="listitem"
                  >
                    {isEditing ? (
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
                              void handleCommitFolderRename();
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setEditingFolderId(null);
                              setEditingFolderName("");
                            }
                          }}
                        />
                        <div className="media-library-panel-folder-chip-actions">
                          <button
                            type="button"
                            aria-label="Save folder name"
                            onClick={() => {
                              void handleCommitFolderRename();
                            }}
                            disabled={savingFolderEdit}
                          >
                            <Check size={12} weight="bold" />
                          </button>
                          <button
                            type="button"
                            aria-label="Cancel folder rename"
                            onClick={() => {
                              setEditingFolderId(null);
                              setEditingFolderName("");
                            }}
                            disabled={savingFolderEdit}
                          >
                            <X size={12} weight="bold" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={`media-library-panel-folder-chip ${isActive ? "is-active" : ""}`}
                          onClick={() => setActiveFolderId(folder.id)}
                          onDoubleClick={() => {
                            if (isRoot) return;
                            setEditingFolderId(folder.id);
                            setEditingFolderName(folder.name);
                          }}
                          aria-label={`${folder.name} folder`}
                        >
                          <FolderSimple
                            size={32}
                            weight={isActive ? "fill" : "regular"}
                            aria-hidden
                          />
                        </button>
                        <p className="media-library-panel-folder-chip-name tiny">{folder.name}</p>
                      </>
                    )}
                  </div>
                );
              })}
              <div
                className={`media-library-panel-folder-strip-item ${showCreateFolderInput ? "is-editing" : ""}`}
                role="listitem"
              >
                {showCreateFolderInput ? (
                  <div className="media-library-panel-folder-chip-edit">
                    <input
                      type="text"
                      className="media-library-panel-folder-chip-input"
                      placeholder="Folder name"
                      value={newFolderName}
                      maxLength={64}
                      autoFocus
                      onChange={(event) => setNewFolderName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleCreateFolder();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          setShowCreateFolderInput(false);
                          setNewFolderName("");
                        }
                      }}
                    />
                    <div className="media-library-panel-folder-chip-actions">
                      <button
                        type="button"
                        className="media-library-panel-folder-create-btn"
                        onClick={() => {
                          void handleCreateFolder();
                        }}
                        disabled={creatingFolder}
                        aria-label="Create folder"
                      >
                        <Check size={12} weight="bold" />
                      </button>
                      <button
                        type="button"
                        aria-label="Cancel folder create"
                        onClick={() => {
                          setShowCreateFolderInput(false);
                          setNewFolderName("");
                        }}
                        disabled={creatingFolder}
                      >
                        <X size={12} weight="bold" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="media-library-panel-folder-chip is-create"
                      aria-label="Create new folder"
                      onClick={() => setShowCreateFolderInput(true)}
                    >
                      <Plus size={30} weight="bold" aria-hidden />
                    </button>
                    <p className="media-library-panel-folder-chip-name tiny">New Folder</p>
                  </>
                )}
              </div>
            </div>
            {activeCustomFolder && !editingFolderId ? (
              <div className="media-library-panel-folder-active-actions">
                <button
                  type="button"
                  aria-label="Rename active folder"
                  onClick={() => {
                    setEditingFolderId(activeCustomFolder.id);
                    setEditingFolderName(activeCustomFolder.name);
                  }}
                >
                  <PencilSimple size={13} weight="bold" />
                  Rename
                </button>
                <button
                  type="button"
                  aria-label="Delete active folder"
                  onClick={() => {
                    void handleDeleteFolder(activeCustomFolder.id);
                  }}
                >
                  <TrashSimple size={13} weight="bold" />
                  Delete
                </button>
              </div>
            ) : null}
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
          <div className="media-library-panel-membership-controls">
            {canAssignPickedItem ? (
              <>
                <select
                  className="media-library-panel-folder-select"
                  value={assignTargetFolderId}
                  onChange={(event) => setAssignTargetFolderId(event.target.value)}
                >
                  {customFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ghost-btn mini"
                  onClick={() => {
                    void handleAssignLastPicked();
                  }}
                >
                  Add Picked Item To Folder
                </button>
              </>
            ) : null}
            {canUnassignPickedItem ? (
              <button
                type="button"
                className="ghost-btn mini"
                onClick={() => {
                  void handleUnassignLastPicked();
                }}
              >
                Remove Picked Item From Folder
              </button>
            ) : null}
          </div>
          {membershipMessage ? <p className="tiny subdued">{membershipMessage}</p> : null}

          <div className="media-library-panel-body" ref={panelBodyRef}>
            {error ? <p className="tiny subdued">{error}</p> : null}

            {shouldShowPrompts ? (
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
                {visiblePromptRows.length > 0 ? (
                  <MediaLibraryPromptGrid
                    prompts={visiblePromptRows}
                    sortedPrompts={visiblePromptRows}
                    selectedIds={selectedIds}
                    onSelectPromptCard={handleSelectPromptCard}
                    onPromptDragStart={handlePromptCardDragStart}
                    onPromptDragEnd={handleCardDragEnd}
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
              </section>
            ) : null}

            {shouldShowMedia ? (
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
                {mediaRows.length > 0 ? (
                  <MediaLibraryMediaGrid
                    activeMedia={mediaRows}
                    selectedIds={selectedIds}
                    optimizerFallbackMediaIds={optimizerFallbackMediaIds}
                    adaptivePressureLevel={mediaAdaptivePressure.previewPressureLevel}
                    adaptivePreviewQualityEnabled={adaptivePreviewQualityEnabled}
                    scrollContainerRef={panelBodyRef as React.MutableRefObject<HTMLElement | null>}
                    getMediaCardRef={getMediaCardRef}
                    onSelectMediaFile={(file) => {
                      void handleSelectMediaFile(file);
                    }}
                    onMediaDragStart={handleMediaCardDragStart}
                    onMediaDragEnd={handleCardDragEnd}
                    onMediaPreviewError={handleMediaPreviewError}
                    onMediaPaint={() => undefined}
                    onSignedUrlLoaded={(id) => {
                      signedUrlRetryRef.current[id] = 0;
                    }}
                  />
                ) : null}
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
              </section>
            ) : null}
          </div>

          <footer className="media-library-panel-footer">
            <p className="tiny subdued">
              Active folder:{" "}
              {orderedFolders.find((folder) => folder.id === activeFolderId)?.name ||
                ROOT_FOLDER_LABEL}
            </p>
            {lastPickedItem ? (
              <p className="tiny subdued">
                Picked:{" "}
                {lastPickedItem.kind === "media"
                  ? lastPickedItem.row.filename
                  : lastPickedItem.row.title || formatDate(lastPickedItem.row.created_at)}
              </p>
            ) : null}
          </footer>
        </div>
      </div>
    </section>
  );
});
