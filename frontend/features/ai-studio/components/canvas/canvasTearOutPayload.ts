/**
 * Converts Canvas scene items into normalized same-app tear-out payloads.
 * The adapter keeps Canvas export authority local while reusing composer drop contracts.
 */
import {
  INTERNAL_REFERENCE_DRAG_ORIGIN,
  type ComposerImageDropPayload,
  type InternalReferenceDragPayload,
  type ReferenceDragSourceSurface,
} from "../../utils/dragDrop";
import type { StudioAudioSourceMode, StudioOutput } from "../../types";
import type { AgentComposerDirectDropPayload } from "../../logic/agentComposerDirectDropPayload";
import type { CanvasSceneItem } from "./canvasTypes";

const CANVAS_TEAR_OUT_PAYLOAD_VERSION = 1;

export type CanvasTearOutUnsupportedReason =
  | "empty_text"
  | "unsupported_video"
  | "unsupported_audio"
  | "unsupported_item";

export type CanvasTearOutPayload =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "image";
      internalPayload: InternalReferenceDragPayload;
      composerImagePayload: ComposerImageDropPayload;
    }
  | {
      kind: "video";
      videoUrl: string;
      internalPayload: InternalReferenceDragPayload;
      outputId: string | null;
      mediaId: string | null;
      durationMs?: number | null;
    }
  | {
      kind: "audio";
      audioUrl: string;
      audioStoragePath?: string | null;
      title?: string | null;
      companionArtUrl?: string | null;
      companionArtStoragePath?: string | null;
      internalPayload: InternalReferenceDragPayload;
      outputId: string | null;
      mediaId: string | null;
      durationMs?: number | null;
      audioSourceMode?: StudioAudioSourceMode | null;
    }
  | {
      kind: "unsupported";
      reason: CanvasTearOutUnsupportedReason;
    };

export const resolveCanvasTearOutComposerPayload = (
  payload: CanvasTearOutPayload
): AgentComposerDirectDropPayload => {
  if (payload.kind !== "unsupported") return payload;
  return {
    kind: "unsupported",
    mediaKind:
      payload.reason === "unsupported_video"
        ? "video"
        : payload.reason === "unsupported_audio"
          ? "audio"
          : null,
  };
};

type BuildCanvasTearOutPayloadOptions = {
  getOutputById?: (outputId: string) => StudioOutput | null;
};

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

const resolveDisplayArtifactKind = (
  url: string
): ComposerImageDropPayload["displayArtifactKind"] =>
  url.startsWith("blob:") ? "blob" : url.startsWith("data:") ? "data" : "url";

const resolveSourceSurface = (
  value: ReferenceDragSourceSurface | null | undefined
): ReferenceDragSourceSurface => value ?? "all-refs";

const resolveImagePromptText = (output: StudioOutput | null): string | null =>
  normalizeOptionalText(output?.prompt) ?? normalizeOptionalText(output?.previewText);

const resolveImageReferenceUrl = (item: CanvasSceneItem, output: StudioOutput | null) => {
  if (item.kind !== "image") return null;
  return (
    normalizeOptionalText(output?.previewUrl) ?? normalizeOptionalText(output?.resultUrls?.[0])
  );
};

const resolveMediaReferenceIdentity = (item: CanvasSceneItem, output: StudioOutput | null) => {
  const outputId = normalizeOptionalText(item.outputId);
  const mediaId =
    (item.kind === "image" || item.kind === "video" || item.kind === "audio"
      ? normalizeOptionalText(item.mediaId)
      : null) ??
    normalizeOptionalText(output?.savedMediaIds?.[0]) ??
    null;
  return {
    outputId,
    mediaId,
    referenceId: outputId ?? mediaId ?? null,
  };
};

const buildCanvasMediaInternalPayload = ({
  mediaKind,
  referenceId,
  outputId,
  mediaId,
  referenceUrl,
  renderUrl,
  sourceSurface,
  previewStoragePath,
  fullStoragePath,
  width,
  height,
}: {
  mediaKind: NonNullable<InternalReferenceDragPayload["mediaKind"]>;
  referenceId: string | null;
  outputId: string | null;
  mediaId: string | null;
  referenceUrl: string | null;
  renderUrl: string | null;
  sourceSurface: ReferenceDragSourceSurface;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  width?: number;
  height?: number;
}): InternalReferenceDragPayload => ({
  version: CANVAS_TEAR_OUT_PAYLOAD_VERSION,
  origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
  referenceId,
  outputId,
  imageIndex: 0,
  mediaId,
  mediaKind,
  ...(previewStoragePath ? { previewStoragePath } : {}),
  ...(fullStoragePath ? { fullStoragePath } : {}),
  referenceUrl,
  ...(renderUrl ? { referenceRenderUrl: renderUrl } : {}),
  sourceSurface,
  ...(width ? { width } : {}),
  ...(height ? { height } : {}),
  sessionBacked: true,
});

/**
 * Builds the copy-style Canvas tear-out payload for composer targets.
 */
export const buildCanvasTearOutPayload = (
  item: CanvasSceneItem,
  options: BuildCanvasTearOutPayloadOptions = {}
): CanvasTearOutPayload => {
  if (item.kind === "text") {
    const text = normalizeOptionalText(item.text);
    return text ? { kind: "text", text } : { kind: "unsupported", reason: "empty_text" };
  }

  if (item.kind === "video") {
    const videoUrl = normalizeOptionalText(item.videoUrl);
    if (!videoUrl) return { kind: "unsupported", reason: "unsupported_item" };
    const outputId = normalizeOptionalText(item.outputId);
    const output = outputId ? (options.getOutputById?.(outputId) ?? null) : null;
    const sourceSurface = resolveSourceSurface(item.sourceSurface);
    const identity = resolveMediaReferenceIdentity(item, output);
    const width = item.width > 0 ? item.width : undefined;
    const height = item.height > 0 ? item.height : undefined;
    const internalPayload = buildCanvasMediaInternalPayload({
      mediaKind: "video",
      referenceId: identity.referenceId,
      outputId: identity.outputId,
      mediaId: identity.mediaId,
      referenceUrl: videoUrl,
      renderUrl: normalizeOptionalText(item.posterUrl) ?? videoUrl,
      sourceSurface,
      previewStoragePath: normalizeOptionalText(output?.previewStoragePath),
      fullStoragePath: normalizeOptionalText(output?.fullStoragePath),
      width,
      height,
    });
    return {
      kind: "video",
      videoUrl,
      internalPayload,
      outputId: identity.outputId,
      mediaId: identity.mediaId,
      durationMs: item.durationMs ?? null,
    };
  }

  if (item.kind === "audio") {
    const audioUrl = normalizeOptionalText(item.audioUrl);
    if (!audioUrl) return { kind: "unsupported", reason: "unsupported_item" };
    const outputId = normalizeOptionalText(item.outputId);
    const output = outputId ? (options.getOutputById?.(outputId) ?? null) : null;
    const sourceSurface = resolveSourceSurface(item.sourceSurface);
    const identity = resolveMediaReferenceIdentity(item, output);
    const width = item.width > 0 ? item.width : undefined;
    const height = item.height > 0 ? item.height : undefined;
    const audioStoragePath = normalizeOptionalText(item.audioStoragePath);
    const internalPayload = buildCanvasMediaInternalPayload({
      mediaKind: "audio",
      referenceId: identity.referenceId,
      outputId: identity.outputId,
      mediaId: identity.mediaId,
      referenceUrl: audioUrl,
      renderUrl: normalizeOptionalText(item.companionArtUrl) ?? audioUrl,
      sourceSurface,
      previewStoragePath: normalizeOptionalText(output?.previewStoragePath),
      fullStoragePath: audioStoragePath ?? normalizeOptionalText(output?.fullStoragePath),
      width,
      height,
    });
    return {
      kind: "audio",
      audioUrl,
      audioStoragePath,
      title: normalizeOptionalText(item.title) ?? normalizeOptionalText(output?.title),
      companionArtUrl:
        normalizeOptionalText(item.companionArtUrl) ??
        normalizeOptionalText(output?.companionArtUrl),
      companionArtStoragePath:
        normalizeOptionalText(item.companionArtStoragePath) ??
        normalizeOptionalText(output?.companionArtStoragePath),
      internalPayload,
      outputId: identity.outputId,
      mediaId: identity.mediaId,
      durationMs: item.durationMs ?? null,
      audioSourceMode: item.audioSourceMode ?? null,
    };
  }

  if (item.kind !== "image") return { kind: "unsupported", reason: "unsupported_item" };

  const outputId = normalizeOptionalText(item.outputId);
  const output = outputId ? (options.getOutputById?.(outputId) ?? null) : null;
  const sourceSurface = resolveSourceSurface(item.sourceSurface);
  const { mediaId } = resolveMediaReferenceIdentity(item, output);
  const displayArtifactUrl = normalizeOptionalText(item.src);
  if (!mediaId && !outputId && !displayArtifactUrl) {
    return { kind: "unsupported", reason: "unsupported_item" };
  }

  const width = item.width > 0 ? item.width : undefined;
  const height = item.height > 0 ? item.height : undefined;
  const previewStoragePath = normalizeOptionalText(output?.previewStoragePath);
  const fullStoragePath = normalizeOptionalText(output?.fullStoragePath);
  const referenceUrl = resolveImageReferenceUrl(item, output);
  const promptText = resolveImagePromptText(output);
  const referenceId = outputId ?? mediaId ?? null;
  const renderedUrl = displayArtifactUrl ?? referenceUrl ?? "";
  if (!renderedUrl) return { kind: "unsupported", reason: "unsupported_item" };

  const internalPayload: InternalReferenceDragPayload = {
    version: CANVAS_TEAR_OUT_PAYLOAD_VERSION,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId,
    outputId,
    imageIndex: 0,
    mediaId,
    mediaKind: "image",
    ...(previewStoragePath ? { previewStoragePath } : {}),
    ...(fullStoragePath ? { fullStoragePath } : {}),
    referenceUrl,
    referenceRenderUrl: renderedUrl,
    sourceSurface,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    sessionBacked: true,
  };

  const composerImagePayload: ComposerImageDropPayload = {
    version: CANVAS_TEAR_OUT_PAYLOAD_VERSION,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId,
    outputId,
    mediaId,
    displayArtifactUrl: renderedUrl,
    displayArtifactKind: resolveDisplayArtifactKind(renderedUrl),
    ...(previewStoragePath ? { previewStoragePath } : {}),
    ...(fullStoragePath ? { fullStoragePath } : {}),
    ...(referenceUrl ? { referenceUrl } : {}),
    ...(promptText ? { promptText } : {}),
    sourceSurface,
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
    ...(normalizeOptionalText(output?.mimeType)
      ? { mimeType: normalizeOptionalText(output?.mimeType) }
      : {}),
  };

  return {
    kind: "image",
    internalPayload,
    composerImagePayload,
  };
};
