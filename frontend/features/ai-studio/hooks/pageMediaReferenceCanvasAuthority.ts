/**
 * Canvas media-authority helpers for the AI Studio page media-reference runtime.
 * Keeps storage signatures and retry keys separate from React canvas wiring.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import type { CanvasSceneItem } from "../components/canvas/canvasTypes";
import { resolveVideoPosterStoragePath } from "../logic/videoPosterStoragePaths";
import type { StudioOutput } from "../types";

export const CANVAS_VIDEO_POSTER_REPAIR_BATCH_SIZE = 4;

export const areNumberListsEqual = (
  left: readonly number[] | null | undefined,
  right: readonly number[] | null | undefined
): boolean => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

export const resolveCanvasMediaRenderRetryKey = (item: CanvasSceneItem): string | null => {
  if (item.kind === "image") {
    return `${item.id}:image:${item.src}`;
  }
  if (item.kind === "video") {
    return `${item.id}:video:${item.videoUrl}:${item.posterUrl ?? ""}`;
  }
  if (item.kind === "audio") {
    return `${item.id}:audio:${item.audioUrl}`;
  }
  return null;
};

export const resolveCanvasMediaFallbackUrl = (item: CanvasSceneItem): string | null => {
  if (item.kind === "image") return item.src;
  if (item.kind === "video") return item.videoUrl;
  if (item.kind === "audio") return item.audioUrl;
  return null;
};

const normalizeCanvasAuthorityString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
};

type CanvasMediaAuthoritySignatureEntry = {
  id: string;
  kind: "image" | "video" | "audio";
  outputId: string | null;
  mediaId: string | null;
  mediaUrl: string | null;
  mediaStoragePath: string | null;
  posterUrl?: string | null;
  posterStoragePath?: string | null;
  companionArtUrl?: string | null;
  companionArtStoragePath?: string | null;
};

export const resolveCanvasMediaAuthoritySignature = (items: readonly CanvasSceneItem[]): string => {
  const entries: CanvasMediaAuthoritySignatureEntry[] = [];
  items.forEach((item) => {
    if (item.kind === "image") {
      entries.push({
        id: item.id,
        kind: item.kind,
        outputId: normalizeCanvasAuthorityString(item.outputId),
        mediaId: normalizeCanvasAuthorityString(item.mediaId),
        mediaUrl: normalizeCanvasAuthorityString(item.src),
        mediaStoragePath: normalizeCanvasAuthorityString(item.srcStoragePath),
      });
      return;
    }
    if (item.kind === "video") {
      entries.push({
        id: item.id,
        kind: item.kind,
        outputId: normalizeCanvasAuthorityString(item.outputId),
        mediaId: normalizeCanvasAuthorityString(item.mediaId),
        mediaUrl: normalizeCanvasAuthorityString(item.videoUrl),
        mediaStoragePath: normalizeCanvasAuthorityString(item.videoStoragePath),
        posterUrl: normalizeCanvasAuthorityString(item.posterUrl),
        posterStoragePath: normalizeCanvasAuthorityString(item.posterStoragePath),
      });
      return;
    }
    if (item.kind === "audio") {
      entries.push({
        id: item.id,
        kind: item.kind,
        outputId: normalizeCanvasAuthorityString(item.outputId),
        mediaId: normalizeCanvasAuthorityString(item.mediaId),
        mediaUrl: normalizeCanvasAuthorityString(item.audioUrl),
        mediaStoragePath: normalizeCanvasAuthorityString(item.audioStoragePath),
        companionArtUrl: normalizeCanvasAuthorityString(item.companionArtUrl),
        companionArtStoragePath: normalizeCanvasAuthorityString(item.companionArtStoragePath),
      });
    }
  });
  return JSON.stringify(entries);
};

export const resolveCanvasPrimaryStoragePathFromOutput = (output: StudioOutput): string | null =>
  asCanonicalStoragePath(output.fullStoragePath) ??
  asCanonicalStoragePath(output.previewStoragePath);

export const resolveCanvasPosterStoragePathFromOutput = (output: StudioOutput): string | null =>
  output.mode === "video"
    ? asCanonicalStoragePath(
        resolveVideoPosterStoragePath({
          previewPosterStoragePath: output.previewPosterStoragePath,
          previewStoragePath: output.previewStoragePath,
          fullStoragePath: output.fullStoragePath,
        })
      )
    : asCanonicalStoragePath(output.previewPosterStoragePath);

export const hasCanvasOutputStorageAuthority = (output: StudioOutput): boolean =>
  Boolean(
    resolveCanvasPrimaryStoragePathFromOutput(output) ||
    resolveCanvasPosterStoragePathFromOutput(output)
  );

export const resolveCanvasSceneItemStoragePaths = (
  item: CanvasSceneItem
): { mediaStoragePath: string | null; posterStoragePath: string | null } => {
  if (item.kind === "image") {
    return {
      mediaStoragePath: asCanonicalStoragePath(item.srcStoragePath),
      posterStoragePath: null,
    };
  }
  if (item.kind === "video") {
    return {
      mediaStoragePath: asCanonicalStoragePath(item.videoStoragePath),
      posterStoragePath: asCanonicalStoragePath(item.posterStoragePath),
    };
  }
  if (item.kind === "audio") {
    return {
      mediaStoragePath: asCanonicalStoragePath(item.audioStoragePath),
      posterStoragePath: null,
    };
  }
  return {
    mediaStoragePath: null,
    posterStoragePath: null,
  };
};
