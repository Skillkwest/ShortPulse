/**
 * Shared types for the AI Studio Canvas workspace.
 * Defines the scene, camera, and reference-drop contracts used by the page and panel.
 */
import type {
  InternalReferenceDragPayload,
  ReferenceDragSourceSurface,
} from "../../utils/dragDrop";
import type { MediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";

export type CanvasCamera = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasResizeHandle = "nw" | "ne" | "se" | "sw";

type CanvasSceneItemBase = {
  id: string;
  kind: "image" | "text";
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

export type CanvasTextItem = CanvasSceneItemBase & {
  kind: "text";
  text: string;
  width: number;
};

export type CanvasSceneItem = CanvasImageItem | CanvasTextItem;

export type CanvasDropResolution =
  | {
      kind: "image";
      outputId: string | null;
      mediaId: string | null;
      src: string;
      alt: string;
      width?: number;
      height?: number;
      sourceSurface?: ReferenceDragSourceSurface | null;
    }
  | {
      kind: "text";
      outputId: string | null;
      text: string;
      sourceSurface?: ReferenceDragSourceSurface | null;
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
) => Promise<CanvasDropResolution | null> | CanvasDropResolution | null;

/**
 * Allows surfaces to preprocess or reroute Media Library drops before insertion.
 */
export type PrepareCanvasMediaLibraryDrop = (
  payload: MediaLibraryDragPayload
) => Promise<CanvasDropResolution | null> | CanvasDropResolution | null;

/**
 * Allows surfaces to convert dropped desktop files into one or more Canvas insert items.
 */
export type ResolveCanvasDropFiles = (
  files: FileList
) => Promise<CanvasDropResolution[] | null> | CanvasDropResolution[] | null;
