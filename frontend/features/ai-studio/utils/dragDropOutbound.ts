/**
 * Prepares and clears AI Studio internal reference drag payloads.
 * Owns DataTransfer writes, same-document drag session registration, and drag ghost lifecycle.
 */
import type React from "react";
import type { ReferenceDragSourceSurface } from "../../../lib/internalReferenceDragPayload";
import {
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  INTERNAL_REFERENCE_DRAG_ORIGIN,
  INTERNAL_REFERENCE_DRAG_VERSION,
  REFERENCE_TRANSFER_FULL_STORAGE_PATH_TYPE,
  REFERENCE_TRANSFER_HEIGHT_TYPE,
  REFERENCE_TRANSFER_ID_TYPE,
  REFERENCE_TRANSFER_IMAGE_INDEX_TYPE,
  REFERENCE_TRANSFER_MEDIA_ID_TYPE,
  REFERENCE_TRANSFER_MEDIA_KIND_TYPE,
  REFERENCE_TRANSFER_ORIGIN_TYPE,
  REFERENCE_TRANSFER_OUTPUT_ID_TYPE,
  REFERENCE_TRANSFER_PREVIEW_STORAGE_PATH_TYPE,
  REFERENCE_TRANSFER_RENDER_URL_TYPE,
  REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE,
  REFERENCE_TRANSFER_URL_TYPE,
  REFERENCE_TRANSFER_VERSION_TYPE,
  REFERENCE_TRANSFER_WIDTH_TYPE,
} from "../../../lib/internalReferenceDragPayload";
import {
  clearComposerImageDropSession,
  clearInternalReferenceDragSession,
  clearPromptReferenceDragSession,
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
  PROMPT_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  PROMPT_REFERENCE_DRAG_SESSION_TYPE,
  registerComposerImageDropSession,
  registerInternalReferenceDragSession,
  registerPromptReferenceDragSession,
  scheduleClearComposerImageDropSession,
  scheduleClearInternalReferenceDragSession,
  scheduleClearPromptReferenceDragSession,
} from "../../../lib/internalReferenceDragSession";
import type { StudioOutput } from "../types";
import { canExposeDirectReferenceUrls, hasSavedMediaIds } from "../logic/referenceOutputAuthority";
import {
  buildReferenceDragGhost,
  CANVAS_PROMPT_DRAG_HOTSPOT_X,
  CANVAS_PROMPT_DRAG_HOTSPOT_Y,
  DRAG_GHOST_MAX_SIZE_PX,
  readReferenceDragPreviewDataset,
  resolveOutputPreviewKind,
  safeSetDragImage,
} from "./dragDropGhost";
import {
  isLikelyImageTransferUrl,
  isInlineTransferHeavyUrl,
  normalizeReferenceTransferUrlCandidate,
  resolveDatasetPlayableTransferUrl,
  resolveReferenceTransferUrl,
  VIDEO_STORAGE_PATH_PATTERN,
} from "./dragDropMediaResolution";

export type ReferenceComposerImageDragArtifact = {
  displayArtifactUrl: string;
  displayArtifactKind: "blob" | "data" | "url";
  promptText?: string | null;
  mediaId?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl?: string | null;
  mimeType?: string | null;
  width?: number;
  height?: number;
};

const INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY = "internalReferenceDragToken";
const COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY = "composerImageDropToken";
const PROMPT_REFERENCE_DRAG_TOKEN_DATASET_KEY = "promptReferenceDragToken";

const dragGhostMap = new WeakMap<HTMLElement, HTMLElement>();

const dedupeText = (value?: string): string => (value ? value.trim() : "");

const resolveReferenceDragPromptText = (output: StudioOutput): string => {
  const prompt = dedupeText(output.prompt ?? undefined);
  const previewText = dedupeText(output.previewText ?? undefined);
  const isPromptReference =
    output.mode === "text" || output.mediaSource === "prompt" || Boolean(output.promptId?.trim());

  return isPromptReference ? previewText || prompt : prompt || previewText;
};

const setTransferDataSafe = (transfer: DataTransfer, type: string, value: string): void => {
  try {
    transfer.setData(type, value);
  } catch {
    // Some browser engines reject custom MIME types; keep the drag active.
  }
};

const resolveVideoPrimaryStoragePath = ({
  mode,
  previewStoragePath,
  fullStoragePath,
}: {
  mode: StudioOutput["mode"];
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (mode !== "video") return previewStoragePath;
  if (previewStoragePath && VIDEO_STORAGE_PATH_PATTERN.test(previewStoragePath)) {
    return previewStoragePath;
  }
  if (fullStoragePath) return fullStoragePath;
  return previewStoragePath;
};

export const preparePromptReferenceDrag = (
  event: React.DragEvent<HTMLElement>,
  options: {
    promptText: string;
    referenceId?: string | null;
    outputId?: string | null;
    sourceSurface?: ReferenceDragSourceSurface | null;
  }
): string | null => {
  const promptText = dedupeText(options.promptText);
  if (!promptText) return null;

  const transfer = event.dataTransfer;
  const dragNode = event.currentTarget as HTMLElement;
  const dragNodeDataset = dragNode?.dataset ?? null;
  const previousPromptSessionToken =
    dragNodeDataset?.[PROMPT_REFERENCE_DRAG_TOKEN_DATASET_KEY]?.trim() ?? "";
  if (previousPromptSessionToken) {
    clearPromptReferenceDragSession(previousPromptSessionToken);
  }

  const referenceId = options.referenceId?.trim() || null;
  const outputId = options.outputId?.trim() || referenceId;
  const dragSessionToken = registerPromptReferenceDragSession({
    version: INTERNAL_REFERENCE_DRAG_VERSION,
    referenceId,
    outputId,
    promptText,
    sourceSurface: options.sourceSurface ?? null,
  });

  if (dragNodeDataset) {
    dragNodeDataset[PROMPT_REFERENCE_DRAG_TOKEN_DATASET_KEY] = dragSessionToken;
  }
  transfer.effectAllowed = "copy";
  setTransferDataSafe(transfer, PROMPT_REFERENCE_DRAG_SESSION_TYPE, dragSessionToken);
  setTransferDataSafe(transfer, PROMPT_REFERENCE_DRAG_SESSION_TEXT_TYPE, dragSessionToken);
  setTransferDataSafe(transfer, "text/prompt", promptText);
  setTransferDataSafe(transfer, "text/plain", promptText);

  return dragSessionToken;
};

export const prepareReferenceDrag = (
  event: React.DragEvent<HTMLElement>,
  output: StudioOutput,
  options?: {
    dragImage?: HTMLElement;
    sourceSurface?: ReferenceDragSourceSurface;
    imageIndex?: number;
    composerImageArtifact?: ReferenceComposerImageDragArtifact | null;
  }
): void => {
  const transfer = event.dataTransfer;
  transfer.effectAllowed = "copy";
  const sourceSurface = options?.sourceSurface ?? "all-refs";
  const imageIndex = Math.max(0, Math.floor(options?.imageIndex ?? 0));
  const promptText = resolveReferenceDragPromptText(output);
  const dragNode = options?.dragImage ?? (event.currentTarget as HTMLElement);
  const composerImageArtifact =
    output.mode === "image" ? (options?.composerImageArtifact ?? null) : null;
  const previewDataset = readReferenceDragPreviewDataset(dragNode);
  const allowDirectReferenceUrls = canExposeDirectReferenceUrls(output);
  const transferKind =
    output.mode === "video" ? "video" : output.mode === "audio" ? "audio" : "any";
  const previewUrl = allowDirectReferenceUrls
    ? (resolveDatasetPlayableTransferUrl(previewDataset.playableUrl, transferKind) ??
      resolveReferenceTransferUrl(output, transferKind))
    : null;
  const imagePreviewUrl = allowDirectReferenceUrls
    ? resolveReferenceTransferUrl(output, "image")
    : null;
  const datasetImageUrl = normalizeReferenceTransferUrlCandidate(previewDataset.imageSrc, {
    unwrapNextImage: false,
  });
  const datasetPreviewUrl = normalizeReferenceTransferUrlCandidate(previewDataset.previewUrl);
  const datasetSnapshotUrl = normalizeReferenceTransferUrlCandidate(previewDataset.snapshotSrc);
  const datasetImageTransferUrl =
    datasetImageUrl && isLikelyImageTransferUrl(datasetImageUrl) ? datasetImageUrl : null;
  const datasetPreviewTransferUrl =
    datasetPreviewUrl && isLikelyImageTransferUrl(datasetPreviewUrl) ? datasetPreviewUrl : null;
  const datasetSnapshotTransferUrl =
    datasetSnapshotUrl && isLikelyImageTransferUrl(datasetSnapshotUrl) ? datasetSnapshotUrl : null;
  const resolvedImageTransferUrl = imagePreviewUrl ?? datasetPreviewTransferUrl ?? null;
  const resolvedRenderedTransferUrl =
    datasetSnapshotTransferUrl ?? datasetImageTransferUrl ?? resolvedImageTransferUrl;
  const internalRenderOnlyUrl =
    !allowDirectReferenceUrls &&
    (hasSavedMediaIds(output) || Boolean(output.generationId?.trim())) &&
    resolvedRenderedTransferUrl
      ? resolvedRenderedTransferUrl
      : null;
  const exposedRenderedTransferUrl = allowDirectReferenceUrls
    ? resolvedRenderedTransferUrl
    : internalRenderOnlyUrl;
  const resolvedReferenceTransferUrl =
    output.mode === "image"
      ? (resolvedImageTransferUrl ?? previewUrl ?? null)
      : (previewUrl ?? resolvedImageTransferUrl ?? null);
  const resolvedComposerDisplayArtifactUrl =
    composerImageArtifact && output.mode === "image"
      ? (datasetSnapshotTransferUrl ?? composerImageArtifact.displayArtifactUrl)
      : (composerImageArtifact?.displayArtifactUrl ?? null);
  const resolvedComposerDisplayArtifactKind = resolvedComposerDisplayArtifactUrl?.startsWith(
    "blob:"
  )
    ? ("blob" as const)
    : resolvedComposerDisplayArtifactUrl?.startsWith("data:")
      ? ("data" as const)
      : resolvedComposerDisplayArtifactUrl
        ? ("url" as const)
        : (composerImageArtifact?.displayArtifactKind ?? "url");
  const resolvedPrimaryImagePreviewUrl =
    resolvedComposerDisplayArtifactUrl ??
    (output.mode === "image"
      ? (exposedRenderedTransferUrl ??
        resolvedImageTransferUrl ??
        (allowDirectReferenceUrls ? resolvedReferenceTransferUrl : null))
      : null);
  const shouldInlinePrimaryImagePreviewUrl = !isInlineTransferHeavyUrl(
    resolvedPrimaryImagePreviewUrl
  );
  const shouldInlineRenderedTransferUrl = !isInlineTransferHeavyUrl(exposedRenderedTransferUrl);
  const referenceMediaId =
    output.savedMediaIds?.[imageIndex]?.trim() ?? output.savedMediaIds?.[0]?.trim();
  const previewImageNode = dragNode.querySelector(".reference-card-image");
  const naturalWidth =
    previewImageNode instanceof HTMLImageElement && previewImageNode.naturalWidth > 0
      ? previewImageNode.naturalWidth
      : 0;
  const naturalHeight =
    previewImageNode instanceof HTMLImageElement && previewImageNode.naturalHeight > 0
      ? previewImageNode.naturalHeight
      : 0;
  const dragNodeDataset = dragNode?.dataset ?? null;
  const previousDragSessionToken =
    dragNodeDataset?.[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY]?.trim() ?? "";
  if (previousDragSessionToken) {
    clearInternalReferenceDragSession(previousDragSessionToken);
  }
  const normalizedPreviewStoragePath = resolveVideoPrimaryStoragePath({
    mode: output.mode,
    previewStoragePath: output.previewStoragePath?.trim() || null,
    fullStoragePath: output.fullStoragePath?.trim() || null,
  });
  const normalizedFullStoragePath = output.fullStoragePath?.trim() || null;
  const dragSessionToken = registerInternalReferenceDragSession({
    version: INTERNAL_REFERENCE_DRAG_VERSION,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: output.id?.trim() || null,
    outputId: output.id?.trim() || null,
    imageIndex,
    mediaId: referenceMediaId ?? null,
    mediaKind: resolveOutputPreviewKind(output),
    previewStoragePath: normalizedPreviewStoragePath,
    fullStoragePath: normalizedFullStoragePath,
    referenceUrl:
      composerImageArtifact?.referenceUrl ??
      (allowDirectReferenceUrls ? (resolvedReferenceTransferUrl ?? null) : null),
    referenceRenderUrl: resolvedComposerDisplayArtifactUrl ?? exposedRenderedTransferUrl ?? null,
    promptText: promptText || null,
    sourceSurface,
    ...(naturalWidth > 0 ? { width: naturalWidth } : {}),
    ...(naturalHeight > 0 ? { height: naturalHeight } : {}),
  });
  if (dragNodeDataset) {
    dragNodeDataset[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY] = dragSessionToken;
  }
  transfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE, dragSessionToken);
  transfer.setData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE, dragSessionToken);
  if (allowDirectReferenceUrls && resolvedReferenceTransferUrl) {
    transfer.setData("text/uri-list", resolvedReferenceTransferUrl);
    transfer.setData(REFERENCE_TRANSFER_URL_TYPE, resolvedReferenceTransferUrl);
  }
  if (
    output.mode === "image" &&
    resolvedPrimaryImagePreviewUrl &&
    shouldInlinePrimaryImagePreviewUrl
  ) {
    transfer.setData("image/url", resolvedPrimaryImagePreviewUrl);
  } else if (allowDirectReferenceUrls && resolvedImageTransferUrl) {
    transfer.setData("image/url", resolvedImageTransferUrl);
  }
  if (exposedRenderedTransferUrl && shouldInlineRenderedTransferUrl) {
    transfer.setData(REFERENCE_TRANSFER_RENDER_URL_TYPE, exposedRenderedTransferUrl);
  }
  if (output.id) {
    transfer.setData(REFERENCE_TRANSFER_ID_TYPE, output.id);
    transfer.setData(REFERENCE_TRANSFER_OUTPUT_ID_TYPE, output.id);
  }
  transfer.setData(REFERENCE_TRANSFER_ORIGIN_TYPE, INTERNAL_REFERENCE_DRAG_ORIGIN);
  transfer.setData(REFERENCE_TRANSFER_VERSION_TYPE, String(INTERNAL_REFERENCE_DRAG_VERSION));
  transfer.setData(REFERENCE_TRANSFER_IMAGE_INDEX_TYPE, String(imageIndex));
  transfer.setData(REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE, sourceSurface);
  transfer.setData(REFERENCE_TRANSFER_MEDIA_KIND_TYPE, resolveOutputPreviewKind(output));
  if (naturalWidth > 0 && naturalHeight > 0) {
    transfer.setData(REFERENCE_TRANSFER_WIDTH_TYPE, String(naturalWidth));
    transfer.setData(REFERENCE_TRANSFER_HEIGHT_TYPE, String(naturalHeight));
  }
  if (referenceMediaId) {
    transfer.setData(REFERENCE_TRANSFER_MEDIA_ID_TYPE, referenceMediaId);
  }
  const previewStoragePath =
    composerImageArtifact?.previewStoragePath?.trim() || normalizedPreviewStoragePath || "";
  const fullStoragePath =
    composerImageArtifact?.fullStoragePath?.trim() || normalizedFullStoragePath || "";
  if (previewStoragePath) {
    transfer.setData(REFERENCE_TRANSFER_PREVIEW_STORAGE_PATH_TYPE, previewStoragePath);
  }
  if (fullStoragePath) {
    transfer.setData(REFERENCE_TRANSFER_FULL_STORAGE_PATH_TYPE, fullStoragePath);
  }
  if (composerImageArtifact) {
    const previousComposerDropToken =
      dragNodeDataset?.[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY]?.trim() ?? "";
    if (previousComposerDropToken) {
      clearComposerImageDropSession(previousComposerDropToken);
    }
    const composerPayload = {
      version: INTERNAL_REFERENCE_DRAG_VERSION,
      origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
      referenceId: output.id?.trim() || null,
      outputId: output.id?.trim() || null,
      mediaId: composerImageArtifact.mediaId?.trim() || referenceMediaId || null,
      displayArtifactUrl:
        resolvedComposerDisplayArtifactUrl ?? composerImageArtifact.displayArtifactUrl,
      displayArtifactKind: resolvedComposerDisplayArtifactKind,
      previewStoragePath: previewStoragePath || null,
      fullStoragePath: fullStoragePath || null,
      referenceUrl:
        composerImageArtifact.referenceUrl?.trim() ||
        (allowDirectReferenceUrls ? resolvedReferenceTransferUrl : null) ||
        null,
      promptText: composerImageArtifact.promptText?.trim() || promptText || null,
      sourceSurface,
      width: composerImageArtifact.width ?? (naturalWidth > 0 ? naturalWidth : undefined),
      height: composerImageArtifact.height ?? (naturalHeight > 0 ? naturalHeight : undefined),
      mimeType: composerImageArtifact.mimeType?.trim() || output.mimeType?.trim() || null,
    };
    const composerDropSessionToken = registerComposerImageDropSession(composerPayload);
    if (dragNodeDataset) {
      dragNodeDataset[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY] = composerDropSessionToken;
    }
    transfer.setData(COMPOSER_IMAGE_DROP_SESSION_TYPE, composerDropSessionToken);
    transfer.setData(COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE, composerDropSessionToken);
    if (composerImageArtifact.displayArtifactKind === "url") {
      const serializedComposerPayload = JSON.stringify(composerPayload);
      transfer.setData(COMPOSER_IMAGE_DROP_PAYLOAD_TYPE, serializedComposerPayload);
      transfer.setData(COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE, serializedComposerPayload);
    }
  }
  if (promptText) {
    transfer.setData("text/plain", promptText);
    transfer.setData("text/prompt", promptText);
  } else if (allowDirectReferenceUrls && resolvedReferenceTransferUrl) {
    transfer.setData("text/plain", resolvedReferenceTransferUrl);
  }

  if (dragNode) {
    dragNode.classList.add("is-dragging");
    // Use a dedicated drag ghost so selected-card controls never leak into drag previews.
    try {
      const rect = dragNode.getBoundingClientRect();
      const ghost = buildReferenceDragGhost({
        output,
        previewDataset,
        width: rect.width || dragNode.offsetWidth || DRAG_GHOST_MAX_SIZE_PX,
        height: rect.height || dragNode.offsetHeight || DRAG_GHOST_MAX_SIZE_PX,
        promptText,
      });
      document.body.appendChild(ghost);
      dragGhostMap.set(dragNode, ghost);
      safeSetDragImage(
        transfer,
        ghost,
        output.mode === "text"
          ? CANVAS_PROMPT_DRAG_HOTSPOT_X
          : Math.round((rect.width || dragNode.offsetWidth) / 2),
        output.mode === "text"
          ? CANVAS_PROMPT_DRAG_HOTSPOT_Y
          : Math.round((rect.height || dragNode.offsetHeight) / 2)
      );
    } catch {
      // Keep drag payload semantics even if ghost construction fails.
    }
  }
};

export const clearDragState = (event: React.DragEvent<HTMLElement>): void => {
  const node = event.currentTarget as HTMLElement;
  node.classList.remove("is-dragging");
  const dragSessionToken = node.dataset[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY];
  if (dragSessionToken) {
    scheduleClearInternalReferenceDragSession(dragSessionToken);
    delete node.dataset[INTERNAL_REFERENCE_DRAG_TOKEN_DATASET_KEY];
  }
  const composerDropSessionToken = node.dataset[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY];
  if (composerDropSessionToken) {
    scheduleClearComposerImageDropSession(composerDropSessionToken);
    delete node.dataset[COMPOSER_IMAGE_DROP_TOKEN_DATASET_KEY];
  }
  const promptReferenceSessionToken = node.dataset[PROMPT_REFERENCE_DRAG_TOKEN_DATASET_KEY];
  if (promptReferenceSessionToken) {
    scheduleClearPromptReferenceDragSession(promptReferenceSessionToken);
    delete node.dataset[PROMPT_REFERENCE_DRAG_TOKEN_DATASET_KEY];
  }
  const ghost = dragGhostMap.get(node);
  if (ghost && ghost.parentNode) {
    ghost.parentNode.removeChild(ghost);
  }
  dragGhostMap.delete(node);
};
