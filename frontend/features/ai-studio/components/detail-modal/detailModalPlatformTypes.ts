/**
 * Shared detail-modal platform contracts.
 * Defines the future cross-surface selection and capability model for media details.
 */
import type { CanvasWorkspaceInstanceId } from "../canvas/canvasWorkspaceContracts";
import type { StudioAudioSourceMode } from "../../types";

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

export type SharedMediaDetailSelection = SharedMediaDetailSelectionTarget | null;

export type SharedMediaDetailCapabilities = {
  canSaveToLibrary: boolean;
  canDownload: boolean;
  canDelete: boolean;
  canEditPrompt: boolean;
  canSavePrompt: boolean;
  canShowCharacterContext: boolean;
  canShowStyleContext: boolean;
};

export type SharedMediaDetailContentKind = "image" | "video" | "audio" | "prompt";

export type SharedMediaDetailMedia = {
  id: string;
  kind: SharedMediaDetailContentKind;
  url: string;
  createdAt?: string | null;
  filename?: string | null;
  promptText?: string | null;
  transcriptText?: string | null;
  source?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  fullUrl?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
};

export type SharedMediaDetailItemBase = {
  surface: SharedMediaDetailSurface;
  selectionTarget: SharedMediaDetailSelectionTarget;
  capabilities: SharedMediaDetailCapabilities;
  media: SharedMediaDetailMedia;
};

export type DetailModalContext = {
  activeVoiceChangerSourceVideo?: {
    aspect: string | null;
  } | null;
};
