/**
 * Reference grid for saved outputs and uploads.
 * Supports drag/drop into other surfaces and exposes a detail action on double click.
 */
import React, { useCallback, useState } from "react";
import {
  ArrowClockwise,
  CheckCircle,
  CloudArrowUp,
  DownloadSimple,
  FloppyDisk,
  UploadSimple,
  X,
} from "phosphor-react";
import { PromptLibraryButton } from "./PromptLibraryButton";
import { StudioOutput } from "../types";
import { clearDragState, prepareReferenceDrag } from "../utils/dragDrop";
import type { ToolId } from "../types";
import { logMediaPerf } from "../../../lib/mediaPerfTelemetry";

const isVideoUrl = (url: string) =>
  /\.mp4(\?|$)/i.test(url) || url.includes("/video") || url.includes("video=");

const REFERENCE_VIRTUAL_OVERSCAN_ROWS = 4;
const REFERENCE_VIRTUALIZE_MIN_ITEMS = 80;
const FALLBACK_REFERENCE_ROW_HEIGHT = 220;
const REFERENCE_GRID_MIN_CARD_PX = 160;
const REFERENCE_GRID_MIN_CARD_PX_WIDE = 160;
const REFERENCE_GRID_MIN_COLUMNS = 2;
const REFERENCE_GRID_MAX_COLUMNS = 5;
const REFERENCE_GRID_MAX_COLUMNS_WIDE = 8;
const REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;
const REFERENCE_AUTOPLAY_MAX_DESKTOP = 4;
const REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN = 2;
const REFERENCE_AUTOPLAY_MAX_CONSTRAINED = 1;
const REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY = "(max-width: 900px)";
const REFERENCE_AUTOPLAY_DETACH_DELAY_MS = 1400;

type NavigatorWithConnection = Navigator & {
  deviceMemory?: number;
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
  };
};

type PastedMediaReference = {
  url: string;
  mimeType?: string | null;
};

type ClipboardMediaUrlReference = {
  url: string;
  mimeType?: string | null;
};

const IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const VIDEO_URL_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:[?#].*)?$/i;
const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};
const VIDEO_EXTENSION_TO_MIME: Record<string, string> = {
  m4v: "video/mp4",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogg: "video/ogg",
  ogv: "video/ogg",
  webm: "video/webm",
};

// Temporary UI experiment: set false to revert selection outline theming to default create-blue.
const ENABLE_TOOL_THEMED_SELECTION_OUTLINE = true;

type ReferenceSelectionTheme = "create" | "edit" | "video";

const resolveReferenceSelectionTheme = (selectedTool: ToolId | null): ReferenceSelectionTheme => {
  if (!ENABLE_TOOL_THEMED_SELECTION_OUTLINE) return "create";
  if (selectedTool === "image" || selectedTool === "edit") return "edit";
  if (selectedTool === "video" || selectedTool === "kling") return "video";
  return "create";
};

const areIdListsEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const normalizeClipboardText = (value: string): string => value.trim();

const parseUrlCandidate = (value: string): string | null => {
  const candidate = normalizeClipboardText(value);
  if (!candidate || (typeof window !== "undefined" && candidate === window.location.href))
    return null;
  if (/^data:(image|video)\//i.test(candidate)) return candidate;
  if (/^blob:/i.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const isMediaUrl = (url: string): boolean =>
  /^data:(image|video)\//i.test(url) || IMAGE_URL_PATTERN.test(url) || VIDEO_URL_PATTERN.test(url);

const extractDroppedPromptText = (transfer: DataTransfer): string | null => {
  const promptText = normalizeClipboardText(
    transfer.getData("text/prompt") || transfer.getData("text/plain")
  );
  if (!promptText) return null;
  const parsedUrl = parseUrlCandidate(promptText);
  if (parsedUrl && isMediaUrl(parsedUrl)) return null;
  return promptText;
};

const inferMimeTypeFromFilename = (filename: string): string | null => {
  const normalized = filename.trim().toLowerCase();
  const extension = normalized.includes(".") ? (normalized.split(".").pop() ?? "") : "";
  if (!extension) return null;
  return IMAGE_EXTENSION_TO_MIME[extension] ?? VIDEO_EXTENSION_TO_MIME[extension] ?? null;
};

const normalizeMediaMimeType = (mimeType: string | null | undefined): string | null => {
  if (!mimeType) return null;
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith("image/") || normalized.startsWith("video/") ? normalized : null;
};

const normalizeMediaFile = (
  file: File | null,
  fallbackMimeType?: string | null,
  index: number = 0
): File | null => {
  if (!file) return null;
  const resolvedMimeType =
    normalizeMediaMimeType(file.type) ??
    normalizeMediaMimeType(fallbackMimeType) ??
    inferMimeTypeFromFilename(file.name);
  if (!resolvedMimeType) return null;
  if (file.type === resolvedMimeType && file.type.length > 0) {
    return file;
  }
  const extension =
    Object.entries({ ...IMAGE_EXTENSION_TO_MIME, ...VIDEO_EXTENSION_TO_MIME }).find(
      ([, mimeType]) => mimeType === resolvedMimeType
    )?.[0] ?? (resolvedMimeType.startsWith("image/") ? "png" : "mp4");
  const normalizedName = file.name?.trim() || `pasted-media-${index + 1}.${extension}`;
  return new File([file], normalizedName, {
    type: resolvedMimeType,
    lastModified: file.lastModified,
  });
};

const dedupeMediaFiles = (files: File[]): File[] => {
  const seen = new Set<string>();
  const deduped: File[] = [];
  files.forEach((file) => {
    const signature = `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    deduped.push(file);
  });
  return deduped;
};

const collectClipboardMediaFiles = (clipboardData: DataTransfer): File[] => {
  const clipboardItems = Array.from(clipboardData.items || []);
  const directFiles = Array.from(clipboardData.files || [])
    .map((file, index) => normalizeMediaFile(file, clipboardItems[index]?.type, index))
    .filter((file): file is File => Boolean(file));
  if (directFiles.length > 0) {
    return dedupeMediaFiles(directFiles);
  }
  const itemFiles = clipboardItems
    .filter((item) => item.kind === "file")
    .map((item, index) => normalizeMediaFile(item.getAsFile(), item.type, index))
    .filter((file): file is File => Boolean(file));
  return dedupeMediaFiles(itemFiles);
};

const getMediaReferenceFromUriList = (uriList: string): ClipboardMediaUrlReference | null => {
  const entries = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  for (const entry of entries) {
    const parsed = parseUrlCandidate(entry);
    if (parsed && isMediaUrl(parsed)) {
      return {
        url: parsed,
        mimeType: inferClipboardMimeTypeFromUrl(parsed),
      };
    }
  }
  return null;
};

const getMediaReferenceFromHtml = (html: string): ClipboardMediaUrlReference | null => {
  const trimmed = html.trim();
  if (!trimmed) return null;
  if (typeof DOMParser === "undefined") return null;
  const documentFragment = new DOMParser().parseFromString(trimmed, "text/html");
  const candidateNodes = Array.from(
    documentFragment.querySelectorAll("img[src],video[src],source[src],a[href]")
  );
  for (const node of candidateNodes) {
    const tagName = node.tagName.toLowerCase();
    const raw =
      node.getAttribute("src") ??
      node.getAttribute("href") ??
      (node instanceof HTMLAnchorElement ? node.href : "");
    if (!raw) continue;
    const parsed = parseUrlCandidate(raw);
    if (!parsed) continue;
    const declaredMimeType = normalizeMediaMimeType(node.getAttribute("type"));
    if (tagName === "img") {
      return { url: parsed, mimeType: declaredMimeType ?? "image/*" };
    }
    if (tagName === "video" || tagName === "source") {
      return { url: parsed, mimeType: declaredMimeType ?? "video/*" };
    }
    if (isMediaUrl(parsed)) {
      return {
        url: parsed,
        mimeType: declaredMimeType ?? inferClipboardMimeTypeFromUrl(parsed),
      };
    }
  }
  return null;
};

const inferClipboardMimeTypeFromUrl = (url: string): string | null => {
  if (/^data:image\//i.test(url)) {
    const mime = url.slice(5, url.indexOf(";"));
    return mime || "image/*";
  }
  if (/^data:video\//i.test(url)) {
    const mime = url.slice(5, url.indexOf(";"));
    return mime || "video/*";
  }
  if (VIDEO_URL_PATTERN.test(url)) return "video/*";
  if (IMAGE_URL_PATTERN.test(url)) return "image/*";
  return null;
};

const isEditableElement = (element: HTMLElement | null): boolean => {
  if (!element) return false;
  if (element.isContentEditable) return true;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.getAttribute("role") === "textbox"
  );
};

const getReferencePasteSurfaces = (panelNode: HTMLDivElement): HTMLElement[] => {
  const surfaces: HTMLElement[] = [panelNode];
  const referenceColumnNode = panelNode.closest(".reference-column");
  if (referenceColumnNode instanceof HTMLElement) {
    surfaces.push(referenceColumnNode);
  }
  const shellRightNode = panelNode.closest(".ai-shell-right");
  if (shellRightNode instanceof HTMLElement) {
    surfaces.push(shellRightNode);
  }
  return surfaces;
};

const isNodeInsideAnySurface = (targetNode: Node | null, surfaces: HTMLElement[]): boolean =>
  Boolean(targetNode && surfaces.some((surface) => surface.contains(targetNode)));

export type ReferenceCanvasProps = {
  outputs: StudioOutput[];
  activeOutputId: string | null;
  showHeader?: boolean;
  onOutputMediaLoaded?: (id: string) => void;
  linkedPromptReferenceIds?: string[];
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  selectedTool: ToolId | null;
  showPromptGenerate?: boolean;
  disablePromptGenerate?: boolean;
  onDropFiles?: (files: FileList) => void;
  onPasteTextReference?: (text: string) => void;
  onPasteMediaReference?: (reference: PastedMediaReference) => void;
  onTriggerFileSelect?: () => void;
  onOpenMediaLibrary?: () => void;
  onDescribeImage?: (output: StudioOutput) => void;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onGeneratePrompt?: (output: StudioOutput) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  generateCostCredits?: number | null;
};

/**
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
export function ReferenceCanvas({
  outputs,
  activeOutputId,
  showHeader = true,
  onOutputMediaLoaded,
  linkedPromptReferenceIds = [],
  onSelectOutput,
  onOpenDetails,
  selectedTool,
  showPromptGenerate = true,
  disablePromptGenerate = false,
  onDropFiles,
  onPasteTextReference,
  onPasteMediaReference,
  onTriggerFileSelect,
  onOpenMediaLibrary,
  onDescribeImage,
  onSaveToLibrary,
  onDownload,
  onGeneratePrompt,
  onRetryStatus,
  onDeleteOutput,
  generateCostCredits,
}: ReferenceCanvasProps) {
  const selectionTheme = resolveReferenceSelectionTheme(selectedTool);
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const loadedIdsRef = React.useRef<Set<string>>(new Set());
  const autoplayingIdsRef = React.useRef<Set<string>>(new Set());
  const lastScrollSampleAtRef = React.useRef(0);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const videoVisibilityIdSetRef = React.useRef<Set<string>>(new Set());
  const videoNodeByIdRef = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoDetachTimeoutByIdRef = React.useRef<Map<string, number>>(new Map());
  const videoIntersectionObserverRef = React.useRef<IntersectionObserver | null>(null);
  const isPointerOverPanelRef = React.useRef(false);
  const isPastePrimedRef = React.useRef(false);
  const lastPasteFingerprintRef = React.useRef<{ value: string; at: number } | null>(null);
  const autoplayBudgetRef = React.useRef<number>(REFERENCE_AUTOPLAY_MAX_DESKTOP);
  const [autoplayEnabledIds, setAutoplayEnabledIds] = useState<string[]>([]);
  const [virtualMetrics, setVirtualMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 5,
    rowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
  });
  const autoplayEnabledIdSet = React.useMemo(
    () => new Set(autoplayEnabledIds),
    [autoplayEnabledIds]
  );
  const linkedPromptReferenceIdSet = React.useMemo(
    () => new Set(linkedPromptReferenceIds),
    [linkedPromptReferenceIds]
  );
  const normalizeMediaFiles = useCallback((files: File[]): File[] => {
    return dedupeMediaFiles(
      files
        .map((file, index) => normalizeMediaFile(file, null, index))
        .filter((file): file is File => Boolean(file))
    );
  }, []);

  const buildFileList = useCallback((files: File[]): FileList | null => {
    if (files.length === 0) return null;
    if (typeof DataTransfer !== "undefined") {
      const transfer = new DataTransfer();
      files.forEach((file) => transfer.items.add(file));
      return transfer.files;
    }
    const fallback = files.reduce<Record<number, File>>((acc, file, index) => {
      acc[index] = file;
      return acc;
    }, {});
    return {
      ...fallback,
      length: files.length,
      item: (index: number) => files[index] ?? null,
    } as unknown as FileList;
  }, []);

  const syncVirtualMetrics = useCallback(() => {
    const scrollNode = scrollContainerRef.current;
    const gridNode = gridRef.current;
    if (!scrollNode || !gridNode) return;
    const maxColumns = selectedTool ? REFERENCE_GRID_MAX_COLUMNS : REFERENCE_GRID_MAX_COLUMNS_WIDE;
    const minCardWidth = selectedTool
      ? REFERENCE_GRID_MIN_CARD_PX
      : REFERENCE_GRID_MIN_CARD_PX_WIDE;
    const style = window.getComputedStyle(gridNode);
    const rowGap = Number.parseFloat(style.rowGap || style.gap || "0");
    const gap = Number.isFinite(rowGap) ? rowGap : 3;
    const paddingLeft = Number.parseFloat(style.paddingLeft || "0") || 0;
    const paddingRight = Number.parseFloat(style.paddingRight || "0") || 0;
    const gridWidth = Math.max(0, gridNode.clientWidth - paddingLeft - paddingRight);
    const estimatedColumnCount =
      gridWidth > 0 ? Math.floor((gridWidth + gap) / (minCardWidth + gap)) : 1;
    const columnCount = Math.max(
      REFERENCE_GRID_MIN_COLUMNS,
      Math.min(maxColumns, estimatedColumnCount || REFERENCE_GRID_MIN_COLUMNS)
    );
    const cardWidth =
      columnCount > 0 ? Math.max(0, (gridWidth - gap * (columnCount - 1)) / columnCount) : 0;
    const cardHeight = cardWidth > 0 ? (cardWidth * 5) / 4 : FALLBACK_REFERENCE_ROW_HEIGHT;
    const rowHeight = Math.max(1, cardHeight + gap);
    setVirtualMetrics((prev) => {
      const next = {
        scrollTop: scrollNode.scrollTop,
        viewportHeight: scrollNode.clientHeight,
        columnCount,
        rowHeight,
      };
      const stable =
        Math.abs(prev.scrollTop - next.scrollTop) < 1 &&
        Math.abs(prev.viewportHeight - next.viewportHeight) < 1 &&
        prev.columnCount === next.columnCount &&
        Math.abs(prev.rowHeight - next.rowHeight) < 1;
      return stable ? prev : next;
    });
  }, [selectedTool]);

  const gridStyle = React.useMemo(
    () =>
      ({
        "--reference-grid-columns": String(
          Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount)
        ),
      }) as React.CSSProperties,
    [virtualMetrics.columnCount]
  );

  const shouldVirtualize = outputs.length >= REFERENCE_VIRTUALIZE_MIN_ITEMS;
  const effectiveViewportHeight =
    virtualMetrics.viewportHeight > 0
      ? virtualMetrics.viewportHeight
      : FALLBACK_REFERENCE_ROW_HEIGHT * 5;
  const totalRows = Math.max(
    1,
    Math.ceil(outputs.length / Math.max(1, virtualMetrics.columnCount))
  );
  const startRow = shouldVirtualize
    ? Math.min(
        totalRows - 1,
        Math.max(
          0,
          Math.floor(virtualMetrics.scrollTop / virtualMetrics.rowHeight) -
            REFERENCE_VIRTUAL_OVERSCAN_ROWS
        )
      )
    : 0;
  const endRow = shouldVirtualize
    ? Math.min(
        totalRows - 1,
        Math.ceil((virtualMetrics.scrollTop + effectiveViewportHeight) / virtualMetrics.rowHeight) +
          REFERENCE_VIRTUAL_OVERSCAN_ROWS
      )
    : totalRows - 1;
  const startIndex = Math.max(0, startRow * virtualMetrics.columnCount);
  const endIndex = Math.min(outputs.length, (endRow + 1) * virtualMetrics.columnCount);
  const visibleOutputs = shouldVirtualize ? outputs.slice(startIndex, endIndex) : outputs;
  const topSpacerHeight = shouldVirtualize ? startRow * virtualMetrics.rowHeight : 0;
  const bottomSpacerHeight = shouldVirtualize
    ? Math.max(0, (totalRows - endRow - 1) * virtualMetrics.rowHeight)
    : 0;
  const renderedItemCount = visibleOutputs.length;
  const renderedOutputIdSet = React.useMemo(
    () => new Set(visibleOutputs.map((output) => output.id)),
    [visibleOutputs]
  );
  const recomputeAutoplayBudget = useCallback(() => {
    const visibleVideoIds = outputs
      .filter((output) => {
        if (!output.previewUrl || !isVideoUrl(output.previewUrl)) return false;
        return videoVisibilityIdSetRef.current.has(output.id);
      })
      .map((output) => output.id);
    const nextEnabled = visibleVideoIds.slice(0, autoplayBudgetRef.current);
    setAutoplayEnabledIds((prev) => (areIdListsEqual(prev, nextEnabled) ? prev : nextEnabled));
  }, [outputs]);

  const registerVideoNode = useCallback(
    (id: string, node: HTMLVideoElement | null) => {
      const currentNode = videoNodeByIdRef.current.get(id);
      if (currentNode && currentNode !== node) {
        videoIntersectionObserverRef.current?.unobserve(currentNode);
        videoNodeByIdRef.current.delete(id);
      }
      if (!node) {
        const detachTimeout = videoDetachTimeoutByIdRef.current.get(id);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByIdRef.current.delete(id);
        }
        if (videoVisibilityIdSetRef.current.delete(id)) {
          recomputeAutoplayBudget();
        }
        return;
      }
      node.dataset.outputId = id;
      videoNodeByIdRef.current.set(id, node);
      videoIntersectionObserverRef.current?.observe(node);
    },
    [recomputeAutoplayBudget]
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = navigator as NavigatorWithConnection;
    const connection = nav.connection as
      | {
          addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
          removeEventListener?: (
            type: string,
            listener: EventListenerOrEventListenerObject
          ) => void;
        }
      | undefined;
    const refreshBudget = () => {
      const isSmallScreen = window.matchMedia(REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY).matches;
      const saveData = nav.connection?.saveData === true;
      const effectiveType = (nav.connection?.effectiveType ?? "").toLowerCase();
      const isSlowNetwork = effectiveType.includes("2g");
      const isLowMemory = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      if (saveData || isSlowNetwork || isLowMemory) {
        autoplayBudgetRef.current = REFERENCE_AUTOPLAY_MAX_CONSTRAINED;
      } else {
        autoplayBudgetRef.current = isSmallScreen
          ? REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN
          : REFERENCE_AUTOPLAY_MAX_DESKTOP;
      }
      recomputeAutoplayBudget();
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    connection?.addEventListener?.("change", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
      connection?.removeEventListener?.("change", refreshBudget);
    };
  }, [recomputeAutoplayBudget]);

  React.useEffect(() => {
    const validOutputIdSet = new Set(outputs.map((output) => output.id));
    let removedAny = false;
    videoVisibilityIdSetRef.current.forEach((id) => {
      if (!validOutputIdSet.has(id)) {
        videoVisibilityIdSetRef.current.delete(id);
        removedAny = true;
      }
    });
    videoDetachTimeoutByIdRef.current.forEach((timeoutId, id) => {
      if (validOutputIdSet.has(id)) return;
      window.clearTimeout(timeoutId);
      videoDetachTimeoutByIdRef.current.delete(id);
    });
    if (removedAny) {
      recomputeAutoplayBudget();
    }
  }, [outputs, recomputeAutoplayBudget]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    syncVirtualMetrics();
    const scrollNode = scrollContainerRef.current;
    const gridNode = gridRef.current;
    if (!scrollNode || !gridNode) return;
    const handleResize = () => syncVirtualMetrics();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncVirtualMetrics()) : null;
    observer?.observe(scrollNode);
    observer?.observe(gridNode);
    window.addEventListener("resize", handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [outputs.length, selectedTool, syncVirtualMetrics]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const root = scrollContainerRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;
        entries.forEach((entry) => {
          const id = (entry.target as HTMLElement).dataset.outputId;
          if (!id) return;
          const isVisible =
            entry.isIntersecting &&
            entry.intersectionRatio >= REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD;
          if (isVisible) {
            if (!videoVisibilityIdSetRef.current.has(id)) {
              videoVisibilityIdSetRef.current.add(id);
              changed = true;
            }
            return;
          }
          if (videoVisibilityIdSetRef.current.delete(id)) {
            changed = true;
          }
        });
        if (changed) {
          recomputeAutoplayBudget();
        }
      },
      {
        root,
        threshold: [0, REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD, 1],
      }
    );
    videoIntersectionObserverRef.current = observer;
    videoNodeByIdRef.current.forEach((node) => observer.observe(node));
    return () => {
      observer.disconnect();
      videoIntersectionObserverRef.current = null;
    };
  }, [recomputeAutoplayBudget]);

  React.useEffect(() => {
    const validOutputIds = shouldVirtualize
      ? renderedOutputIdSet
      : new Set(outputs.map((output) => output.id));
    autoplayingIdsRef.current.forEach((id) => {
      if (!validOutputIds.has(id)) {
        autoplayingIdsRef.current.delete(id);
      }
    });
  }, [outputs, renderedOutputIdSet, shouldVirtualize]);

  React.useEffect(() => {
    const enabledSet = new Set(autoplayEnabledIds);
    videoNodeByIdRef.current.forEach((node, id) => {
      if (enabledSet.has(id)) {
        const detachTimeout = videoDetachTimeoutByIdRef.current.get(id);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByIdRef.current.delete(id);
        }
        return;
      }
      node.pause();
      if (videoDetachTimeoutByIdRef.current.has(id)) return;
      const timeoutId = window.setTimeout(() => {
        if (autoplayEnabledIdSet.has(id)) return;
        node.pause();
        node.removeAttribute("src");
        node.load();
        autoplayingIdsRef.current.delete(id);
        videoDetachTimeoutByIdRef.current.delete(id);
      }, REFERENCE_AUTOPLAY_DETACH_DELAY_MS);
      videoDetachTimeoutByIdRef.current.set(id, timeoutId);
    });
  }, [autoplayEnabledIdSet, autoplayEnabledIds]);

  React.useEffect(() => {
    const detachTimeoutById = videoDetachTimeoutByIdRef.current;
    return () => {
      detachTimeoutById.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      detachTimeoutById.clear();
    };
  }, []);

  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      setLoadedMap((prev) => {
        if (prev[id]) return prev;
        return { ...prev, [id]: true };
      });
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [onOutputMediaLoaded]
  );

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    // Ignore drops that originate from existing reference cards to avoid creating duplicates/empties.
    const internalRefId = event.dataTransfer.getData("text/reference-id");
    if (internalRefId) {
      event.preventDefault();
      return;
    }
    const files = event.dataTransfer.files;
    if (files && files.length > 0 && onDropFiles) {
      const mediaFiles = normalizeMediaFiles(Array.from(files));
      if (mediaFiles.length === 0) return;
      const fileList = buildFileList(mediaFiles);
      if (!fileList) return;
      event.preventDefault();
      onDropFiles(fileList);
      return;
    }

    const droppedPromptText = extractDroppedPromptText(event.dataTransfer);
    if (!droppedPromptText || !onPasteTextReference) return;
    event.preventDefault();
    onPasteTextReference(droppedPromptText);
  };

  const handleCanvasDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (
      event.dataTransfer.types.includes("Files") ||
      event.dataTransfer.types.includes("text/prompt") ||
      event.dataTransfer.types.includes("text/plain")
    ) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const consumeClipboardData = useCallback(
    (clipboardData: DataTransfer | null): boolean => {
      if (!clipboardData) return false;
      const fingerprint = [
        Array.from(clipboardData.types || []).join(","),
        Array.from(clipboardData.files || [])
          .map((file) => `${file.name}|${file.size}|${file.type}`)
          .join(";"),
        normalizeClipboardText(clipboardData.getData("text/uri-list")).slice(0, 220),
        normalizeClipboardText(clipboardData.getData("text/plain")).slice(0, 220),
      ].join("::");
      const now = Date.now();
      const lastPaste = lastPasteFingerprintRef.current;
      if (lastPaste && lastPaste.value === fingerprint && now - lastPaste.at < 250) {
        return true;
      }
      const markHandled = () => {
        lastPasteFingerprintRef.current = { value: fingerprint, at: now };
      };

      // Priority 1: actual binary media in clipboard. Never fan this out to multiple cards.
      if (onDropFiles) {
        const mediaFiles = collectClipboardMediaFiles(clipboardData);
        const fileList = buildFileList(mediaFiles);
        if (fileList) {
          onDropFiles(fileList);
          markHandled();
          return true;
        }
      }

      // Priority 2: media URL payload from URI list / HTML / plain text URL.
      const uriListReference = getMediaReferenceFromUriList(clipboardData.getData("text/uri-list"));
      const htmlReference = getMediaReferenceFromHtml(clipboardData.getData("text/html"));
      const plainText = normalizeClipboardText(clipboardData.getData("text/plain"));
      const plainTextUrl = parseUrlCandidate(plainText);
      const plainTextReference =
        plainTextUrl && isMediaUrl(plainTextUrl)
          ? { url: plainTextUrl, mimeType: inferClipboardMimeTypeFromUrl(plainTextUrl) }
          : null;
      const pastedMediaReference = htmlReference || uriListReference || plainTextReference;
      if (pastedMediaReference && onPasteMediaReference) {
        onPasteMediaReference(pastedMediaReference);
        markHandled();
        return true;
      }

      // Priority 3: plain text.
      if (plainText && onPasteTextReference) {
        onPasteTextReference(plainText);
        markHandled();
        return true;
      }

      return false;
    },
    [buildFileList, onDropFiles, onPasteMediaReference, onPasteTextReference]
  );

  React.useEffect(() => {
    if (typeof document === "undefined") return;

    const handleDocumentPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      const panelNode = panelRef.current;
      if (!panelNode) return;
      const pasteSurfaces = getReferencePasteSurfaces(panelNode);

      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      const activeElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const targetInsideSurface = isNodeInsideAnySurface(targetElement, pasteSurfaces);
      const activeInsideSurface = isNodeInsideAnySurface(activeElement, pasteSurfaces);
      const targetIsEditable = isEditableElement(targetElement);
      const activeIsEditable = isEditableElement(activeElement);
      const pastePrimed = isPastePrimedRef.current;
      const preserveEditablePaste =
        (targetIsEditable || activeIsEditable) &&
        !targetInsideSurface &&
        !activeInsideSurface &&
        !isPointerOverPanelRef.current &&
        !pastePrimed;
      if (preserveEditablePaste) return;

      if (consumeClipboardData(event.clipboardData)) {
        event.preventDefault();
      }
    };

    document.addEventListener("paste", handleDocumentPaste);
    return () => {
      document.removeEventListener("paste", handleDocumentPaste);
    };
  }, [consumeClipboardData]);

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentPointerDown = (event: PointerEvent) => {
      const panelNode = panelRef.current;
      if (!panelNode) return;
      const pasteSurfaces = getReferencePasteSurfaces(panelNode);
      const targetNode = event.target instanceof Node ? event.target : null;
      const insidePasteSurface = isNodeInsideAnySurface(targetNode, pasteSurfaces);
      isPastePrimedRef.current = insidePasteSurface;
      if (
        insidePasteSurface &&
        event.button === 0 &&
        !isNodeInsideAnySurface(targetNode, [panelNode])
      ) {
        panelNode.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", handleDocumentPointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown, true);
    };
  }, []);

  const handlePanelPointerEnter = () => {
    isPointerOverPanelRef.current = true;
  };

  const handlePanelPointerLeave = () => {
    isPointerOverPanelRef.current = false;
  };

  const handlePanelPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    isPastePrimedRef.current = true;
    if (event.button !== 0) return;
    event.currentTarget.focus({ preventScroll: true });
  };

  const handleCardDragStart = (event: React.DragEvent<HTMLElement>, item: StudioOutput) => {
    prepareReferenceDrag(event, item, { dragImage: event.currentTarget as HTMLElement });
  };

  const handleCardDragEnd = (event: React.DragEvent<HTMLElement>) => {
    clearDragState(event);
  };

  const handleScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      setVirtualMetrics((prev) => ({
        ...prev,
        scrollTop: node.scrollTop,
        viewportHeight: node.clientHeight,
      }));
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      if (now - lastScrollSampleAtRef.current < 1200) return;
      lastScrollSampleAtRef.current = now;
      logMediaPerf("media.grid.scroll.sample", {
        surface: "reference-grid",
        scroll_top: Math.round(node.scrollTop),
        scroll_height: node.scrollHeight,
        viewport_height: node.clientHeight,
        visible_item_count: renderedItemCount,
        total_item_count: outputs.length,
      });
    },
    [outputs.length, renderedItemCount]
  );

  const handleAutoplayStarted = useCallback(
    (id: string) => {
      if (autoplayingIdsRef.current.has(id)) return;
      autoplayingIdsRef.current.add(id);
      logMediaPerf("media.grid.autoplay.started", {
        surface: "reference-grid",
        output_id: id,
        active_autoplay_count: autoplayingIdsRef.current.size,
        visible_item_count: renderedItemCount,
        total_item_count: outputs.length,
      });
    },
    [outputs.length, renderedItemCount]
  );

  const handleAutoplayStopped = useCallback(
    (id: string) => {
      if (!autoplayingIdsRef.current.has(id)) return;
      autoplayingIdsRef.current.delete(id);
      logMediaPerf("media.grid.autoplay.stopped", {
        surface: "reference-grid",
        output_id: id,
        active_autoplay_count: autoplayingIdsRef.current.size,
        visible_item_count: renderedItemCount,
        total_item_count: outputs.length,
      });
    },
    [outputs.length, renderedItemCount]
  );

  const renderSaveChip = (item: StudioOutput, isSelected: boolean) => {
    if (!item.saveState || item.saveState === "idle") return null;
    const label =
      item.saveState === "saving"
        ? "Saving..."
        : item.saveState === "saved"
          ? "Saved"
          : "Save failed";
    if (item.saveState === "saved") {
      if (!isSelected) return null;
      return (
        <div className={`reference-save-chip is-${item.saveState}`} aria-label="Saved">
          <CheckCircle size={16} weight="fill" aria-hidden />
        </div>
      );
    }
    return (
      <div className={`reference-save-chip is-${item.saveState}`}>
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div
      ref={panelRef}
      className="panel ai-panel ai-preview-panel reference-canvas-panel"
      data-selection-theme={selectionTheme}
      onDrop={handleCanvasDrop}
      onDragOver={handleCanvasDragOver}
      onPointerEnter={handlePanelPointerEnter}
      onPointerLeave={handlePanelPointerLeave}
      onPointerDown={handlePanelPointerDown}
      tabIndex={0}
    >
      {showHeader ? (
        <div className="panel-header preview-header">
          <div>
            <p className="eyebrow">Reference Grid</p>
          </div>
          <div className="preview-header-actions">
            <button
              type="button"
              className="ghost-btn mini preview-media-btn"
              onClick={onTriggerFileSelect}
            >
              <UploadSimple size={14} weight="regular" />
              Add files
            </button>
            <PromptLibraryButton
              onClick={(event) => {
                event.preventDefault();
                onOpenMediaLibrary?.();
              }}
              className="prompt-media-btn preview-media-btn"
              aria-label="Open media library"
              label="Media Library"
              icon={<CloudArrowUp size={16} weight="regular" aria-hidden />}
              tone="library"
            />
          </div>
        </div>
      ) : null}
      <div className="reference-canvas-scroll" onScroll={handleScroll} ref={scrollContainerRef}>
        <div
          className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
          ref={gridRef}
          style={gridStyle}
        >
          {outputs.length === 0 ? (
            <div className="reference-empty">
              <p className="preview-title">Upload or generate to see your references here.</p>
              <p className="subdued tiny helper-text">
                New text prompts, images, and videos will appear in this grid.
              </p>
            </div>
          ) : (
            <>
              {topSpacerHeight > 0 ? (
                <div className="reference-virtual-spacer" style={{ height: topSpacerHeight }} />
              ) : null}
              {visibleOutputs.map((item) => {
                const isFailing = item.taskState === "fail";
                const isLoading =
                  !isFailing &&
                  (item.taskState === "running" ||
                    item.taskState === "pending" ||
                    (item.taskState === "success" && !item.previewUrl && !item.previewText));
                const isLoaded = loadedMap[item.id];
                const showSpinner = !isFailing && (isLoading || (!isLoaded && !item.previewText));

                const isVideoPreview = item.previewUrl ? isVideoUrl(item.previewUrl) : false;
                const isImagePreview = item.previewUrl ? !isVideoPreview : false;
                const canAutoplayVideo = isVideoPreview && autoplayEnabledIdSet.has(item.id);
                const isPromptOnly = !item.previewUrl && !!item.previewText;
                const isLinkedPromptReference =
                  isPromptOnly && linkedPromptReferenceIdSet.has(item.id);
                const canRetryStatus =
                  Boolean(onRetryStatus && item.taskId) && (isFailing || isLoading);
                const saveDisabled = item.saveState === "saving";
                const saveLabel =
                  item.saveState === "failed" ? "Retry save" : "Save to media library";
                const saveIcon =
                  item.saveState === "failed" ? (
                    <ArrowClockwise size={16} weight="bold" aria-hidden />
                  ) : (
                    <FloppyDisk size={16} weight="bold" aria-hidden />
                  );
                return (
                  <div
                    key={item.id}
                    className={`reference-card ${item.previewUrl ? "has-preview" : ""} ${isVideoPreview ? "has-video" : ""} ${item.previewText ? "has-text" : ""} ${activeOutputId === item.id ? "is-active" : ""} ${showSpinner ? "is-loading" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
                    role="button"
                    aria-busy={showSpinner}
                    data-loading={showSpinner ? "true" : "false"}
                    tabIndex={0}
                    onClick={() => onSelectOutput(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectOutput(item.id);
                      }
                    }}
                    onDoubleClick={() => onOpenDetails(item.id)}
                    draggable={!!item.previewUrl || !!item.previewText}
                    onDragStart={(event) => {
                      handleCardDragStart(event, item);
                    }}
                    onDragEnd={handleCardDragEnd}
                  >
                    {isVideoPreview && item.previewUrl ? (
                      <video
                        className="reference-card-video"
                        ref={(node) => registerVideoNode(item.id, node)}
                        src={canAutoplayVideo ? item.previewUrl : undefined}
                        autoPlay={canAutoplayVideo}
                        muted
                        loop
                        playsInline
                        preload={canAutoplayVideo ? "metadata" : "none"}
                        onLoadedData={() => markLoaded(item.id)}
                        onPlay={() => handleAutoplayStarted(item.id)}
                        onPause={() => handleAutoplayStopped(item.id)}
                      />
                    ) : null}
                    {isImagePreview && item.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="reference-card-image"
                        loading="lazy"
                        decoding="async"
                        onLoad={() => markLoaded(item.id)}
                        onError={() => markLoaded(item.id, { notifyAutoSave: false })}
                      />
                    ) : null}
                    {isFailing ? (
                      <div className="reference-fail-overlay">
                        <div className="fail-icon" aria-hidden="true">
                          !
                        </div>
                        <div className="fail-title">Generation failed</div>
                        {item.errorMessageShort ? (
                          <div className="fail-subtitle">
                            {item.errorMessageShort.replace(/fal(\.ai)?/gi, "the provider")}
                          </div>
                        ) : item.errorMessage ? (
                          <div className="fail-subtitle">
                            {item.errorMessage.replace(/fal(\.ai)?/gi, "the provider")}
                          </div>
                        ) : null}
                        {canRetryStatus && activeOutputId === item.id ? (
                          <button
                            type="button"
                            className="reference-status-retry-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectOutput(item.id);
                              onRetryStatus?.(item);
                            }}
                          >
                            Retry status
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {showSpinner ? (
                      <div className="reference-loading">
                        <div className="reference-spinner" />
                      </div>
                    ) : null}
                    {showSpinner && canRetryStatus && activeOutputId === item.id ? (
                      <button
                        type="button"
                        className="reference-status-retry-btn reference-status-retry-btn--loading"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectOutput(item.id);
                          onRetryStatus?.(item);
                        }}
                      >
                        Retry status
                      </button>
                    ) : null}
                    {isLinkedPromptReference ? (
                      <span className="reference-card-link-dot" aria-hidden="true" />
                    ) : null}
                    {renderSaveChip(item, activeOutputId === item.id)}
                    {/* Show delete button for error cards when selected */}
                    {isFailing && onDeleteOutput && activeOutputId === item.id ? (
                      <div className="reference-card-actions" aria-label="Reference actions">
                        <button
                          type="button"
                          className="reference-card-action-btn reference-card-action-btn--danger"
                          aria-label="Remove error from grid"
                          onClick={(event) => {
                            event.stopPropagation();
                            onDeleteOutput(item.id);
                          }}
                        >
                          <X size={16} weight="bold" aria-hidden />
                        </button>
                      </div>
                    ) : null}
                    {(onSaveToLibrary && (isImagePreview || isPromptOnly || isVideoPreview)) ||
                    (onDownload && (isImagePreview || isVideoPreview)) ? (
                      <div className="reference-card-actions" aria-label="Reference actions">
                        {onSaveToLibrary ? (
                          <button
                            type="button"
                            className="reference-card-action-btn"
                            aria-label={saveLabel}
                            disabled={saveDisabled}
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectOutput(item.id);
                              onSaveToLibrary(item);
                            }}
                          >
                            {saveIcon}
                          </button>
                        ) : null}
                        {onDownload && (isImagePreview || isVideoPreview) ? (
                          <button
                            type="button"
                            className="reference-card-action-btn"
                            aria-label="Download reference"
                            onClick={(event) => {
                              event.stopPropagation();
                              onSelectOutput(item.id);
                              onDownload(item);
                            }}
                          >
                            <DownloadSimple size={16} weight="bold" aria-hidden />
                          </button>
                        ) : null}
                        {onDeleteOutput ? (
                          <button
                            type="button"
                            className="reference-card-action-btn reference-card-action-btn--danger"
                            aria-label="Remove reference from grid"
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteOutput(item.id);
                            }}
                          >
                            <X size={16} weight="bold" aria-hidden />
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    {item.previewText ? (
                      <div className="reference-card-text">{item.previewText}</div>
                    ) : null}
                    {isImagePreview && onDescribeImage ? (
                      <button
                        type="button"
                        className="reference-describe-pill reference-generate-pill agent-generate-prefab"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectOutput(item.id);
                          onDescribeImage(item);
                        }}
                      >
                        <span className="agent-generate-label">Describe</span>
                      </button>
                    ) : null}
                    {isPromptOnly &&
                    onGeneratePrompt &&
                    activeOutputId === item.id &&
                    showPromptGenerate ? (
                      <>
                        <button
                          type="button"
                          className="reference-generate-pill agent-generate-prefab reference-prompt-generate-pill"
                          disabled={disablePromptGenerate}
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectOutput(item.id);
                            onGeneratePrompt(item);
                          }}
                          onDoubleClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <span className="agent-generate-label">Generate</span>
                          <span className="model-chip-pill generate-pill">
                            <span aria-hidden="true" className="model-chip-icon">
                              ✦
                            </span>
                            <span className="model-chip-credits">
                              {generateCostCredits != null ? generateCostCredits : "—"}
                            </span>
                          </span>
                        </button>
                      </>
                    ) : null}
                  </div>
                );
              })}
              {bottomSpacerHeight > 0 ? (
                <div className="reference-virtual-spacer" style={{ height: bottomSpacerHeight }} />
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
