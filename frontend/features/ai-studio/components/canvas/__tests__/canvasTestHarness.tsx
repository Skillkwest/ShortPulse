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
  PrepareCanvasMediaLibraryDrop,
  PrepareResolvedInternalCanvasDrop,
  ResolveCanvasDropFiles,
  ResolveCanvasDropReference,
} from "../canvasTypes";
import type { CanvasWorkspaceSessionState } from "../canvasWorkspaceContracts";

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
  if (payload.outputId === "txt-1") {
    return {
      kind: "text",
      outputId: "txt-1",
      text: "Prompt reference",
      sourceSurface: payload.sourceSurface ?? null,
    };
  }
  return null;
};

export type CanvasHarnessProps = {
  onPinTextReference?: (text: string) => void;
  resolveCanvasDropReference?: ResolveCanvasDropReference;
  prepareResolvedInternalCanvasDrop?: PrepareResolvedInternalCanvasDrop;
  prepareCanvasMediaLibraryDrop?: PrepareCanvasMediaLibraryDrop;
  resolveCanvasDropFiles?: ResolveCanvasDropFiles;
  isItemDraggable?: boolean;
  onItemDragStart?: (id: string, event: React.DragEvent<HTMLElement>) => void;
  onItemDragEnd?: (id: string, event: React.DragEvent<HTMLElement>) => void;
};

type SeededCanvasHarnessProps = CanvasHarnessProps & {
  initialSessionState: CanvasWorkspaceSessionState;
};

export function CanvasHarness({
  onPinTextReference,
  resolveCanvasDropReference,
  prepareResolvedInternalCanvasDrop,
  prepareCanvasMediaLibraryDrop,
  resolveCanvasDropFiles,
  isItemDraggable = false,
  onItemDragStart,
  onItemDragEnd,
}: CanvasHarnessProps) {
  const [visible, setVisible] = useState(true);
  const canvasProps = useAiStudioCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDropFiles,
    onPinTextReference,
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
          onItemDragStart={onItemDragStart}
          onItemDragEnd={onItemDragEnd}
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
  resolveCanvasDropFiles,
}: CanvasHarnessProps) {
  const { mainCanvasProps, railCanvasProps } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDropFiles,
    onPinTextReference,
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
  resolveCanvasDropFiles,
  isItemDraggable = false,
  onItemDragStart,
  onItemDragEnd,
}: SeededCanvasHarnessProps) {
  const [visible, setVisible] = useState(true);
  const { mainCanvasProps, hydrateSessionState } = useAiStudioDualCanvasWorkspaceState({
    resolveCanvasDropReference: resolveCanvasDropReference ?? defaultResolveCanvasDropReference,
    prepareResolvedInternalCanvasDrop,
    prepareCanvasMediaLibraryDrop,
    resolveCanvasDropFiles,
    onPinTextReference,
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
          onItemDragStart={onItemDragStart}
          onItemDragEnd={onItemDragEnd}
        />
      ) : null}
    </div>
  );
}

export const mockViewportRect = (element: HTMLElement) => {
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
};
