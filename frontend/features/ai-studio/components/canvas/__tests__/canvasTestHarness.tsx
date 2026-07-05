/**
 * Canvas test harness utilities.
 * Provides shared render scaffolding and transfer helpers for canvas suites.
 */
import React, { useEffect, useState } from "react";
import { CanvasPropertiesPanel } from "../CanvasPropertiesPanel";
import {
  useAiStudioCanvasWorkspaceState,
  useAiStudioDualCanvasWorkspaceState,
} from "../useAiStudioCanvasWorkspaceState";
import type {
  CanvasDropResolution,
  PrepareCanvasMediaLibraryDrop,
  CanvasSceneItem,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDroppedMediaReference,
  ResolveCanvasDropFiles,
  ResolveCanvasDropReference,
} from "../canvasTypes";
import {
  CANVAS_AUDIO_ITEM_HEIGHT,
  CANVAS_AUDIO_ITEM_WIDTH,
  CANVAS_IMAGE_ITEM_HEIGHT,
  CANVAS_IMAGE_ITEM_WIDTH,
} from "../canvasGeometry";
import type {
  CanvasWorkspaceInstanceId,
  CanvasWorkspaceSessionState,
} from "../canvasWorkspaceContracts";
import type { CanvasTearOutComposerTargetRegistry } from "../../../hooks/useAiStudioCanvasTearOutTargets";
import type { StudioOutput } from "../../../types";

export const createTransfer = (entries: Record<string, string>) =>
  ({
    types: Object.keys(entries),
    files: { length: 0, item: () => null },
    getData: (type: string) => entries[type] ?? "",
  }) as unknown as DataTransfer;

export const defaultResolveCanvasDropReference: ResolveCanvasDropReference = (payload) => {
  if (payload.outputId === "img-1") {
    return {
      kind: "image",
      outputId: "img-1",
      mediaId: "media-1",
      src: "https://example.com/reference.png",
      alt: "Reference image",
      width: 1280,
      height: 720,
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  if (payload.outputId === "aud-1") {
    return {
      kind: "audio",
      outputId: "aud-1",
      mediaId: "media-audio-1",
      audioUrl: "https://example.com/reference-audio.mp3",
      title: "Reference audio",
      companionArtUrl: "https://example.com/reference-audio-cover.webp",
      companionArtStoragePath: "user-1/audio/reference-audio-cover.webp",
      durationMs: 4_500,
      waveformPeaks: [20, 40, 60, 45, 30],
      width: 160,
      height: 200,
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  if (payload.outputId === "vid-1") {
    return {
      kind: "video",
      outputId: "vid-1",
      mediaId: "media-video-1",
      videoUrl: "https://example.com/reference-video.mp4",
      posterUrl: "https://example.com/reference-video-poster.webp",
      title: "Reference video",
      width: payload.width ?? 1920,
      height: payload.height ?? 1080,
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  if (payload.outputId === "txt-1") {
    return {
      kind: "text",
      outputId: null,
      text: "Prompt reference",
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  return null;
};

export const defaultPrepareCanvasMediaLibraryDrop: PrepareCanvasMediaLibraryDrop = async (
  payload
): Promise<CanvasDropResolution | null> => {
  if (payload.kind === "libraryPrompt") {
    const promptText = payload.payload.promptText.trim();
    if (!promptText) return null;
    return {
      kind: "text",
      outputId: null,
      text: promptText,
    };
  }

  const previewSrc =
    payload.payload.previewUrl?.trim() ||
    payload.payload.url?.trim() ||
    payload.payload.fullUrl?.trim();
  if (!previewSrc) return null;

  if (payload.payload.fileType === "audio") {
    return {
      kind: "audio",
      outputId: null,
      mediaId: payload.payload.id,
      audioUrl: previewSrc,
      title:
        (payload.payload.filename || payload.payload.promptText || "Canvas audio").trim() || null,
      companionArtUrl: payload.payload.companionArtUrl ?? null,
      companionArtStoragePath: payload.payload.companionArtStoragePath ?? null,
      audioSourceMode: payload.payload.audioSourceMode ?? null,
      durationMs: payload.payload.durationMs ?? null,
      waveformPeaks: payload.payload.waveformPeaks ?? null,
      width: CANVAS_AUDIO_ITEM_WIDTH,
      height: CANVAS_AUDIO_ITEM_HEIGHT,
    };
  }

  const width =
    typeof payload.payload.width === "number" &&
    Number.isFinite(payload.payload.width) &&
    payload.payload.width > 0
      ? payload.payload.width
      : CANVAS_IMAGE_ITEM_WIDTH;
  const height =
    typeof payload.payload.height === "number" &&
    Number.isFinite(payload.payload.height) &&
    payload.payload.height > 0
      ? payload.payload.height
      : CANVAS_IMAGE_ITEM_HEIGHT;

  if (payload.payload.fileType === "video") {
    return {
      kind: "video",
      outputId: null,
      mediaId: payload.payload.id,
      videoUrl: previewSrc,
      posterUrl: payload.payload.previewPosterUrl ?? null,
      title:
        (payload.payload.filename || payload.payload.promptText || "Canvas video").trim() || null,
      durationMs: payload.payload.durationMs ?? null,
      width,
      height,
    };
  }

  return {
    kind: "image",
    outputId: null,
    mediaId: payload.payload.id,
    src: previewSrc,
    alt: (payload.payload.filename || payload.payload.promptText || "Canvas media").trim(),
    width,
    height,
  };
};

export type CanvasHarnessProps = {
  onPinTextReference?: (text: string) => void;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDroppedMediaReference?: ResolveCanvasDroppedMediaReference;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
  isItemDraggable?: boolean;
  onInteractionActiveChange?: (active: boolean) => void;
  onItemDragStart?: (id: string, event: React.DragEvent<HTMLElement>) => void;
  onItemDragEnd?: (id: string, event: React.DragEvent<HTMLElement>) => void;
  onOpenMediaDetail?: (item: CanvasSceneItem, instanceId: CanvasWorkspaceInstanceId) => void;
  onCanvasMediaRenderError?: (item: CanvasSceneItem) => void;
  canvasTearOutTargetRegistry?: CanvasTearOutComposerTargetRegistry;
  getCanvasTearOutOutputById?: (outputId: string) => StudioOutput | null;
  onItemLimitReached?: () => void;
};

type SeededCanvasHarnessProps = CanvasHarnessProps & {
  initialSessionState: CanvasWorkspaceSessionState;
};

export function CanvasHarness({
  onPinTextReference,
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  isItemDraggable = false,
  onInteractionActiveChange,
  onItemDragStart,
  onItemDragEnd,
  onOpenMediaDetail,
  onCanvasMediaRenderError,
  canvasTearOutTargetRegistry,
  getCanvasTearOutOutputById,
  onItemLimitReached,
}: CanvasHarnessProps) {
  const [visible, setVisible] = useState(true);
  const canvasProps = useAiStudioCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop:
      prepareCanvasMediaLibraryDrop ?? defaultPrepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference,
    onOpenMediaDetail,
    canvasTearOutTargetRegistry,
    getCanvasTearOutOutputById,
    onItemLimitReached,
  });

  return (
    <div>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle
      </button>
      {visible ? (
        <CanvasPropertiesPanel
          {...canvasProps}
          isItemDraggable={isItemDraggable}
          onInteractionActiveChange={onInteractionActiveChange}
          onItemDragStart={onItemDragStart}
          onItemDragEnd={onItemDragEnd}
          onCanvasMediaRenderError={onCanvasMediaRenderError}
        />
      ) : null}
    </div>
  );
}

export function DualCanvasHarness({
  onPinTextReference,
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  onOpenMediaDetail,
  onItemLimitReached,
}: CanvasHarnessProps) {
  const { mainCanvasProps, railCanvasProps } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop:
      prepareCanvasMediaLibraryDrop ?? defaultPrepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference,
    onOpenMediaDetail,
    onItemLimitReached,
  });

  return (
    <div>
      <CanvasPropertiesPanel {...mainCanvasProps} />
      <CanvasPropertiesPanel {...railCanvasProps} />
    </div>
  );
}

export function SeededCanvasHarness({
  initialSessionState,
  onPinTextReference,
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDroppedMediaReference,
  resolveCanvasDropFiles,
  isItemDraggable = false,
  onInteractionActiveChange,
  onItemDragStart,
  onItemDragEnd,
  onOpenMediaDetail,
  onCanvasMediaRenderError,
  onItemLimitReached,
}: SeededCanvasHarnessProps) {
  const [visible, setVisible] = useState(true);
  const { mainCanvasProps, hydrateSessionState } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop:
      prepareCanvasMediaLibraryDrop ?? defaultPrepareCanvasMediaLibraryDrop,
    resolveCanvasDroppedMediaReference,
    resolveCanvasDropFiles,
    onPinTextReference,
    onOpenMediaDetail,
    onItemLimitReached,
  });

  useEffect(() => {
    hydrateSessionState(initialSessionState);
  }, [hydrateSessionState, initialSessionState]);

  return (
    <div>
      <button type="button" onClick={() => setVisible((current) => !current)}>
        Toggle
      </button>
      {visible ? (
        <CanvasPropertiesPanel
          {...mainCanvasProps}
          isItemDraggable={isItemDraggable}
          onInteractionActiveChange={onInteractionActiveChange}
          onItemDragStart={onItemDragStart}
          onItemDragEnd={onItemDragEnd}
          onCanvasMediaRenderError={onCanvasMediaRenderError}
        />
      ) : null}
    </div>
  );
}

export const mockViewportRect = (element: HTMLElement) => {
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: 600,
  });
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 600,
      bottom: 400,
      width: 600,
      height: 400,
      toJSON: () => ({}),
    }),
  });
  window.dispatchEvent(new Event("resize"));
};
