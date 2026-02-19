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
import {
  clearDragState,
  prepareReferenceDrag,
  type ReferenceDragSourceSurface,
} from "../utils/dragDrop";
import type { ToolId } from "../types";
import { logMediaPerf, setMediaPerfSamplingPolicy } from "../../../lib/mediaPerfTelemetry";
import { useOutputSelector } from "../hooks/aiStudioOutputStore";
import {
  resolveReferenceCardUrls,
  type ReferenceGridPreviewQualityBand,
} from "../logic/referenceGridMedia";
import { isVideoUrl } from "../logic/stateParsers";
import {
  calculateReferenceGridWindow,
  resolveReferenceGridOverscanRows,
} from "../logic/referenceGridVirtualization";
import {
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW,
  PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT,
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY,
  PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT,
  PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET,
  PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY,
  PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION,
  PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET,
  PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP,
  PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD,
  PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG,
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY,
  PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER,
  PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE,
  PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT,
} from "../logic/perfProfileFlags";
import { useReferenceGridHydrationBudget } from "../hooks/useReferenceGridHydrationBudget";
import { useReferenceGridPerfWatchdog } from "../hooks/useReferenceGridPerfWatchdog";
import { useReferenceGridMediaWorkBudget } from "../hooks/useReferenceGridMediaWorkBudget";
import { useReferenceGridHorizontalSplit } from "../hooks/useReferenceGridHorizontalSplit";

const REFERENCE_VIRTUAL_OVERSCAN_ROWS = 4;
const REFERENCE_VIRTUALIZE_MIN_ITEMS = 12;
const FALLBACK_REFERENCE_ROW_HEIGHT = 220;
const REFERENCE_GRID_MIN_CARD_PX = 124;
const REFERENCE_GRID_MIN_CARD_PX_WIDE = 124;
const REFERENCE_GRID_MIN_COLUMNS = 2;
const REFERENCE_GRID_MAX_COLUMNS = 5;
const REFERENCE_GRID_MAX_COLUMNS_WIDE = 5;
const QUICK_SLOT_INVENTORY_MAX_COLUMNS = 5;
const REFERENCE_GRID_EMERGENCY_MAX_COLUMNS = 5;
const REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD = 0.6;
const REFERENCE_AUTOPLAY_MAX_DESKTOP = 3;
const REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN = 2;
const REFERENCE_AUTOPLAY_MAX_CONSTRAINED = 1;
const REFERENCE_AUTOPLAY_SMALL_SCREEN_QUERY = "(max-width: 900px)";
const REFERENCE_AUTOPLAY_DETACH_DELAY_MS = 1400;
const REFERENCE_HIGH_DENSITY_CARD_COUNT = 180;
const REFERENCE_PRIORITY_HYDRATION_ROWS = 3;
const REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_0 = 6;
const REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_1 = 6;
const REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_2 = 3;
const REFERENCE_LOCAL_ADAPTIVE_WEBP_QUALITY: Record<ReferenceGridPreviewQualityBand, number> = {
  high: 0.42,
  balanced: 0.32,
  compact: 0.3,
};
const REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW = PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW;
const REFERENCE_GRID_FLAG_CURATED_SPLIT = PERF_FLAG_REFERENCE_GRID_CURATED_SPLIT;
const REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER = PERF_FLAG_REFERENCE_GRID_STRICT_PREVIEW_LADDER;
const REFERENCE_GRID_FLAG_DECODE_BUDGET = PERF_FLAG_REFERENCE_GRID_DECODE_BUDGET;
const REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION = PERF_FLAG_REFERENCE_GRID_DYNAMIC_VIRTUALIZATION;
const REFERENCE_GRID_FLAG_DENSE_VISUAL_SIMPLIFY = PERF_FLAG_REFERENCE_GRID_DENSE_VISUAL_SIMPLIFY;
const REFERENCE_GRID_FLAG_MEMORY_GUARD = PERF_FLAG_REFERENCE_GRID_MEMORY_GUARD;
const REFERENCE_GRID_FLAG_PERF_WATCHDOG = PERF_FLAG_REFERENCE_GRID_PERF_WATCHDOG;
const REFERENCE_GRID_FLAG_HARD_VIEWPORT_CAP = PERF_FLAG_REFERENCE_GRID_HARD_VIEWPORT_CAP;
const REFERENCE_GRID_FLAG_CSS_CONTAINMENT = PERF_FLAG_REFERENCE_GRID_CSS_CONTAINMENT;
const REFERENCE_GRID_FLAG_GLOBAL_MEDIA_BUDGET = PERF_FLAG_REFERENCE_GRID_GLOBAL_MEDIA_BUDGET;
const REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY =
  PERF_FLAG_REFERENCE_GRID_ADAPTIVE_PREVIEW_QUALITY;
const REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE = PERF_FLAG_REFERENCE_GRID_TELEMETRY_BACKPRESSURE;
const REFERENCE_GRID_FLAG_TRANSITION_NONURGENT = PERF_FLAG_REFERENCE_GRID_TRANSITION_NONURGENT;
const REFERENCE_GRID_FLAG_RENDER_COMMIT_TELEMETRY =
  PERF_FLAG_REFERENCE_GRID_RENDER_COMMIT_TELEMETRY;

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

const hasAdaptiveQueryParams = (url: string): boolean =>
  /[?&]width=\d+/i.test(url) && /[?&]quality=\d+/i.test(url);

const isNextOptimizerUrl = (url: string): boolean =>
  /^\/_next\/image\?/i.test(url) || /\/_next\/image\?/i.test(url);

const isOutputVideoPreview = (
  output: Pick<StudioOutput, "mode"> | null | undefined,
  url: string | null | undefined
): boolean => {
  if (!url) return false;
  if (output?.mode === "video") return true;
  if (output?.mode === "image") return false;
  return isVideoUrl(url);
};

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

const areOutputListsEqual = (left: StudioOutput[], right: StudioOutput[]) => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
};

export type ReferenceCanvasProps = {
  outputs?: StudioOutput[];
  archivedOutputs?: StudioOutput[];
  activeOutputId: string | null;
  curatedReferenceIds?: string[];
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
  onAddCuratedReference?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  onReorderCuratedReference?: (
    id: string,
    targetId: string | null,
    placement: "before" | "after" | "end"
  ) => void;
  onRestoreArchivedOutput?: (id: string) => void;
  onRestoreAllArchivedOutputs?: () => void;
  generateCostCredits?: number | null;
};

type ReferenceCanvasCardProps = {
  item: StudioOutput;
  dragSourceSurface: ReferenceDragSourceSurface;
  videoNodeKey: string;
  activeOutputId: string | null;
  loadingVisual: "none" | "spinner" | "placeholder" | "pending";
  cardPreviewUrl: string | null;
  isVideoPreview: boolean;
  isImagePreview: boolean;
  canAutoplayVideo: boolean;
  isPromptOnly: boolean;
  isLinkedPromptReference: boolean;
  canRetryStatus: boolean;
  showPromptGenerate: boolean;
  disablePromptGenerate: boolean;
  generateCostCredits: number | null | undefined;
  imageSrc: string | undefined;
  imageLoading: "eager" | "lazy";
  imageFetchPriority: "high" | "low";
  onSelectOutput: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onCardDragStart: (
    event: React.DragEvent<HTMLElement>,
    item: StudioOutput,
    sourceSurface: ReferenceDragSourceSurface
  ) => void;
  onCardDragEnd: (event: React.DragEvent<HTMLElement>) => void;
  onCardDragOver?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDrop?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragEnter?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  onCardDragLeave?: (event: React.DragEvent<HTMLElement>, item: StudioOutput) => void;
  registerVideoNode: (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => void;
  markLoaded: (id: string, options?: { notifyAutoSave?: boolean }) => void;
  onAutoplayStarted: (id: string) => void;
  onAutoplayStopped: (id: string) => void;
  onRetryStatus?: (output: StudioOutput) => void;
  onDeleteOutput?: (id: string) => void;
  onRemoveCuratedReference?: (id: string) => void;
  showCuratedRemoveAction?: boolean;
  onSaveToLibrary?: (output: StudioOutput) => void;
  onDownload?: (output: StudioOutput) => void;
  onDescribeImage?: (output: StudioOutput) => void;
  onGeneratePrompt?: (output: StudioOutput) => void;
  hideReferenceActions?: boolean;
};

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

const ReferenceCanvasCard = React.memo(function ReferenceCanvasCard({
  item,
  dragSourceSurface,
  videoNodeKey,
  activeOutputId,
  loadingVisual,
  cardPreviewUrl,
  isVideoPreview,
  isImagePreview,
  canAutoplayVideo,
  isPromptOnly,
  isLinkedPromptReference,
  canRetryStatus,
  showPromptGenerate,
  disablePromptGenerate,
  generateCostCredits,
  imageSrc,
  imageLoading,
  imageFetchPriority,
  onSelectOutput,
  onOpenDetails,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onCardDragEnter,
  onCardDragLeave,
  registerVideoNode,
  markLoaded,
  onAutoplayStarted,
  onAutoplayStopped,
  onRetryStatus,
  onDeleteOutput,
  onRemoveCuratedReference,
  showCuratedRemoveAction = false,
  onSaveToLibrary,
  onDownload,
  onDescribeImage,
  onGeneratePrompt,
  hideReferenceActions = false,
}: ReferenceCanvasCardProps) {
  const isFailing = item.taskState === "fail";
  const isSelected = activeOutputId === item.id;
  const isLoading = loadingVisual !== "none";
  const saveDisabled = item.saveState === "saving";
  const saveLabel = item.saveState === "failed" ? "Retry save" : "Save to media library";
  const isGeneratedReference =
    item.mediaSource === "generated" || Boolean(item.generationId || item.taskId);
  const loadingPlaceholderLabel = isGeneratedReference ? "generating..." : "loading preview...";
  const loadingPendingLabel = isGeneratedReference ? "queued" : "loading";
  const shouldShowSaveAction = Boolean(
    onSaveToLibrary &&
    item.saveState !== "saved" &&
    (isPromptOnly || ((isImagePreview || isVideoPreview) && !isGeneratedReference))
  );
  const saveIcon =
    item.saveState === "failed" ? (
      <ArrowClockwise size={16} weight="bold" aria-hidden />
    ) : (
      <FloppyDisk size={16} weight="bold" aria-hidden />
    );

  return (
    <div
      className={`reference-card ${cardPreviewUrl ? "has-preview" : ""} ${isVideoPreview ? "has-video" : ""} ${item.previewText ? "has-text" : ""} ${isSelected ? "is-active" : ""} ${isLoading ? "is-loading" : ""} ${isLinkedPromptReference ? "is-linked-prompt-ref" : ""}`}
      role="button"
      aria-busy={isLoading}
      data-loading={isLoading ? "true" : "false"}
      tabIndex={0}
      onClick={() => onSelectOutput(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectOutput(item.id);
        }
      }}
      onDoubleClick={() => onOpenDetails(item.id)}
      draggable={!!cardPreviewUrl || !!item.previewText}
      onDragStart={(event) => {
        onCardDragStart(event, item, dragSourceSurface);
      }}
      onDragEnd={onCardDragEnd}
      onDragOver={onCardDragOver ? (event) => onCardDragOver(event, item) : undefined}
      onDrop={onCardDrop ? (event) => onCardDrop(event, item) : undefined}
      onDragEnter={onCardDragEnter ? (event) => onCardDragEnter(event, item) : undefined}
      onDragLeave={onCardDragLeave ? (event) => onCardDragLeave(event, item) : undefined}
    >
      {isVideoPreview && cardPreviewUrl ? (
        <video
          className="reference-card-video"
          ref={(node) => registerVideoNode(videoNodeKey, item.id, node)}
          src={canAutoplayVideo ? cardPreviewUrl : undefined}
          autoPlay={canAutoplayVideo}
          muted
          loop
          playsInline
          preload={canAutoplayVideo ? "metadata" : "none"}
          onLoadedData={() => markLoaded(item.id)}
          onPlay={() => onAutoplayStarted(item.id)}
          onPause={() => onAutoplayStopped(item.id)}
        />
      ) : null}
      {isImagePreview && cardPreviewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc}
          data-src={cardPreviewUrl}
          alt=""
          className="reference-card-image"
          loading={imageLoading}
          decoding="async"
          {...(imageFetchPriority ? { fetchpriority: imageFetchPriority } : {})}
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
          {canRetryStatus && isSelected ? (
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
      {loadingVisual !== "none" ? (
        <div
          className={`reference-loading${loadingVisual !== "spinner" ? " is-static" : ""}${loadingVisual === "pending" ? " is-pending" : ""}`}
        >
          {loadingVisual === "spinner" ? <div className="reference-spinner" /> : null}
          {loadingVisual === "placeholder" ? (
            <span className="reference-loading-placeholder">{loadingPlaceholderLabel}</span>
          ) : null}
          {loadingVisual === "pending" ? (
            <span className="reference-loading-pending-chip">
              <span className="reference-loading-pending-spinner" aria-hidden="true" />
              <span className="reference-loading-pending-label">{loadingPendingLabel}</span>
            </span>
          ) : null}
        </div>
      ) : null}
      {isLoading && canRetryStatus && isSelected ? (
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
      {renderSaveChip(item, isSelected)}
      {isFailing && onDeleteOutput && isSelected ? (
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
      {showCuratedRemoveAction && onRemoveCuratedReference && isSelected ? (
        <div className="reference-card-actions" aria-label="Curated actions">
          <button
            type="button"
            className="reference-card-action-btn reference-card-action-btn--danger"
            aria-label="Remove from curated"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveCuratedReference(item.id);
            }}
          >
            <X size={16} weight="bold" aria-hidden />
          </button>
        </div>
      ) : null}
      {!hideReferenceActions &&
      (shouldShowSaveAction || (onDownload && (isImagePreview || isVideoPreview))) ? (
        <div className="reference-card-actions" aria-label="Reference actions">
          {shouldShowSaveAction ? (
            <button
              type="button"
              className="reference-card-action-btn"
              aria-label={saveLabel}
              disabled={saveDisabled}
              onClick={(event) => {
                event.stopPropagation();
                onSelectOutput(item.id);
                onSaveToLibrary?.(item);
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
      {item.previewText ? <div className="reference-card-text">{item.previewText}</div> : null}
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
      {isPromptOnly && onGeneratePrompt && isSelected && showPromptGenerate ? (
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
      ) : null}
    </div>
  );
});

/**
 * Displays the reference grid and handles drag/drop + selection behavior.
 */
export function ReferenceCanvas({
  outputs: outputsProp,
  archivedOutputs: archivedOutputsProp,
  activeOutputId,
  curatedReferenceIds = [],
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
  onAddCuratedReference,
  onRemoveCuratedReference,
  onReorderCuratedReference,
  onRestoreArchivedOutput,
  onRestoreAllArchivedOutputs,
  generateCostCredits,
}: ReferenceCanvasProps) {
  type CanvasDropMode = "none" | "text" | "files";
  const selectorOutputs = useOutputSelector(
    (snapshot) =>
      snapshot.outputOrder
        .map((id) => snapshot.outputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
    areOutputListsEqual
  );
  const selectorArchivedOutputs = useOutputSelector(
    (snapshot) =>
      snapshot.archivedOutputOrder
        .map((id) => snapshot.archivedOutputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
    areOutputListsEqual
  );
  const allOutputs = outputsProp ?? selectorOutputs;
  const archivedOutputs = archivedOutputsProp ?? selectorArchivedOutputs;
  const outputs = React.useMemo(
    () => allOutputs.filter((item) => item.hiddenInReferenceGrid !== true),
    [allOutputs]
  );
  const isCuratedSplitEnabled =
    REFERENCE_GRID_FLAG_CURATED_SPLIT &&
    Boolean(onAddCuratedReference && onRemoveCuratedReference && onReorderCuratedReference);
  const outputById = React.useMemo(() => {
    const map: Record<string, StudioOutput> = {};
    [...allOutputs, ...archivedOutputs].forEach((item) => {
      map[item.id] = item;
    });
    return map;
  }, [allOutputs, archivedOutputs]);
  const curatedOutputs = React.useMemo(
    () =>
      curatedReferenceIds
        .map((id) => outputById[id])
        .filter((item): item is StudioOutput => Boolean(item)),
    [curatedReferenceIds, outputById]
  );
  const perfWatchdog = useReferenceGridPerfWatchdog({
    enabled: REFERENCE_GRID_FLAG_PERF_WATCHDOG,
    memoryGuardEnabled: REFERENCE_GRID_FLAG_MEMORY_GUARD,
  });
  const [previewQualityPressureLevel, setPreviewQualityPressureLevel] = useState<0 | 1 | 2>(
    perfWatchdog.degradeLevel
  );
  const previewQualityPressureLevelRef = React.useRef<0 | 1 | 2>(perfWatchdog.degradeLevel);
  const liveWatchdogDegradeLevelRef = React.useRef<0 | 1 | 2>(perfWatchdog.degradeLevel);
  const liveOutputCountRef = React.useRef<number>(outputs.length);
  const hydrationBudget = useReferenceGridHydrationBudget({
    enabled: REFERENCE_GRID_FLAG_DECODE_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
  });
  const selectionTheme = resolveReferenceSelectionTheme(selectedTool);
  const [loadedMap, setLoadedMap] = useState<Record<string, boolean>>({});
  const loadedIdsRef = React.useRef<Set<string>>(new Set());
  const autoplayingIdsRef = React.useRef<Set<string>>(new Set());
  const lastScrollSampleAtRef = React.useRef(0);
  const allRefsScrollRafIdRef = React.useRef<number | null>(null);
  const curatedScrollRafIdRef = React.useRef<number | null>(null);
  const queuedAllRefsScrollMetricsRef = React.useRef<{
    scrollTop: number;
    viewportHeight: number;
  } | null>(null);
  const queuedCuratedScrollMetricsRef = React.useRef<{
    scrollTop: number;
    viewportHeight: number;
  } | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const gridRef = React.useRef<HTMLDivElement | null>(null);
  const curatedScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const curatedGridRef = React.useRef<HTMLDivElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const curatedSectionRef = React.useRef<HTMLDivElement | null>(null);
  const curatedHeaderRef = React.useRef<HTMLDivElement | null>(null);
  const videoVisibleKeySetRef = React.useRef<Set<string>>(new Set());
  const videoOutputIdByKeyRef = React.useRef<Map<string, string>>(new Map());
  const videoNodeByKeyRef = React.useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoDetachTimeoutByKeyRef = React.useRef<Map<string, number>>(new Map());
  const videoIntersectionObserverBySurfaceRef = React.useRef<
    Map<"all-refs" | "curated", IntersectionObserver>
  >(new Map());
  const isPointerOverPanelRef = React.useRef(false);
  const isPastePrimedRef = React.useRef(false);
  const lastPasteFingerprintRef = React.useRef<{ value: string; at: number } | null>(null);
  const canvasDragDepthRef = React.useRef(0);
  const curatedDragDepthRef = React.useRef(0);
  const [desiredVideoAttachBudget, setDesiredVideoAttachBudget] = useState<number>(
    REFERENCE_AUTOPLAY_MAX_DESKTOP
  );
  const [autoplayEnabledIds, setAutoplayEnabledIds] = useState<string[]>([]);
  const desiredVideoAttachBudgetRef = React.useRef<number>(REFERENCE_AUTOPLAY_MAX_DESKTOP);
  const autoplayEnabledIdsStateRef = React.useRef<string[]>([]);
  const recomputeAutoplayBudgetRef = React.useRef<() => void>(() => {});
  const [canvasDropMode, setCanvasDropMode] = useState<CanvasDropMode>("none");
  const canvasDropModeRef = React.useRef<CanvasDropMode>("none");
  const [isCuratedDropActive, setIsCuratedDropActive] = useState(false);
  const isCuratedDropActiveRef = React.useRef(false);
  const [isArchivePanelOpen, setIsArchivePanelOpen] = useState(false);
  const [curatedHeaderHeightPx, setCuratedHeaderHeightPx] = useState(24);
  const previousVisiblePreviewUrlByIdRef = React.useRef<Record<string, string | null>>({});
  const previewSwapTelemetryRef = React.useRef<{
    windowStartedAtMs: number;
    totalSwapCount: number;
    repaintSpikeCount: number;
  }>({
    windowStartedAtMs: 0,
    totalSwapCount: 0,
    repaintSpikeCount: 0,
  });
  const [previewSwapMetrics, setPreviewSwapMetrics] = useState<{
    swapRatePerMinute: number;
    repaintSpikeCount: number;
    lastSwapBurstCount: number;
  }>({
    swapRatePerMinute: 0,
    repaintSpikeCount: 0,
    lastSwapBurstCount: 0,
  });
  const setCuratedDropActiveSafe = useCallback((next: boolean) => {
    if (isCuratedDropActiveRef.current === next) return;
    isCuratedDropActiveRef.current = next;
    setIsCuratedDropActive(next);
  }, []);
  const setCanvasDropModeSafe = useCallback((next: CanvasDropMode) => {
    if (canvasDropModeRef.current === next) return;
    canvasDropModeRef.current = next;
    setCanvasDropMode(next);
  }, []);
  const [imageHydrationState, setImageHydrationState] = useState<{
    hydratedById: Record<
      string,
      {
        sourceUrl: string;
        renderUrl: string;
      }
    >;
    queueSize: number;
    decodeInflight: number;
  }>({
    hydratedById: {},
    queueSize: 0,
    decodeInflight: 0,
  });
  const hydrationQueueRef = React.useRef<string[]>([]);
  const hydrationQueuedIdSetRef = React.useRef<Set<string>>(new Set());
  const hydrationInflightIdSetRef = React.useRef<Set<string>>(new Set());
  const hydrationUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationFallbackUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationFailedOptimizedUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationPreviewMetaByIdRef = React.useRef<
    Record<
      string,
      {
        targetLongEdgePx: number;
        previewQualityBand: ReferenceGridPreviewQualityBand;
      }
    >
  >({});
  const hydrationGeneratedObjectUrlByIdRef = React.useRef<Record<string, string>>({});
  const hydrationHydratedByIdRef = React.useRef<
    Record<
      string,
      {
        sourceUrl: string;
        renderUrl: string;
      }
    >
  >({});
  const hydrationRafFlushRef = React.useRef<number | null>(null);
  const hydrationPendingLoadedRef = React.useRef<
    Record<
      string,
      {
        sourceUrl: string;
        renderUrl: string;
      }
    >
  >({});
  const processHydrationQueueRef = React.useRef<() => void>(() => {});
  const [virtualMetrics, setVirtualMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 5,
    rowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
  });
  const [curatedVirtualMetrics, setCuratedVirtualMetrics] = useState({
    scrollTop: 0,
    viewportHeight: 0,
    columnCount: 5,
    rowHeight: FALLBACK_REFERENCE_ROW_HEIGHT,
  });
  const horizontalSplit = useReferenceGridHorizontalSplit({
    enabled: isCuratedSplitEnabled,
    containerRef: panelRef,
    defaultTopRatio: 0,
    minTopSectionHeightPx: curatedHeaderHeightPx,
    minBottomSectionHeightPx: 72,
    allRefsSnapTopHeightPx: curatedHeaderHeightPx,
    collapseTopHeightPx: curatedHeaderHeightPx,
  });

  React.useEffect(() => {
    if (!isCuratedSplitEnabled) return;
    const updateHeaderHeight = () => {
      const node = curatedHeaderRef.current;
      if (!node) return;
      const nextHeight = Math.max(24, Math.round(node.offsetHeight));
      setCuratedHeaderHeightPx((prev) => (prev === nextHeight ? prev : nextHeight));
    };
    updateHeaderHeight();
    if (typeof ResizeObserver === "undefined") return;
    const node = curatedHeaderRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => {
      updateHeaderHeight();
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isCuratedSplitEnabled]);
  const lastRenderCommitAtRef = React.useRef<number>(0);
  const autoplayEnabledIdSet = React.useMemo(
    () => new Set(autoplayEnabledIds),
    [autoplayEnabledIds]
  );
  const linkedPromptReferenceIdSet = React.useMemo(
    () => new Set(linkedPromptReferenceIds),
    [linkedPromptReferenceIds]
  );
  const runNonUrgentUpdate = useCallback((updater: () => void) => {
    if (REFERENCE_GRID_FLAG_TRANSITION_NONURGENT && typeof React.startTransition === "function") {
      React.startTransition(updater);
      return;
    }
    updater();
  }, []);
  React.useEffect(() => {
    liveWatchdogDegradeLevelRef.current = perfWatchdog.degradeLevel;
  }, [perfWatchdog.degradeLevel]);
  React.useEffect(() => {
    liveOutputCountRef.current = outputs.length;
  }, [outputs.length]);
  React.useEffect(() => {
    previewQualityPressureLevelRef.current = previewQualityPressureLevel;
  }, [previewQualityPressureLevel]);
  React.useEffect(() => {
    const currentLevel = previewQualityPressureLevelRef.current;
    const nextLevel = perfWatchdog.degradeLevel;
    if (nextLevel === currentLevel) return;

    // Prevent periodic quality-level oscillation from triggering global image URL churn.
    // We only ratchet down quality under rising pressure; we do not auto-recover within the
    // same live session.
    if (nextLevel > currentLevel) {
      previewQualityPressureLevelRef.current = nextLevel;
      setPreviewQualityPressureLevel((prev) => (prev === nextLevel ? prev : nextLevel));
    }
  }, [perfWatchdog.degradeLevel]);
  const mediaWorkBudget = useReferenceGridMediaWorkBudget({
    enabled: REFERENCE_GRID_FLAG_GLOBAL_MEDIA_BUDGET,
    pressureLevel: perfWatchdog.degradeLevel,
    constrainedProfile: hydrationBudget.constrainedProfile,
    desiredImageDecodeInflight: hydrationBudget.maxInflightHydrations,
    desiredVideoAttachSlots: desiredVideoAttachBudget,
  });

  const revokeGeneratedHydrationUrl = useCallback((id: string) => {
    const existing = hydrationGeneratedObjectUrlByIdRef.current[id];
    if (!existing) return;
    URL.revokeObjectURL(existing);
    delete hydrationGeneratedObjectUrlByIdRef.current[id];
  }, []);

  const maybeCreateLocalAdaptivePreviewUrl = useCallback(
    async (id: string, sourceUrl: string, image: HTMLImageElement): Promise<string> => {
      if (!REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY) return sourceUrl;
      const isLocalImageSource = /^blob:/i.test(sourceUrl) || /^data:image\//i.test(sourceUrl);
      const shouldUseLocalAdaptiveTranscode =
        isLocalImageSource ||
        (liveWatchdogDegradeLevelRef.current >= 2 &&
          liveOutputCountRef.current >= REFERENCE_HIGH_DENSITY_CARD_COUNT);
      if (!shouldUseLocalAdaptiveTranscode) return sourceUrl;
      if (hasAdaptiveQueryParams(sourceUrl) || isNextOptimizerUrl(sourceUrl)) return sourceUrl;
      if (isVideoUrl(sourceUrl)) return sourceUrl;
      const previewMeta = hydrationPreviewMetaByIdRef.current[id];
      if (!previewMeta) return sourceUrl;
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight)) {
        return sourceUrl;
      }
      if (naturalWidth <= 0 || naturalHeight <= 0) return sourceUrl;
      const longEdge = Math.max(naturalWidth, naturalHeight);
      const targetLongEdge = Math.max(240, Math.min(previewMeta.targetLongEdgePx, longEdge));
      if (longEdge <= targetLongEdge + 8) return sourceUrl;
      const scale = targetLongEdge / longEdge;
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) return sourceUrl;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      try {
        context.drawImage(image, 0, 0, width, height);
      } catch {
        return sourceUrl;
      }
      const encodeToBlob = (mimeType: string, quality: number) =>
        new Promise<Blob | null>((resolve) => {
          try {
            canvas.toBlob((blob) => resolve(blob), mimeType, quality);
          } catch {
            resolve(null);
          }
        });
      const quality = REFERENCE_LOCAL_ADAPTIVE_WEBP_QUALITY[previewMeta.previewQualityBand];
      const blob =
        (await encodeToBlob("image/webp", quality)) ?? (await encodeToBlob("image/jpeg", quality));
      if (!blob) return sourceUrl;
      const objectUrl = URL.createObjectURL(blob);
      const previousUrl = hydrationGeneratedObjectUrlByIdRef.current[id];
      if (previousUrl && previousUrl !== objectUrl) {
        URL.revokeObjectURL(previousUrl);
      }
      hydrationGeneratedObjectUrlByIdRef.current[id] = objectUrl;
      return objectUrl;
    },
    []
  );

  const syncImageHydrationState = useCallback(() => {
    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        const nextQueueSize = hydrationQueueRef.current.length;
        const nextInflight = hydrationInflightIdSetRef.current.size;
        if (prev.queueSize === nextQueueSize && prev.decodeInflight === nextInflight) return prev;
        return {
          ...prev,
          queueSize: nextQueueSize,
          decodeInflight: nextInflight,
        };
      });
    });
  }, [runNonUrgentUpdate]);

  React.useEffect(() => {
    hydrationHydratedByIdRef.current = imageHydrationState.hydratedById;
  }, [imageHydrationState.hydratedById]);

  const flushHydratedImages = useCallback(() => {
    hydrationRafFlushRef.current = null;
    const pending = hydrationPendingLoadedRef.current;
    hydrationPendingLoadedRef.current = {};
    if (!Object.keys(pending).length) {
      syncImageHydrationState();
      return;
    }
    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => ({
        hydratedById: { ...prev.hydratedById, ...pending },
        queueSize: hydrationQueueRef.current.length,
        decodeInflight: hydrationInflightIdSetRef.current.size,
      }));
    });
  }, [runNonUrgentUpdate, syncImageHydrationState]);

  const scheduleHydrationFlush = useCallback(() => {
    if (hydrationRafFlushRef.current != null) return;
    if (typeof window === "undefined") return;
    hydrationRafFlushRef.current = window.requestAnimationFrame(() => {
      flushHydratedImages();
    });
  }, [flushHydratedImages]);

  const processHydrationQueue = useCallback(() => {
    if (!REFERENCE_GRID_FLAG_DECODE_BUDGET || typeof window === "undefined") return;
    const maxInflight = mediaWorkBudget.imageDecodeBudget;
    while (
      hydrationInflightIdSetRef.current.size < maxInflight &&
      hydrationQueueRef.current.length > 0
    ) {
      const nextId = hydrationQueueRef.current.shift();
      if (!nextId) continue;
      hydrationQueuedIdSetRef.current.delete(nextId);
      const nextUrl = hydrationUrlByIdRef.current[nextId];
      if (!nextUrl) continue;
      const fallbackUrl = hydrationFallbackUrlByIdRef.current[nextId];

      hydrationInflightIdSetRef.current.add(nextId);
      const image = new Image();
      image.decoding = "async";
      const shouldPrioritize = nextId === activeOutputId;
      try {
        (image as HTMLImageElement & { fetchPriority?: "high" | "low" | "auto" }).fetchPriority =
          shouldPrioritize ? "high" : "low";
      } catch {
        // Keep compatibility with runtimes that do not expose fetchPriority.
      }
      const finalize = (sourceUrl: string, renderUrl: string) => {
        hydrationInflightIdSetRef.current.delete(nextId);
        hydrationPendingLoadedRef.current[nextId] = {
          sourceUrl,
          renderUrl,
        };
        scheduleHydrationFlush();
        processHydrationQueueRef.current();
      };
      image.onload = () => {
        if (hydrationFailedOptimizedUrlByIdRef.current[nextId] === nextUrl) {
          delete hydrationFailedOptimizedUrlByIdRef.current[nextId];
        }
        void (async () => {
          const renderUrl = await maybeCreateLocalAdaptivePreviewUrl(nextId, nextUrl, image).catch(
            () => nextUrl
          );
          finalize(nextUrl, renderUrl);
        })();
      };
      image.onerror = () => {
        const resolvedFallback = fallbackUrl && fallbackUrl !== nextUrl ? fallbackUrl : nextUrl;
        if (isNextOptimizerUrl(nextUrl)) {
          hydrationFailedOptimizedUrlByIdRef.current[nextId] = nextUrl;
          if (resolvedFallback !== nextUrl) {
            hydrationUrlByIdRef.current[nextId] = resolvedFallback;
          }
        }
        finalize(resolvedFallback, resolvedFallback);
      };
      image.src = nextUrl;
    }
    syncImageHydrationState();
  }, [
    activeOutputId,
    mediaWorkBudget.imageDecodeBudget,
    maybeCreateLocalAdaptivePreviewUrl,
    scheduleHydrationFlush,
    syncImageHydrationState,
  ]);

  const enqueueImageHydration = useCallback(
    (
      id: string,
      url: string,
      options?: {
        priority?: "high" | "normal" | "low";
        targetLongEdgePx?: number;
        previewQualityBand?: ReferenceGridPreviewQualityBand;
        fallbackUrl?: string;
      }
    ) => {
      if (!REFERENCE_GRID_FLAG_DECODE_BUDGET) return;
      const previousUrl = hydrationUrlByIdRef.current[id];
      if (typeof options?.targetLongEdgePx === "number" && options.previewQualityBand) {
        hydrationPreviewMetaByIdRef.current[id] = {
          targetLongEdgePx: options.targetLongEdgePx,
          previewQualityBand: options.previewQualityBand,
        };
      }
      if (typeof options?.fallbackUrl === "string" && options.fallbackUrl.length > 0) {
        hydrationFallbackUrlByIdRef.current[id] = options.fallbackUrl;
      }
      const fallbackUrl = hydrationFallbackUrlByIdRef.current[id];
      const shouldBypassOptimizedUrl =
        isNextOptimizerUrl(url) &&
        hydrationFailedOptimizedUrlByIdRef.current[id] === url &&
        typeof fallbackUrl === "string" &&
        fallbackUrl.length > 0;
      const nextHydrationUrl = shouldBypassOptimizedUrl ? fallbackUrl : url;
      hydrationUrlByIdRef.current[id] = nextHydrationUrl;
      if (
        hydrationFailedOptimizedUrlByIdRef.current[id] &&
        hydrationFailedOptimizedUrlByIdRef.current[id] !== url
      ) {
        delete hydrationFailedOptimizedUrlByIdRef.current[id];
      }
      if (previousUrl && previousUrl !== nextHydrationUrl) {
        revokeGeneratedHydrationUrl(id);
      }
      const pendingHydratedEntry = hydrationPendingLoadedRef.current[id];
      if (pendingHydratedEntry?.sourceUrl === nextHydrationUrl) return;
      const hydratedEntry = hydrationHydratedByIdRef.current[id];
      if (hydratedEntry?.sourceUrl === nextHydrationUrl) return;
      if (hydrationInflightIdSetRef.current.has(id)) return;
      const priority = options?.priority ?? "normal";
      if (hydrationQueuedIdSetRef.current.has(id)) {
        if (priority === "high") {
          const currentIndex = hydrationQueueRef.current.indexOf(id);
          if (currentIndex > 0) {
            hydrationQueueRef.current.splice(currentIndex, 1);
            hydrationQueueRef.current.unshift(id);
          }
          syncImageHydrationState();
          processHydrationQueue();
        }
        return;
      }
      hydrationQueuedIdSetRef.current.add(id);
      if (priority === "high") {
        hydrationQueueRef.current.unshift(id);
      } else {
        hydrationQueueRef.current.push(id);
      }
      syncImageHydrationState();
      processHydrationQueue();
    },
    [processHydrationQueue, revokeGeneratedHydrationUrl, syncImageHydrationState]
  );

  React.useEffect(() => {
    processHydrationQueueRef.current = processHydrationQueue;
  }, [processHydrationQueue]);
  const normalizeMediaFiles = useCallback((files: File[]): File[] => {
    return dedupeMediaFiles(
      files
        .map((file, index) => normalizeMediaFile(file, null, index))
        .filter((file): file is File => Boolean(file))
    );
  }, []);

  const resolveCanvasDropMode = useCallback(
    (transfer: DataTransfer | null | undefined): CanvasDropMode => {
      if (!transfer) return "none";
      const normalizedTypes = Array.from(transfer.types || []).map((type) => type.toLowerCase());
      if (normalizedTypes.includes("text/reference-id")) return "none";
      if (transfer.files && transfer.files.length > 0) return "files";
      if (normalizedTypes.includes("files")) return "files";
      if (
        normalizedTypes.some(
          (type) =>
            type.includes("text") ||
            type.includes("plain") ||
            type.includes("prompt") ||
            type.includes("utf8")
        )
      ) {
        return "text";
      }
      return "none";
    },
    []
  );

  const canAcceptCanvasDrag = useCallback(
    (transfer: DataTransfer | null | undefined) => {
      return resolveCanvasDropMode(transfer) !== "none";
    },
    [resolveCanvasDropMode]
  );

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

  const syncVirtualMetricsForSurface = useCallback(
    ({
      scrollNode,
      gridNode,
      surface,
      setMetrics,
    }: {
      scrollNode: HTMLDivElement | null;
      gridNode: HTMLDivElement | null;
      surface: "all-refs" | "curated";
      setMetrics: React.Dispatch<
        React.SetStateAction<{
          scrollTop: number;
          viewportHeight: number;
          columnCount: number;
          rowHeight: number;
        }>
      >;
    }) => {
      if (!scrollNode || !gridNode) return;
      const defaultRequestedMaxColumns = selectedTool
        ? REFERENCE_GRID_MAX_COLUMNS
        : REFERENCE_GRID_MAX_COLUMNS_WIDE;
      const requestedMaxColumns =
        surface === "curated"
          ? Math.min(QUICK_SLOT_INVENTORY_MAX_COLUMNS, REFERENCE_GRID_MAX_COLUMNS_WIDE)
          : defaultRequestedMaxColumns;
      const emergencyMaxColumns =
        REFERENCE_GRID_FLAG_PERF_WATCHDOG && perfWatchdog.degradeLevel >= 2
          ? REFERENCE_GRID_EMERGENCY_MAX_COLUMNS
          : requestedMaxColumns;
      const maxColumns = Math.max(
        REFERENCE_GRID_MIN_COLUMNS,
        Math.min(Math.floor(requestedMaxColumns), Math.floor(emergencyMaxColumns))
      );
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
      setMetrics((prev) => {
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
    },
    [perfWatchdog.degradeLevel, selectedTool]
  );

  const syncVirtualMetrics = useCallback(() => {
    syncVirtualMetricsForSurface({
      scrollNode: scrollContainerRef.current,
      gridNode: gridRef.current,
      surface: "all-refs",
      setMetrics: setVirtualMetrics,
    });
  }, [syncVirtualMetricsForSurface]);

  const syncCuratedVirtualMetrics = useCallback(() => {
    if (!isCuratedSplitEnabled) return;
    syncVirtualMetricsForSurface({
      scrollNode: curatedScrollContainerRef.current,
      gridNode: curatedGridRef.current,
      surface: "curated",
      setMetrics: setCuratedVirtualMetrics,
    });
  }, [isCuratedSplitEnabled, syncVirtualMetricsForSurface]);

  const gridStyle = React.useMemo(
    () =>
      ({
        "--reference-grid-columns": String(
          Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount)
        ),
      }) as React.CSSProperties,
    [virtualMetrics.columnCount]
  );
  const curatedGridStyle = React.useMemo(
    () =>
      ({
        "--reference-grid-columns": String(
          Math.max(REFERENCE_GRID_MIN_COLUMNS, curatedVirtualMetrics.columnCount)
        ),
      }) as React.CSSProperties,
    [curatedVirtualMetrics.columnCount]
  );

  const dynamicOverscanRows = REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
    ? resolveReferenceGridOverscanRows(outputs.length, {
        pressureLevel: perfWatchdog.degradeLevel,
      })
    : REFERENCE_VIRTUAL_OVERSCAN_ROWS;
  const curatedOverscanRows = REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
    ? resolveReferenceGridOverscanRows(curatedOutputs.length, {
        pressureLevel: perfWatchdog.degradeLevel,
      })
    : REFERENCE_VIRTUAL_OVERSCAN_ROWS;
  const virtualWindow = calculateReferenceGridWindow({
    itemCount: outputs.length,
    columnCount: virtualMetrics.columnCount,
    rowHeight: virtualMetrics.rowHeight,
    scrollTop: virtualMetrics.scrollTop,
    viewportHeight:
      virtualMetrics.viewportHeight > 0
        ? virtualMetrics.viewportHeight
        : FALLBACK_REFERENCE_ROW_HEIGHT * 5,
    overscanRows: dynamicOverscanRows,
    virtualizeMinItems: REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
      ? REFERENCE_VIRTUALIZE_MIN_ITEMS
      : 24,
  });
  const curatedVirtualWindow = isCuratedSplitEnabled
    ? calculateReferenceGridWindow({
        itemCount: curatedOutputs.length,
        columnCount: curatedVirtualMetrics.columnCount,
        rowHeight: curatedVirtualMetrics.rowHeight,
        scrollTop: curatedVirtualMetrics.scrollTop,
        viewportHeight:
          curatedVirtualMetrics.viewportHeight > 0
            ? curatedVirtualMetrics.viewportHeight
            : FALLBACK_REFERENCE_ROW_HEIGHT * 3,
        overscanRows: curatedOverscanRows,
        virtualizeMinItems: REFERENCE_GRID_FLAG_DYNAMIC_VIRTUALIZATION
          ? REFERENCE_VIRTUALIZE_MIN_ITEMS
          : 24,
      })
    : {
        shouldVirtualize: false,
        totalRows: 1,
        startRow: 0,
        endRow: 0,
        startIndex: 0,
        endIndex: curatedOutputs.length,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0,
      };
  const shouldVirtualize = virtualWindow.shouldVirtualize;
  const curatedShouldVirtualize = curatedVirtualWindow.shouldVirtualize;
  const isHighDensity = outputs.length >= REFERENCE_HIGH_DENSITY_CARD_COUNT;
  const denseVisualModeEnabled = REFERENCE_GRID_FLAG_DENSE_VISUAL_SIMPLIFY && outputs.length >= 40;
  const startIndex = virtualWindow.startIndex;
  const endIndex = virtualWindow.endIndex;
  const curatedStartIndex = curatedVirtualWindow.startIndex;
  const curatedEndIndex = curatedVirtualWindow.endIndex;
  const baseVisibleOutputs = shouldVirtualize ? outputs.slice(startIndex, endIndex) : outputs;
  const visibleRows = Math.max(
    1,
    Math.ceil(
      (virtualMetrics.viewportHeight > 0
        ? virtualMetrics.viewportHeight
        : FALLBACK_REFERENCE_ROW_HEIGHT * 5) / Math.max(1, virtualMetrics.rowHeight)
    )
  );
  const hardViewportVisibleLimit =
    (visibleRows + Math.max(0, dynamicOverscanRows) * 2) *
    Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount);
  const visibleOutputs = React.useMemo(() => {
    if (!REFERENCE_GRID_FLAG_HARD_VIEWPORT_CAP) {
      return baseVisibleOutputs;
    }
    if (baseVisibleOutputs.length <= hardViewportVisibleLimit) {
      return baseVisibleOutputs;
    }
    const capped = baseVisibleOutputs.slice(0, Math.max(1, hardViewportVisibleLimit));
    if (!activeOutputId) return capped;
    if (capped.some((item) => item.id === activeOutputId)) return capped;
    const activeOutput = outputs.find((item) => item.id === activeOutputId);
    if (!activeOutput) return capped;
    if (capped.length === 0) return [activeOutput];
    return [...capped.slice(0, capped.length - 1), activeOutput];
  }, [activeOutputId, baseVisibleOutputs, hardViewportVisibleLimit, outputs]);
  const visibleCuratedOutputs = curatedShouldVirtualize
    ? curatedOutputs.slice(curatedStartIndex, curatedEndIndex)
    : curatedOutputs;
  const topSpacerHeight = virtualWindow.topSpacerHeight;
  const bottomSpacerHeight = virtualWindow.bottomSpacerHeight;
  const curatedTopSpacerHeight = curatedVirtualWindow.topSpacerHeight;
  const curatedBottomSpacerHeight = curatedVirtualWindow.bottomSpacerHeight;
  const renderedItemCount = visibleOutputs.length;
  const renderedOutputIdSet = React.useMemo(() => {
    const ids = new Set(visibleOutputs.map((output) => output.id));
    if (isCuratedSplitEnabled) {
      visibleCuratedOutputs.forEach((output) => ids.add(output.id));
    }
    return ids;
  }, [isCuratedSplitEnabled, visibleCuratedOutputs, visibleOutputs]);
  const archiveCount = archivedOutputs.length;
  const nearViewportOutputs = React.useMemo(() => {
    if (!shouldVirtualize) return [];
    const nearSpan = Math.max(1, virtualMetrics.columnCount);
    const start = Math.max(0, startIndex - nearSpan);
    const end = Math.min(outputs.length, endIndex + nearSpan);
    return outputs.slice(start, end);
  }, [endIndex, outputs, shouldVirtualize, startIndex, virtualMetrics.columnCount]);
  const nearViewportCuratedOutputs = React.useMemo(() => {
    if (!isCuratedSplitEnabled || !curatedShouldVirtualize) return [];
    const nearSpan = Math.max(1, curatedVirtualMetrics.columnCount);
    const start = Math.max(0, curatedStartIndex - nearSpan);
    const end = Math.min(curatedOutputs.length, curatedEndIndex + nearSpan);
    return curatedOutputs.slice(start, end);
  }, [
    curatedEndIndex,
    curatedOutputs,
    curatedShouldVirtualize,
    curatedStartIndex,
    curatedVirtualMetrics.columnCount,
    isCuratedSplitEnabled,
  ]);
  const recomputeAutoplayBudget = useCallback(() => {
    const visibleOutputIdSet = new Set<string>();
    videoVisibleKeySetRef.current.forEach((key) => {
      const outputId = videoOutputIdByKeyRef.current.get(key);
      if (outputId) {
        visibleOutputIdSet.add(outputId);
      }
    });
    const visibleVideoIds = outputs
      .filter((output) => {
        const resolvedPreview = resolveReferenceCardUrls(output, {
          strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
        }).previewUrl;
        if (!resolvedPreview || !isOutputVideoPreview(output, resolvedPreview)) return false;
        return visibleOutputIdSet.has(output.id);
      })
      .map((output) => output.id);
    const prioritizedVideoIds =
      activeOutputId && visibleVideoIds.includes(activeOutputId)
        ? [activeOutputId, ...visibleVideoIds.filter((id) => id !== activeOutputId)]
        : visibleVideoIds;
    if (perfWatchdog.degradeLevel >= 2) {
      runNonUrgentUpdate(() => {
        setAutoplayEnabledIds((prev) => (prev.length === 0 ? prev : []));
      });
      return;
    }
    const nextEnabled = prioritizedVideoIds.slice(
      0,
      Math.max(0, mediaWorkBudget.videoAttachBudget)
    );
    runNonUrgentUpdate(() => {
      setAutoplayEnabledIds((prev) => (areIdListsEqual(prev, nextEnabled) ? prev : nextEnabled));
    });
  }, [
    activeOutputId,
    mediaWorkBudget.videoAttachBudget,
    outputs,
    perfWatchdog.degradeLevel,
    runNonUrgentUpdate,
  ]);

  React.useEffect(() => {
    recomputeAutoplayBudgetRef.current = recomputeAutoplayBudget;
  }, [recomputeAutoplayBudget]);

  React.useEffect(() => {
    desiredVideoAttachBudgetRef.current = desiredVideoAttachBudget;
  }, [desiredVideoAttachBudget]);

  React.useEffect(() => {
    autoplayEnabledIdsStateRef.current = autoplayEnabledIds;
  }, [autoplayEnabledIds]);

  const baseHydrationPriorityRows = REFERENCE_GRID_FLAG_DECODE_BUDGET
    ? hydrationBudget.priorityRows
    : REFERENCE_PRIORITY_HYDRATION_ROWS;
  const hydrationPriorityCount =
    Math.max(REFERENCE_GRID_MIN_COLUMNS, virtualMetrics.columnCount) * baseHydrationPriorityRows;
  const curatedHydrationPriorityCount =
    Math.max(REFERENCE_GRID_MIN_COLUMNS, curatedVirtualMetrics.columnCount) *
    baseHydrationPriorityRows;
  const buildVisibleCardItems = useCallback(
    (rows: StudioOutput[], priorityCount: number) =>
      rows.map((item, visibleIndex) => {
        const resolvedCardUrls = resolveReferenceCardUrls(item, {
          strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
          adaptivePreviewQuality:
            REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY || REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW,
          pressureLevel: previewQualityPressureLevel,
        });
        const cardPreviewUrl = resolvedCardUrls.previewUrl ?? resolvedCardUrls.fullUrl;
        const isVideoPreview = isOutputVideoPreview(item, cardPreviewUrl);
        const isImagePreview = cardPreviewUrl ? !isVideoPreview : false;
        const isPriorityHydration = visibleIndex < priorityCount || activeOutputId === item.id;
        const hydratedEntry = imageHydrationState.hydratedById[item.id];
        const fallbackSourceForCard =
          item.fullStoragePath ??
          item.previewStoragePath ??
          item.previewUrl ??
          resolvedCardUrls.fullUrl ??
          null;
        const hasHydratedSourceForCard =
          hydratedEntry?.sourceUrl === cardPreviewUrl ||
          (typeof cardPreviewUrl === "string" &&
            isNextOptimizerUrl(cardPreviewUrl) &&
            typeof fallbackSourceForCard === "string" &&
            hydratedEntry?.sourceUrl === fallbackSourceForCard);
        const imageSrc =
          isImagePreview && REFERENCE_GRID_FLAG_DECODE_BUDGET
            ? hasHydratedSourceForCard
              ? (hydratedEntry.renderUrl ?? undefined)
              : undefined
            : (cardPreviewUrl ?? undefined);
        return {
          item,
          cardPreviewUrl,
          previewQualityBand: resolvedCardUrls.previewQualityBand ?? "high",
          targetLongEdgePx: resolvedCardUrls.targetLongEdgePx ?? 960,
          isVideoPreview,
          isImagePreview,
          isPriorityHydration,
          imageSrc,
        };
      }),
    [activeOutputId, imageHydrationState.hydratedById, previewQualityPressureLevel]
  );
  const visibleCardItems = React.useMemo(
    () => buildVisibleCardItems(visibleOutputs, hydrationPriorityCount),
    [buildVisibleCardItems, hydrationPriorityCount, visibleOutputs]
  );
  const curatedVisibleCardItems = React.useMemo(
    () => buildVisibleCardItems(visibleCuratedOutputs, curatedHydrationPriorityCount),
    [buildVisibleCardItems, curatedHydrationPriorityCount, visibleCuratedOutputs]
  );
  const allVisibleCardItems = React.useMemo(
    () => [...curatedVisibleCardItems, ...visibleCardItems],
    [curatedVisibleCardItems, visibleCardItems]
  );
  React.useEffect(() => {
    if (typeof performance === "undefined") return;
    const nextVisibleUrlById: Record<string, string | null> = {};
    const previousVisibleUrlById = previousVisiblePreviewUrlByIdRef.current;
    let swappedCount = 0;
    visibleCardItems.forEach((card) => {
      const nextUrl = card.cardPreviewUrl ?? null;
      nextVisibleUrlById[card.item.id] = nextUrl;
      const previousUrl = previousVisibleUrlById[card.item.id];
      if (typeof previousUrl !== "string") return;
      if (previousUrl === nextUrl) return;
      swappedCount += 1;
    });
    previousVisiblePreviewUrlByIdRef.current = nextVisibleUrlById;
    if (swappedCount === 0) return;

    const nowMs = performance.now();
    if (previewSwapTelemetryRef.current.windowStartedAtMs <= 0) {
      previewSwapTelemetryRef.current.windowStartedAtMs = nowMs;
    }
    previewSwapTelemetryRef.current.totalSwapCount += swappedCount;
    const repaintSpikeThreshold = Math.max(6, Math.floor(renderedItemCount * 0.75));
    if (swappedCount >= repaintSpikeThreshold) {
      previewSwapTelemetryRef.current.repaintSpikeCount += 1;
    }

    const elapsedMs = Math.max(1, nowMs - previewSwapTelemetryRef.current.windowStartedAtMs);
    const swapRatePerMinute = Math.round(
      (previewSwapTelemetryRef.current.totalSwapCount * 60_000) / elapsedMs
    );
    const repaintSpikeCount = previewSwapTelemetryRef.current.repaintSpikeCount;
    setPreviewSwapMetrics((prev) => {
      if (
        prev.swapRatePerMinute === swapRatePerMinute &&
        prev.repaintSpikeCount === repaintSpikeCount &&
        prev.lastSwapBurstCount === swappedCount
      ) {
        return prev;
      }
      return {
        swapRatePerMinute,
        repaintSpikeCount,
        lastSwapBurstCount: swappedCount,
      };
    });
  }, [renderedItemCount, visibleCardItems]);
  React.useEffect(() => {
    if (outputs.length > 0) return;
    previousVisiblePreviewUrlByIdRef.current = {};
    previewSwapTelemetryRef.current = {
      windowStartedAtMs: 0,
      totalSwapCount: 0,
      repaintSpikeCount: 0,
    };
    setPreviewSwapMetrics((prev) => {
      if (
        prev.swapRatePerMinute === 0 &&
        prev.repaintSpikeCount === 0 &&
        prev.lastSwapBurstCount === 0
      ) {
        return prev;
      }
      return {
        swapRatePerMinute: 0,
        repaintSpikeCount: 0,
        lastSwapBurstCount: 0,
      };
    });
  }, [outputs.length]);
  const loadingCardState = React.useMemo(() => {
    const nextLoadingIds: string[] = [];
    const nextSpinnerCandidateIds: string[] = [];
    allVisibleCardItems.forEach((card) => {
      const isFailing = card.item.taskState === "fail";
      const isLoading =
        !isFailing &&
        (card.item.taskState === "running" ||
          card.item.taskState === "pending" ||
          (card.item.taskState === "success" && !card.cardPreviewUrl && !card.item.previewText));
      if (isLoading) {
        nextSpinnerCandidateIds.push(card.item.id);
      }
      const isLoaded = loadedMap[card.item.id];
      const shouldShowLoading =
        !isFailing &&
        (isLoading ||
          (!isLoaded && !card.item.previewText) ||
          (card.isImagePreview &&
            REFERENCE_GRID_FLAG_DECODE_BUDGET &&
            !card.imageSrc &&
            card.isPriorityHydration));
      if (shouldShowLoading) {
        nextLoadingIds.push(card.item.id);
      }
    });
    return {
      loadingIds: nextLoadingIds,
      spinnerCandidateIds: nextSpinnerCandidateIds,
    };
  }, [allVisibleCardItems, loadedMap]);
  const pendingCardIdSet = React.useMemo(
    () => new Set(loadingCardState.loadingIds),
    [loadingCardState.loadingIds]
  );
  const spinnerCandidateIdSet = React.useMemo(
    () => new Set(loadingCardState.spinnerCandidateIds),
    [loadingCardState.spinnerCandidateIds]
  );
  const maxAnimatedSpinners = React.useMemo(() => {
    if (perfWatchdog.degradeLevel >= 2) return REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_2;
    if (perfWatchdog.degradeLevel >= 1) return REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_1;
    return REFERENCE_MAX_ANIMATED_SPINNERS_LEVEL_0;
  }, [perfWatchdog.degradeLevel]);
  // Pending outputs are inserted at index 0; reverse yields FIFO by generation age.
  const pendingSpinnerQueueIds = React.useMemo(
    () => [...loadingCardState.spinnerCandidateIds].reverse(),
    [loadingCardState.spinnerCandidateIds]
  );
  const spinnerSlotIds = React.useMemo(
    () => pendingSpinnerQueueIds.slice(0, Math.max(1, maxAnimatedSpinners)),
    [maxAnimatedSpinners, pendingSpinnerQueueIds]
  );
  const spinnerSlotIdSet = React.useMemo(() => new Set(spinnerSlotIds), [spinnerSlotIds]);
  const transformedAdaptivePreviewCount = React.useMemo(() => {
    let count = 0;
    visibleCardItems.forEach((card) => {
      const url = card.cardPreviewUrl;
      if (!url) return;
      if (hasAdaptiveQueryParams(url) || isNextOptimizerUrl(url)) {
        count += 1;
        return;
      }
      const hydratedEntry = imageHydrationState.hydratedById[card.item.id];
      if (!hydratedEntry) return;
      if (hydratedEntry.sourceUrl !== url) return;
      if (hydratedEntry.renderUrl === hydratedEntry.sourceUrl) return;
      if (!hydratedEntry.renderUrl.startsWith("blob:")) return;
      count += 1;
    });
    return count;
  }, [imageHydrationState.hydratedById, visibleCardItems]);

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_DECODE_BUDGET) return;
    const candidateIdSet = new Set<string>();
    if (activeOutputId) {
      const activeOutput = outputs.find((item) => item.id === activeOutputId);
      if (activeOutput) {
        const resolved = resolveReferenceCardUrls(activeOutput, {
          strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
          adaptivePreviewQuality: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
          pressureLevel: previewQualityPressureLevel,
        });
        const activeUrl = resolved.previewUrl ?? resolved.fullUrl;
        if (activeUrl && !isOutputVideoPreview(activeOutput, activeUrl)) {
          candidateIdSet.add(activeOutputId);
          enqueueImageHydration(activeOutputId, activeUrl, {
            priority: "high",
            targetLongEdgePx: resolved.targetLongEdgePx,
            previewQualityBand: resolved.previewQualityBand,
            fallbackUrl:
              resolved.fullUrl ??
              activeOutput.fullStoragePath ??
              activeOutput.previewStoragePath ??
              activeOutput.previewUrl ??
              undefined,
          });
        }
      }
    }
    visibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl:
          card.item.fullStoragePath ??
          card.item.previewStoragePath ??
          card.item.previewUrl ??
          undefined,
      });
    });
    curatedVisibleCardItems.forEach((card) => {
      if (!card.isImagePreview || !card.cardPreviewUrl) return;
      if (candidateIdSet.has(card.item.id)) return;
      candidateIdSet.add(card.item.id);
      enqueueImageHydration(card.item.id, card.cardPreviewUrl, {
        priority: card.isPriorityHydration ? "high" : "normal",
        targetLongEdgePx: card.targetLongEdgePx,
        previewQualityBand: card.previewQualityBand,
        fallbackUrl:
          card.item.fullStoragePath ??
          card.item.previewStoragePath ??
          card.item.previewUrl ??
          undefined,
      });
    });
    nearViewportOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolved = resolveReferenceCardUrls(item, {
        strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
        adaptivePreviewQuality: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
        pressureLevel: previewQualityPressureLevel,
      });
      const previewUrl = resolved.previewUrl ?? resolved.fullUrl;
      if (!previewUrl || isOutputVideoPreview(item, previewUrl)) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, previewUrl, {
        priority: "low",
        targetLongEdgePx: resolved.targetLongEdgePx,
        previewQualityBand: resolved.previewQualityBand,
        fallbackUrl:
          resolved.fullUrl ??
          item.fullStoragePath ??
          item.previewStoragePath ??
          item.previewUrl ??
          undefined,
      });
    });
    nearViewportCuratedOutputs.forEach((item) => {
      if (candidateIdSet.has(item.id)) return;
      const resolved = resolveReferenceCardUrls(item, {
        strictPreviewLadder: REFERENCE_GRID_FLAG_STRICT_PREVIEW_LADDER,
        adaptivePreviewQuality: REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY,
        pressureLevel: previewQualityPressureLevel,
      });
      const previewUrl = resolved.previewUrl ?? resolved.fullUrl;
      if (!previewUrl || isOutputVideoPreview(item, previewUrl)) return;
      candidateIdSet.add(item.id);
      enqueueImageHydration(item.id, previewUrl, {
        priority: "low",
        targetLongEdgePx: resolved.targetLongEdgePx,
        previewQualityBand: resolved.previewQualityBand,
        fallbackUrl:
          resolved.fullUrl ??
          item.fullStoragePath ??
          item.previewStoragePath ??
          item.previewUrl ??
          undefined,
      });
    });
    const currentQueue = hydrationQueueRef.current;
    const nextQueue = currentQueue.filter((id) => candidateIdSet.has(id));
    const queueChanged =
      nextQueue.length !== currentQueue.length ||
      nextQueue.some((id, index) => currentQueue[index] !== id);
    if (queueChanged) {
      hydrationQueueRef.current = nextQueue;
      hydrationQueuedIdSetRef.current = new Set(nextQueue);
      syncImageHydrationState();
      processHydrationQueue();
    }
  }, [
    activeOutputId,
    curatedVisibleCardItems,
    enqueueImageHydration,
    nearViewportCuratedOutputs,
    nearViewportOutputs,
    outputs,
    previewQualityPressureLevel,
    processHydrationQueue,
    syncImageHydrationState,
    visibleCardItems,
  ]);

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_DECODE_BUDGET) return;
    const validOutputIds = new Set(outputs.map((output) => output.id));
    Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      revokeGeneratedHydrationUrl(id);
    });
    Object.keys(hydrationPreviewMetaByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationPreviewMetaByIdRef.current[id];
    });
    Object.keys(hydrationUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationUrlByIdRef.current[id];
    });
    Object.keys(hydrationFallbackUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationFallbackUrlByIdRef.current[id];
    });
    Object.keys(hydrationFailedOptimizedUrlByIdRef.current).forEach((id) => {
      if (validOutputIds.has(id)) return;
      delete hydrationFailedOptimizedUrlByIdRef.current[id];
    });

    // Avoid dispatching a no-op state update on every render; only prune when stale hydrated ids exist.
    const hasStaleHydratedIds = Object.keys(hydrationHydratedByIdRef.current).some(
      (id) => !validOutputIds.has(id)
    );
    if (!hasStaleHydratedIds) return;

    runNonUrgentUpdate(() => {
      setImageHydrationState((prev) => {
        let changed = false;
        const nextHydratedById = Object.fromEntries(
          Object.entries(prev.hydratedById).filter(([id]) => {
            const keep = validOutputIds.has(id);
            if (!keep) changed = true;
            return keep;
          })
        );
        if (!changed) return prev;
        return {
          ...prev,
          hydratedById: nextHydratedById,
        };
      });
    });
  }, [outputs, revokeGeneratedHydrationUrl, runNonUrgentUpdate]);

  const resolveVideoSurfaceFromNodeKey = useCallback(
    (nodeKey: string): "all-refs" | "curated" =>
      nodeKey.startsWith("curated:") ? "curated" : "all-refs",
    []
  );

  const registerVideoNode = useCallback(
    (nodeKey: string, outputId: string, node: HTMLVideoElement | null) => {
      const currentNode = videoNodeByKeyRef.current.get(nodeKey);
      if (currentNode && currentNode !== node) {
        videoIntersectionObserverBySurfaceRef.current.forEach((observer) => {
          observer.unobserve(currentNode);
        });
        videoNodeByKeyRef.current.delete(nodeKey);
      }
      if (!node) {
        const detachTimeout = videoDetachTimeoutByKeyRef.current.get(nodeKey);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByKeyRef.current.delete(nodeKey);
        }
        videoNodeByKeyRef.current.delete(nodeKey);
        videoOutputIdByKeyRef.current.delete(nodeKey);
        if (videoVisibleKeySetRef.current.delete(nodeKey)) {
          recomputeAutoplayBudget();
        }
        return;
      }
      const surface = resolveVideoSurfaceFromNodeKey(nodeKey);
      node.dataset.outputId = outputId;
      node.dataset.outputKey = nodeKey;
      node.dataset.referenceSurface = surface;
      videoNodeByKeyRef.current.set(nodeKey, node);
      videoOutputIdByKeyRef.current.set(nodeKey, outputId);
      videoIntersectionObserverBySurfaceRef.current.get(surface)?.observe(node);
    },
    [recomputeAutoplayBudget, resolveVideoSurfaceFromNodeKey]
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
      const isConstrained = saveData || isSlowNetwork || isLowMemory;
      const nextBudget = isConstrained
        ? REFERENCE_AUTOPLAY_MAX_CONSTRAINED
        : isSmallScreen
          ? REFERENCE_AUTOPLAY_MAX_SMALL_SCREEN
          : REFERENCE_AUTOPLAY_MAX_DESKTOP;
      if (desiredVideoAttachBudgetRef.current !== nextBudget) {
        desiredVideoAttachBudgetRef.current = nextBudget;
        setDesiredVideoAttachBudget(nextBudget);
      }
      if (
        isConstrained &&
        autoplayEnabledIdsStateRef.current.length > REFERENCE_AUTOPLAY_MAX_CONSTRAINED
      ) {
        runNonUrgentUpdate(() => {
          setAutoplayEnabledIds((prev) =>
            prev.length <= REFERENCE_AUTOPLAY_MAX_CONSTRAINED
              ? prev
              : prev.slice(0, REFERENCE_AUTOPLAY_MAX_CONSTRAINED)
          );
        });
      }
      recomputeAutoplayBudgetRef.current();
    };
    refreshBudget();
    window.addEventListener("resize", refreshBudget);
    connection?.addEventListener?.("change", refreshBudget);
    return () => {
      window.removeEventListener("resize", refreshBudget);
      connection?.removeEventListener?.("change", refreshBudget);
    };
  }, [runNonUrgentUpdate]);

  React.useEffect(() => {
    const validOutputIdSet = new Set(outputs.map((output) => output.id));
    let removedAny = false;
    videoOutputIdByKeyRef.current.forEach((outputId, nodeKey) => {
      if (validOutputIdSet.has(outputId)) return;
      if (videoVisibleKeySetRef.current.delete(nodeKey)) {
        removedAny = true;
      }
      const timeoutId = videoDetachTimeoutByKeyRef.current.get(nodeKey);
      if (timeoutId != null) {
        window.clearTimeout(timeoutId);
      }
      videoDetachTimeoutByKeyRef.current.delete(nodeKey);
      const node = videoNodeByKeyRef.current.get(nodeKey);
      if (node) {
        videoIntersectionObserverBySurfaceRef.current.forEach((observer) =>
          observer.unobserve(node)
        );
      }
      videoNodeByKeyRef.current.delete(nodeKey);
      videoOutputIdByKeyRef.current.delete(nodeKey);
    });
    videoDetachTimeoutByKeyRef.current.forEach((timeoutId, nodeKey) => {
      if (videoOutputIdByKeyRef.current.has(nodeKey)) return;
      window.clearTimeout(timeoutId);
      videoDetachTimeoutByKeyRef.current.delete(nodeKey);
    });
    if (removedAny) {
      recomputeAutoplayBudget();
    }
  }, [outputs, recomputeAutoplayBudget]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    syncVirtualMetrics();
    syncCuratedVirtualMetrics();
    const scrollNode = scrollContainerRef.current;
    const gridNode = gridRef.current;
    const curatedScrollNode = curatedScrollContainerRef.current;
    const curatedGridNode = curatedGridRef.current;
    if (!scrollNode || !gridNode) return;
    const handleResize = () => {
      syncVirtualMetrics();
      syncCuratedVirtualMetrics();
    };
    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            syncVirtualMetrics();
            syncCuratedVirtualMetrics();
          })
        : null;
    observer?.observe(scrollNode);
    observer?.observe(gridNode);
    if (isCuratedSplitEnabled && curatedScrollNode && curatedGridNode) {
      observer?.observe(curatedScrollNode);
      observer?.observe(curatedGridNode);
    }
    window.addEventListener("resize", handleResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [
    isCuratedSplitEnabled,
    outputs.length,
    selectedTool,
    syncCuratedVirtualMetrics,
    syncVirtualMetrics,
    curatedOutputs.length,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const allRefsRoot = scrollContainerRef.current;
    if (!allRefsRoot) return;
    const observerBySurface = new Map<"all-refs" | "curated", IntersectionObserver>();
    const createObserver = (root: Element | null) =>
      new IntersectionObserver(
        (entries) => {
          let changed = false;
          entries.forEach((entry) => {
            const nodeKey = (entry.target as HTMLElement).dataset.outputKey;
            if (!nodeKey) return;
            const isVisible =
              entry.isIntersecting &&
              entry.intersectionRatio >= REFERENCE_AUTOPLAY_VISIBILITY_THRESHOLD;
            if (isVisible) {
              if (!videoVisibleKeySetRef.current.has(nodeKey)) {
                videoVisibleKeySetRef.current.add(nodeKey);
                changed = true;
              }
              return;
            }
            if (videoVisibleKeySetRef.current.delete(nodeKey)) {
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
    const allRefsObserver = createObserver(allRefsRoot);
    observerBySurface.set("all-refs", allRefsObserver);
    if (isCuratedSplitEnabled && curatedScrollContainerRef.current) {
      observerBySurface.set("curated", createObserver(curatedScrollContainerRef.current));
    }
    videoIntersectionObserverBySurfaceRef.current = observerBySurface;
    videoNodeByKeyRef.current.forEach((node, nodeKey) => {
      const surface = resolveVideoSurfaceFromNodeKey(nodeKey);
      observerBySurface.get(surface)?.observe(node);
    });
    return () => {
      observerBySurface.forEach((observer) => observer.disconnect());
      videoIntersectionObserverBySurfaceRef.current.clear();
    };
  }, [isCuratedSplitEnabled, recomputeAutoplayBudget, resolveVideoSurfaceFromNodeKey]);

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
    videoNodeByKeyRef.current.forEach((node, nodeKey) => {
      const outputId = videoOutputIdByKeyRef.current.get(nodeKey);
      if (!outputId) return;
      if (enabledSet.has(outputId)) {
        const detachTimeout = videoDetachTimeoutByKeyRef.current.get(nodeKey);
        if (detachTimeout) {
          window.clearTimeout(detachTimeout);
          videoDetachTimeoutByKeyRef.current.delete(nodeKey);
        }
        return;
      }
      node.pause();
      if (videoDetachTimeoutByKeyRef.current.has(nodeKey)) return;
      const timeoutId = window.setTimeout(() => {
        const currentOutputId = videoOutputIdByKeyRef.current.get(nodeKey);
        if (currentOutputId && autoplayEnabledIdSet.has(currentOutputId)) return;
        node.pause();
        node.removeAttribute("src");
        node.load();
        if (currentOutputId) {
          autoplayingIdsRef.current.delete(currentOutputId);
        }
        videoDetachTimeoutByKeyRef.current.delete(nodeKey);
      }, REFERENCE_AUTOPLAY_DETACH_DELAY_MS);
      videoDetachTimeoutByKeyRef.current.set(nodeKey, timeoutId);
    });
  }, [autoplayEnabledIdSet, autoplayEnabledIds]);

  React.useEffect(() => {
    const detachTimeoutById = videoDetachTimeoutByKeyRef.current;
    return () => {
      detachTimeoutById.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      detachTimeoutById.clear();
    };
  }, []);

  React.useEffect(
    () => () => {
      if (allRefsScrollRafIdRef.current != null) {
        window.cancelAnimationFrame(allRefsScrollRafIdRef.current);
        allRefsScrollRafIdRef.current = null;
      }
      if (curatedScrollRafIdRef.current != null) {
        window.cancelAnimationFrame(curatedScrollRafIdRef.current);
        curatedScrollRafIdRef.current = null;
      }
      if (hydrationRafFlushRef.current != null) {
        window.cancelAnimationFrame(hydrationRafFlushRef.current);
        hydrationRafFlushRef.current = null;
      }
      Object.keys(hydrationGeneratedObjectUrlByIdRef.current).forEach((id) => {
        revokeGeneratedHydrationUrl(id);
      });
    },
    [revokeGeneratedHydrationUrl]
  );

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_RENDER_COMMIT_TELEMETRY) return;
    if (typeof performance === "undefined") return;
    const now = performance.now();
    const durationMs =
      lastRenderCommitAtRef.current > 0
        ? Math.max(0, Math.round(now - lastRenderCommitAtRef.current))
        : 0;
    lastRenderCommitAtRef.current = now;
    logMediaPerf("media.grid.render.commit", {
      surface: "reference-grid",
      rendered_item_count: renderedItemCount,
      total_item_count: outputs.length,
      virtualized: shouldVirtualize,
      high_density: isHighDensity,
      image_hydration_queue: imageHydrationState.queueSize,
      image_decode_inflight: imageHydrationState.decodeInflight,
      perf_degrade_level: perfWatchdog.degradeLevel,
      preview_src_swap_rate_per_minute: previewSwapMetrics.swapRatePerMinute,
      preview_repaint_spike_count: previewSwapMetrics.repaintSpikeCount,
      preview_last_swap_burst_count: previewSwapMetrics.lastSwapBurstCount,
      duration_ms: durationMs,
    });
  }, [
    endIndex,
    imageHydrationState.decodeInflight,
    imageHydrationState.queueSize,
    isHighDensity,
    outputs.length,
    perfWatchdog.degradeLevel,
    previewSwapMetrics.lastSwapBurstCount,
    previewSwapMetrics.repaintSpikeCount,
    previewSwapMetrics.swapRatePerMinute,
    renderedItemCount,
    shouldVirtualize,
    startIndex,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof PerformanceObserver === "undefined") return;
    const observer = new PerformanceObserver((entryList) => {
      entryList.getEntries().forEach((entry) => {
        logMediaPerf("media.grid.longtask.sample", {
          surface: "reference-grid",
          duration_ms: Math.round(entry.duration),
          name: entry.name,
        });
      });
    });
    try {
      observer.observe({ type: "longtask", buffered: true });
    } catch {
      observer.disconnect();
      return;
    }
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!REFERENCE_GRID_FLAG_TELEMETRY_BACKPRESSURE) return;
    const shouldDefer =
      perfWatchdog.degradeLevel >= 1 ||
      canvasDropMode !== "none" ||
      isCuratedDropActive ||
      loadingCardState.loadingIds.length > 8;
    setMediaPerfSamplingPolicy(shouldDefer ? "defer_non_critical" : "normal");
    return () => {
      setMediaPerfSamplingPolicy("normal");
    };
  }, [
    canvasDropMode,
    isCuratedDropActive,
    loadingCardState.loadingIds.length,
    perfWatchdog.degradeLevel,
  ]);

  const markLoaded = useCallback(
    (id: string, options?: { notifyAutoSave?: boolean }) => {
      const shouldNotify = options?.notifyAutoSave ?? true;
      if (loadedIdsRef.current.has(id)) return;
      loadedIdsRef.current.add(id);
      runNonUrgentUpdate(() => {
        setLoadedMap((prev) => {
          if (prev[id]) return prev;
          return { ...prev, [id]: true };
        });
      });
      if (shouldNotify) {
        onOutputMediaLoaded?.(id);
      }
    },
    [onOutputMediaLoaded, runNonUrgentUpdate]
  );

  const handleCanvasDrop = (event: React.DragEvent<HTMLDivElement>) => {
    canvasDragDepthRef.current = 0;
    setCanvasDropModeSafe("none");
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
    const nextDropMode = resolveCanvasDropMode(event.dataTransfer);
    if (nextDropMode === "none") return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setCanvasDropModeSafe(nextDropMode);
  };

  const handleCanvasDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    const nextDropMode = resolveCanvasDropMode(event.dataTransfer);
    if (nextDropMode === "none") return;
    event.preventDefault();
    canvasDragDepthRef.current += 1;
    setCanvasDropModeSafe(nextDropMode);
  };

  const handleCanvasDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!canAcceptCanvasDrag(event.dataTransfer)) return;
    event.preventDefault();
    canvasDragDepthRef.current = Math.max(0, canvasDragDepthRef.current - 1);
    if (canvasDragDepthRef.current === 0) {
      setCanvasDropModeSafe("none");
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
      const curatedSectionNode = curatedSectionRef.current;
      const insideCuratedSection =
        Boolean(targetElement && curatedSectionNode?.contains(targetElement)) ||
        Boolean(activeElement && curatedSectionNode?.contains(activeElement));
      if (insideCuratedSection) return;
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

  React.useEffect(() => {
    if (typeof document === "undefined") return;
    const clearDropState = () => {
      canvasDragDepthRef.current = 0;
      curatedDragDepthRef.current = 0;
      setCanvasDropModeSafe("none");
      setCuratedDropActiveSafe(false);
    };
    document.addEventListener("dragend", clearDropState);
    document.addEventListener("drop", clearDropState);
    return () => {
      document.removeEventListener("dragend", clearDropState);
      document.removeEventListener("drop", clearDropState);
    };
  }, [setCanvasDropModeSafe, setCuratedDropActiveSafe]);

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

  const handleCardDragStart = useCallback(
    (
      event: React.DragEvent<HTMLElement>,
      item: StudioOutput,
      sourceSurface: ReferenceDragSourceSurface
    ) => {
      prepareReferenceDrag(event, item, {
        dragImage: event.currentTarget as HTMLElement,
        sourceSurface,
      });
    },
    []
  );

  const handleCardDragEnd = useCallback((event: React.DragEvent<HTMLElement>) => {
    clearDragState(event);
  }, []);

  const hasInternalReferenceDrag = (transfer: DataTransfer): boolean => {
    const types = Array.from(transfer.types || []).map((value) => value.toLowerCase());
    if (types.includes("text/reference-id")) return true;
    return Boolean(transfer.getData("text/reference-id"));
  };

  const resolveReferenceDragSourceSurface = useCallback(
    (transfer: DataTransfer): ReferenceDragSourceSurface => {
      const sourceSurface = transfer.getData("text/reference-source-surface");
      return sourceSurface === "curated" ? "curated" : "all-refs";
    },
    []
  );

  const handleCuratedSectionDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = 0;
      setCuratedDropActiveSafe(false);
      const referenceId = event.dataTransfer.getData("text/reference-id").trim();
      if (!referenceId) return;
      const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
      if (sourceSurface === "all-refs") {
        if (curatedReferenceIds.includes(referenceId)) {
          onSelectOutput(referenceId);
          return;
        }
        onAddCuratedReference?.(referenceId);
        onSelectOutput(referenceId);
        return;
      }
      onReorderCuratedReference?.(referenceId, null, "end");
      onSelectOutput(referenceId);
    },
    [
      curatedReferenceIds,
      isCuratedSplitEnabled,
      onAddCuratedReference,
      onReorderCuratedReference,
      onSelectOutput,
      resolveReferenceDragSourceSurface,
      setCuratedDropActiveSafe,
    ]
  );

  const handleCuratedSectionDragOver = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      if (!hasInternalReferenceDrag(event.dataTransfer)) {
        event.dataTransfer.dropEffect = "none";
        setCuratedDropActiveSafe(false);
        return;
      }
      const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
      event.dataTransfer.dropEffect = sourceSurface === "curated" ? "move" : "copy";
      setCuratedDropActiveSafe(true);
    },
    [isCuratedSplitEnabled, resolveReferenceDragSourceSurface, setCuratedDropActiveSafe]
  );

  const handleCuratedSectionDragEnter = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current += 1;
      setCuratedDropActiveSafe(hasInternalReferenceDrag(event.dataTransfer));
    },
    [isCuratedSplitEnabled, setCuratedDropActiveSafe]
  );

  const handleCuratedSectionDragLeave = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = Math.max(0, curatedDragDepthRef.current - 1);
      if (curatedDragDepthRef.current === 0) {
        setCuratedDropActiveSafe(false);
      }
    },
    [isCuratedSplitEnabled, setCuratedDropActiveSafe]
  );

  const handleCuratedCardDrop = useCallback(
    (event: React.DragEvent<HTMLElement>, target: StudioOutput): void => {
      if (!isCuratedSplitEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      curatedDragDepthRef.current = 0;
      setCuratedDropActiveSafe(false);
      const referenceId = event.dataTransfer.getData("text/reference-id").trim();
      if (!referenceId) return;
      const sourceSurface = resolveReferenceDragSourceSurface(event.dataTransfer);
      if (sourceSurface === "all-refs") {
        if (curatedReferenceIds.includes(referenceId)) {
          onSelectOutput(referenceId);
          return;
        }
        onAddCuratedReference?.(referenceId);
        onSelectOutput(referenceId);
        return;
      }
      const rect = event.currentTarget.getBoundingClientRect();
      const placement: "before" | "after" =
        event.clientY < rect.top + rect.height / 2 ? "before" : "after";
      onReorderCuratedReference?.(referenceId, target.id, placement);
      onSelectOutput(referenceId);
    },
    [
      curatedReferenceIds,
      isCuratedSplitEnabled,
      onAddCuratedReference,
      onReorderCuratedReference,
      onSelectOutput,
      resolveReferenceDragSourceSurface,
      setCuratedDropActiveSafe,
    ]
  );

  const handleAllRefsScroll = useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      const node = event.currentTarget;
      queuedAllRefsScrollMetricsRef.current = {
        scrollTop: node.scrollTop,
        viewportHeight: node.clientHeight,
      };
      if (allRefsScrollRafIdRef.current == null && typeof window !== "undefined") {
        allRefsScrollRafIdRef.current = window.requestAnimationFrame(() => {
          allRefsScrollRafIdRef.current = null;
          const queuedMetrics = queuedAllRefsScrollMetricsRef.current;
          if (!queuedMetrics) return;
          setVirtualMetrics((prev) => {
            const next = {
              ...prev,
              scrollTop: queuedMetrics.scrollTop,
              viewportHeight: queuedMetrics.viewportHeight,
            };
            const stable =
              Math.abs(prev.scrollTop - next.scrollTop) < 1 &&
              Math.abs(prev.viewportHeight - next.viewportHeight) < 1;
            return stable ? prev : next;
          });
        });
      }
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
      const memory = (
        performance as Performance & {
          memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number };
        }
      ).memory;
      if (memory?.usedJSHeapSize && memory?.totalJSHeapSize) {
        logMediaPerf("media.grid.memory.sample", {
          surface: "reference-grid",
          used_js_heap_mb: Math.round(memory.usedJSHeapSize / (1024 * 1024)),
          total_js_heap_mb: Math.round(memory.totalJSHeapSize / (1024 * 1024)),
          visible_item_count: renderedItemCount,
          total_item_count: outputs.length,
        });
      }
    },
    [outputs.length, renderedItemCount]
  );

  const handleCuratedScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    queuedCuratedScrollMetricsRef.current = {
      scrollTop: node.scrollTop,
      viewportHeight: node.clientHeight,
    };
    if (curatedScrollRafIdRef.current == null && typeof window !== "undefined") {
      curatedScrollRafIdRef.current = window.requestAnimationFrame(() => {
        curatedScrollRafIdRef.current = null;
        const queuedMetrics = queuedCuratedScrollMetricsRef.current;
        if (!queuedMetrics) return;
        setCuratedVirtualMetrics((prev) => {
          const next = {
            ...prev,
            scrollTop: queuedMetrics.scrollTop,
            viewportHeight: queuedMetrics.viewportHeight,
          };
          const stable =
            Math.abs(prev.scrollTop - next.scrollTop) < 1 &&
            Math.abs(prev.viewportHeight - next.viewportHeight) < 1;
          return stable ? prev : next;
        });
      });
    }
  }, []);

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

  const renderReferenceCard = useCallback(
    (
      card: (typeof visibleCardItems)[number],
      options: {
        surface: ReferenceDragSourceSurface;
        isCuratedSurface: boolean;
      }
    ) => {
      const isFailing = card.item.taskState === "fail";
      const isLoading =
        !isFailing &&
        (card.item.taskState === "running" ||
          card.item.taskState === "pending" ||
          (card.item.taskState === "success" && !card.cardPreviewUrl && !card.item.previewText));
      const isPending = pendingCardIdSet.has(card.item.id);
      const isSpinnerCandidate = spinnerCandidateIdSet.has(card.item.id);
      const loadingVisual: "none" | "spinner" | "placeholder" | "pending" = isPending
        ? spinnerSlotIdSet.has(card.item.id)
          ? "spinner"
          : isSpinnerCandidate
            ? "pending"
            : "placeholder"
        : "none";
      const canAutoplayVideo =
        card.isVideoPreview &&
        autoplayEnabledIdSet.has(card.item.id) &&
        perfWatchdog.degradeLevel < 2;
      const isPromptOnly = !card.cardPreviewUrl && !!card.item.previewText;
      const isLinkedPromptReference = isPromptOnly && linkedPromptReferenceIdSet.has(card.item.id);
      const canRetryStatus = Boolean(onRetryStatus && card.item.taskId) && (isFailing || isLoading);
      const videoNodeKey = `${options.surface}:${card.item.id}`;
      return (
        <ReferenceCanvasCard
          key={options.isCuratedSurface ? `curated-${card.item.id}` : card.item.id}
          item={card.item}
          dragSourceSurface={options.surface}
          videoNodeKey={videoNodeKey}
          activeOutputId={activeOutputId}
          loadingVisual={loadingVisual}
          cardPreviewUrl={card.cardPreviewUrl}
          isVideoPreview={card.isVideoPreview}
          isImagePreview={card.isImagePreview}
          canAutoplayVideo={canAutoplayVideo}
          isPromptOnly={isPromptOnly}
          isLinkedPromptReference={isLinkedPromptReference}
          canRetryStatus={canRetryStatus}
          showPromptGenerate={showPromptGenerate}
          disablePromptGenerate={disablePromptGenerate}
          generateCostCredits={generateCostCredits}
          imageSrc={card.imageSrc}
          imageLoading={card.isPriorityHydration ? "eager" : "lazy"}
          imageFetchPriority={card.isPriorityHydration ? "high" : "low"}
          onSelectOutput={onSelectOutput}
          onOpenDetails={onOpenDetails}
          onCardDragStart={handleCardDragStart}
          onCardDragEnd={handleCardDragEnd}
          onCardDragOver={
            options.isCuratedSurface
              ? (event) => {
                  handleCuratedSectionDragOver(event);
                }
              : undefined
          }
          onCardDrop={options.isCuratedSurface ? handleCuratedCardDrop : undefined}
          onCardDragEnter={
            options.isCuratedSurface
              ? (event) => {
                  handleCuratedSectionDragEnter(event);
                }
              : undefined
          }
          onCardDragLeave={
            options.isCuratedSurface
              ? (event) => {
                  handleCuratedSectionDragLeave(event);
                }
              : undefined
          }
          registerVideoNode={registerVideoNode}
          markLoaded={markLoaded}
          onAutoplayStarted={handleAutoplayStarted}
          onAutoplayStopped={handleAutoplayStopped}
          onRetryStatus={onRetryStatus}
          onDeleteOutput={options.isCuratedSurface ? undefined : onDeleteOutput}
          onRemoveCuratedReference={options.isCuratedSurface ? onRemoveCuratedReference : undefined}
          showCuratedRemoveAction={options.isCuratedSurface}
          onSaveToLibrary={onSaveToLibrary}
          onDownload={onDownload}
          onDescribeImage={onDescribeImage}
          onGeneratePrompt={onGeneratePrompt}
          hideReferenceActions={options.isCuratedSurface}
        />
      );
    },
    [
      activeOutputId,
      autoplayEnabledIdSet,
      disablePromptGenerate,
      generateCostCredits,
      handleAutoplayStarted,
      handleAutoplayStopped,
      handleCardDragStart,
      handleCardDragEnd,
      handleCuratedCardDrop,
      handleCuratedSectionDragEnter,
      handleCuratedSectionDragLeave,
      handleCuratedSectionDragOver,
      linkedPromptReferenceIdSet,
      markLoaded,
      onDeleteOutput,
      onDescribeImage,
      onDownload,
      onGeneratePrompt,
      onOpenDetails,
      onRemoveCuratedReference,
      onRetryStatus,
      onSaveToLibrary,
      onSelectOutput,
      pendingCardIdSet,
      perfWatchdog.degradeLevel,
      registerVideoNode,
      showPromptGenerate,
      spinnerCandidateIdSet,
      spinnerSlotIdSet,
    ]
  );

  const referenceGridHeader = (
    <div className="panel-header preview-header reference-all-refs-header">
      <div>
        <p className="eyebrow">Reference Grid</p>
      </div>
      <div className="preview-header-actions">
        <button
          type="button"
          className="ghost-btn mini preview-media-btn reference-grid-add-files-btn"
          onClick={onTriggerFileSelect}
        >
          <UploadSimple size={14} weight="regular" />
          <span>Add files</span>
        </button>
        <PromptLibraryButton
          onClick={(event) => {
            event.preventDefault();
            onOpenMediaLibrary?.();
          }}
          className="prompt-media-btn preview-media-btn reference-grid-media-library-btn"
          aria-label="Open media library"
          label="Media Library"
          icon={<CloudArrowUp size={16} weight="regular" aria-hidden />}
          tone="library"
        />
        {archiveCount > 0 ? (
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-btn"
            onClick={() => setIsArchivePanelOpen((prev) => !prev)}
            aria-expanded={isArchivePanelOpen}
          >
            Archived ({archiveCount})
          </button>
        ) : null}
      </div>
    </div>
  );

  const referenceArchiveInline =
    !showHeader && archiveCount > 0 ? (
      <div className="reference-archive-inline">
        <button
          type="button"
          className="ghost-btn mini preview-media-btn reference-archive-btn"
          onClick={() => setIsArchivePanelOpen((prev) => !prev)}
          aria-expanded={isArchivePanelOpen}
        >
          Archived ({archiveCount})
        </button>
        {onRestoreAllArchivedOutputs ? (
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-restore-all-btn"
            onClick={() => onRestoreAllArchivedOutputs()}
          >
            Restore all
          </button>
        ) : null}
      </div>
    ) : null;

  const referenceArchivePanel =
    isArchivePanelOpen && archiveCount > 0 ? (
      <div className="reference-archive-panel" aria-label="Archived references">
        <div className="reference-archive-header">
          <p className="tiny subdued">Older references are archived to keep the grid responsive.</p>
          <button
            type="button"
            className="ghost-btn mini preview-media-btn reference-archive-restore-all-btn"
            onClick={() => onRestoreAllArchivedOutputs?.()}
          >
            Restore all
          </button>
        </div>
        <div className="reference-archive-list">
          {archivedOutputs.slice(0, 24).map((item) => (
            <div key={item.id} className="reference-archive-item">
              <span className="reference-archive-item-label">
                {item.previewText ? item.previewText : item.prompt}
              </span>
              <button
                type="button"
                className="ghost-btn mini reference-archive-item-restore"
                onClick={() => onRestoreArchivedOutput?.(item.id)}
              >
                Restore
              </button>
            </div>
          ))}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={panelRef}
      className={`panel ai-panel ai-preview-panel reference-canvas-panel${canvasDropMode !== "none" ? " is-drop-active" : ""}${canvasDropMode === "text" ? " is-drop-active-text" : ""}${canvasDropMode === "files" ? " is-drop-active-files" : ""}${isHighDensity ? " is-high-density" : ""}${denseVisualModeEnabled ? " is-dense-visual-mode" : ""}${REFERENCE_GRID_FLAG_CSS_CONTAINMENT ? " is-css-containment-mode" : ""}${perfWatchdog.degradeLevel >= 1 ? " is-grid-pressure-mode" : ""}${isCuratedSplitEnabled ? " is-curated-split-mode" : ""}`}
      data-selection-theme={selectionTheme}
      data-grid-surface="reference-grid"
      data-rendered-item-count={renderedItemCount}
      data-image-hydration-queue-size={imageHydrationState.queueSize}
      data-image-decode-inflight-count={imageHydrationState.decodeInflight}
      data-grid-perf-degrade-level={perfWatchdog.degradeLevel}
      data-grid-media-work-tokens={mediaWorkBudget.totalTokens}
      data-grid-video-attach-budget={mediaWorkBudget.videoAttachBudget}
      data-grid-watchdog-longtask-p95={perfWatchdog.longTaskP95Ms ?? ""}
      data-grid-watchdog-input-stall-ms={perfWatchdog.maxInputStallMs}
      data-grid-adaptive-preview-enabled={REFERENCE_GRID_FLAG_ADAPTIVE_PREVIEW_QUALITY}
      data-grid-adaptive-preview-transformed-count={transformedAdaptivePreviewCount}
      data-grid-src-swap-rate-per-minute={previewSwapMetrics.swapRatePerMinute}
      data-grid-repaint-spike-count={previewSwapMetrics.repaintSpikeCount}
      data-grid-last-swap-burst-count={previewSwapMetrics.lastSwapBurstCount}
      onDrop={handleCanvasDrop}
      onDragOver={handleCanvasDragOver}
      onDragEnter={handleCanvasDragEnter}
      onDragLeave={handleCanvasDragLeave}
      onPointerEnter={handlePanelPointerEnter}
      onPointerLeave={handlePanelPointerLeave}
      onPointerDown={handlePanelPointerDown}
      tabIndex={0}
    >
      {!isCuratedSplitEnabled && showHeader ? referenceGridHeader : null}
      {!isCuratedSplitEnabled ? referenceArchiveInline : null}
      {!isCuratedSplitEnabled ? referenceArchivePanel : null}
      <div className={`reference-grid-sections${isCuratedSplitEnabled ? " is-curated-split" : ""}`}>
        {isCuratedSplitEnabled ? (
          <>
            <div
              ref={curatedSectionRef}
              className={`reference-curated-section${isCuratedDropActive ? " is-drop-active" : ""}${horizontalSplit.isAllRefsExpanded ? " is-all-refs-expanded" : ""}`}
              style={horizontalSplit.topSectionStyle}
              onDrop={handleCuratedSectionDrop}
              onDragOver={handleCuratedSectionDragOver}
              onDragEnter={handleCuratedSectionDragEnter}
              onDragLeave={handleCuratedSectionDragLeave}
            >
              <div ref={curatedHeaderRef} className="reference-curated-header">
                <p className="eyebrow">Quick Slot Inventory</p>
              </div>
              <div
                className="reference-curated-scroll"
                onScroll={handleCuratedScroll}
                ref={curatedScrollContainerRef}
              >
                <div
                  className={`reference-canvas-grid${!selectedTool ? " reference-canvas-grid--wide" : ""}`}
                  ref={curatedGridRef}
                  style={curatedGridStyle}
                >
                  {curatedOutputs.length === 0 ? (
                    <div className="reference-curated-empty">
                      <p className="preview-title">
                        Drag &amp; drop references here from the Reference Grid.
                      </p>
                    </div>
                  ) : (
                    <>
                      {curatedTopSpacerHeight > 0 ? (
                        <div
                          className="reference-virtual-spacer"
                          style={{ height: curatedTopSpacerHeight }}
                        />
                      ) : null}
                      {curatedVisibleCardItems.map((card) =>
                        renderReferenceCard(card, {
                          surface: "curated",
                          isCuratedSurface: true,
                        })
                      )}
                      {curatedBottomSpacerHeight > 0 ? (
                        <div
                          className="reference-virtual-spacer"
                          style={{ height: curatedBottomSpacerHeight }}
                        />
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            </div>
            <div
              className="reference-grid-horizontal-divider-wrap"
              {...horizontalSplit.dividerProps}
            >
              <button
                type="button"
                className="reference-grid-horizontal-divider-pill"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  horizontalSplit.snapToInventoryExpanded();
                }}
              >
                Inventory ↓
              </button>
              <div className="reference-grid-horizontal-divider" />
              <button
                type="button"
                className="reference-grid-horizontal-divider-pill"
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  const curatedHeaderNode = curatedSectionRef.current?.querySelector(
                    ".reference-curated-header"
                  );
                  const targetTopHeightPx =
                    curatedHeaderNode instanceof HTMLElement
                      ? curatedHeaderNode.offsetHeight
                      : undefined;
                  horizontalSplit.snapToAllRefsExpanded(targetTopHeightPx);
                }}
              >
                All Refs ↑
              </button>
            </div>
          </>
        ) : null}
        <div
          className={`reference-all-refs-section${horizontalSplit.isInventoryExpanded ? " is-inventory-expanded" : ""}`}
          style={isCuratedSplitEnabled ? horizontalSplit.bottomSectionStyle : undefined}
        >
          {isCuratedSplitEnabled && showHeader ? referenceGridHeader : null}
          {isCuratedSplitEnabled ? referenceArchiveInline : null}
          {isCuratedSplitEnabled ? referenceArchivePanel : null}
          <div
            className="reference-canvas-scroll"
            onScroll={handleAllRefsScroll}
            ref={scrollContainerRef}
          >
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
                  {visibleCardItems.map((card) =>
                    renderReferenceCard(card, {
                      surface: "all-refs",
                      isCuratedSurface: false,
                    })
                  )}
                  {bottomSpacerHeight > 0 ? (
                    <div
                      className="reference-virtual-spacer"
                      style={{ height: bottomSpacerHeight }}
                    />
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
