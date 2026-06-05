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
import type { StudioOutput } from "../../types";
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

  if (item.kind === "video") return { kind: "unsupported", reason: "unsupported_video" };
  if (item.kind === "audio") return { kind: "unsupported", reason: "unsupported_audio" };
  if (item.kind !== "image") return { kind: "unsupported", reason: "unsupported_item" };

  const outputId = normalizeOptionalText(item.outputId);
  const output = outputId ? (options.getOutputById?.(outputId) ?? null) : null;
  const sourceSurface = resolveSourceSurface(item.sourceSurface);
  const mediaId =
    normalizeOptionalText(item.mediaId) ??
    normalizeOptionalText(output?.savedMediaIds?.[0]) ??
    null;
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
