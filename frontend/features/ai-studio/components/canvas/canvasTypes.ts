/**
 * Shared types for the AI Studio Canvas workspace.
 * Defines the scene, camera, and reference-drop contracts used by the page and panel.
 */
import type {
  InternalReferenceDragPayload,
  ReferenceDragSourceSurface,
} from "../../utils/dragDrop";
import type { MediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import type { StudioAudioSourceMode } from "../../types";

export type CanvasCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasResizeHandle = "nw" | "ne" | "se" | "sw";

type CanvasSceneItemBase = {
  id: string;
  kind: "image" | "video" | "text" | "audio";
  x: number;
  y: number;
  z: number;
  selected: boolean;
  outputId: string | null;
  sourceSurface?: ReferenceDragSourceSurface | null;
};

export type CanvasImageItem = CanvasSceneItemBase & {
  kind: "image";
  mediaId: string | null;
  src: string;
  alt: string;
  width: number;
  height: number;
};

export type CanvasVideoItem = CanvasSceneItemBase & {
  kind: "video";
  mediaId: string | null;
  videoUrl: string;
  posterUrl?: string | null;
  title?: string | null;
  durationMs?: number | null;
  width: number;
  height: number;
};

export type CanvasTextItem = CanvasSceneItemBase & {
  kind: "text";
  text: string;
  width: number;
  height?: number;
};

export type CanvasAudioItem = CanvasSceneItemBase & {
  kind: "audio";
  mediaId: string | null;
  audioUrl: string;
  title: string | null;
  companionArtUrl?: string | null;
  companionArtStoragePath?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
  width: number;
  height: number;
};

export type CanvasSceneItem = CanvasImageItem | CanvasVideoItem | CanvasTextItem | CanvasAudioItem;

type CanvasDropResolutionBase = {
  outputId: string | null;
  sourceSurface?: ReferenceDragSourceSurface | null;
  preferredItemId?: string | null;
};

export type CanvasDropResolution =
  | (CanvasDropResolutionBase & {
      kind: "image";
      mediaId: string | null;
      src: string;
      alt: string;
      width?: number;
      height?: number;
    })
  | (CanvasDropResolutionBase & {
      kind: "video";
      mediaId: string | null;
      videoUrl: string;
      posterUrl?: string | null;
      title?: string | null;
      durationMs?: number | null;
      width?: number;
      height?: number;
    })
  | (CanvasDropResolutionBase & {
      kind: "text";
      text: string;
    })
  | (CanvasDropResolutionBase & {
      kind: "audio";
      mediaId: string | null;
      audioUrl: string;
      title?: string | null;
      companionArtUrl?: string | null;
      companionArtStoragePath?: string | null;
      audioSourceMode?: StudioAudioSourceMode | null;
      durationMs?: number | null;
      waveformPeaks?: number[] | null;
      width?: number;
      height?: number;
    });

export type CanvasInsertResult =
  | {
      status: "inserted";
      itemId: string;
      reusedExistingItem: boolean;
      resolved: CanvasDropResolution;
      removeInsertedItem: () => void;
    }
  | {
      status: "blocked_by_cap";
      resolved: CanvasDropResolution;
    };

export type CanvasPreparedDrop =
  | CanvasDropResolution
  | {
      resolved: CanvasDropResolution;
      afterInsert?: (result: CanvasInsertResult) => Promise<void> | void;
    };

/**
 * Resolves an internal reference-grid drag payload into a Canvas-ready insert item.
 */
export type ResolveCanvasDropReference = (
  payload: InternalReferenceDragPayload
) => CanvasDropResolution | null;

/**
 * Allows surfaces to mutate or veto resolved internal-reference drops before insertion.
 */
export type PrepareResolvedInternalCanvasDrop = (
  payload: InternalReferenceDragPayload,
  resolved: CanvasDropResolution
) => Promise<CanvasPreparedDrop | null> | CanvasPreparedDrop | null;

/**
 * Allows surfaces to preprocess or reroute Media Library drops before insertion.
 */
export type PrepareCanvasMediaLibraryDrop = (
  payload: MediaLibraryDragPayload
) => Promise<CanvasPreparedDrop | null> | CanvasPreparedDrop | null;

/**
 * Allows surfaces to convert dropped external media references into a Canvas insert item.
 */
export type ResolveCanvasDroppedMediaReference = (payload: {
  url: string;
  mimeType?: string | null;
}) => Promise<CanvasDropResolution | null> | CanvasDropResolution | null;

/**
 * Allows surfaces to convert dropped desktop files into one or more Canvas insert items.
 */
export type ResolveCanvasDropFiles = (
  files: FileList
) => Promise<CanvasDropResolution[] | null> | CanvasDropResolution[] | null;
