/**
 * Shared detail-modal platform contracts.
 * Defines the future cross-surface selection and capability model for media details.
 */
import type { CanvasWorkspaceInstanceId } from "../canvas/canvasWorkspaceContracts";

export type SharedMediaDetailSurface =
  | "reference-grid"
  | "quick-slot"
  | "media-library-panel"
  | "character-media-panel"
  | "elements-media-panel"
  | "right-rail-canvas"
  | "media-library-folder-canvas";

export type SharedMediaDetailSelectionTarget =
  | {
      kind: "studio-output";
      outputId: string;
      surface: SharedMediaDetailSurface;
    }
  | {
      kind: "media-file";
      fileId: string;
      surface: SharedMediaDetailSurface;
    }
  | {
      kind: "canvas-item";
      itemId: string;
      surface: SharedMediaDetailSurface;
      instanceId?: CanvasWorkspaceInstanceId;
    };

export type SharedMediaDetailCapabilities = {
  canSaveToLibrary: boolean;
  canDownload: boolean;
  canDelete: boolean;
  canEditPrompt: boolean;
  canSavePrompt: boolean;
  canShowCharacterContext: boolean;
  canShowStyleContext: boolean;
};

export type DetailModalContext = {
  activeVoiceChangerSourceVideo?: {
    aspect: string | null;
  } | null;
};
