/**
 * Shared detail-modal platform contracts.
 * Defines the future cross-surface selection and capability model for media details.
 */
import type { CanvasWorkspaceInstanceId } from "../canvas/canvasWorkspaceContracts";
import type { StudioAudioSourceMode, StudioOutput, WorkflowReloadMusicMode } from "../../types";
import type { ReactNode } from "react";

export type SharedMediaDetailSurface =
  | "reference-grid"
  | "quick-slot"
  | "media-library-panel"
  | "character-media-panel"
  | "elements-media-panel"
  | "right-rail-canvas";

export type SharedMediaDetailSelectionTarget =
  | {
      kind: "studio-output";
      outputId: string;
      surface: SharedMediaDetailSurface;
      outputSnapshot?: StudioOutput;
    }
  | {
      kind: "media-file";
      fileId: string;
      surface: SharedMediaDetailSurface;
    }
  | {
      kind: "media-prompt";
      promptId: string;
      surface: SharedMediaDetailSurface;
    }
  | {
      kind: "canvas-item";
      itemId: string;
      surface: SharedMediaDetailSurface;
      instanceId?: CanvasWorkspaceInstanceId;
    }
  | {
      kind: "slot-reference";
      slotId: string;
      surface: SharedMediaDetailSurface;
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
  lyricsText?: string | null;
  source?: string | null;
  width?: number | null;
  height?: number | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  fullUrl?: string | null;
  companionArtUrl?: string | null;
  companionArtStoragePath?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  musicMode?: WorkflowReloadMusicMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
};

export type SharedMediaDetailTopBarItem = {
  label: string;
  className?: string;
  title?: string;
};

export type SharedMediaDetailPresentation = {
  title?: string | null;
  kindLabel?: string | null;
  topBarItems?: SharedMediaDetailTopBarItem[] | null;
  bladePlaceholder?: string | null;
  errorContent?: {
    summary: string;
    detail: string;
    rawPayload?: string | null;
  } | null;
};

export type SharedMediaDetailActionIntent = "default" | "save" | "danger";

export type SharedMediaDetailActionItem = {
  id: string;
  label: string;
  onClick: () => void | Promise<void>;
  ariaLabel?: string;
  disabled?: boolean;
  title?: string;
  intent?: SharedMediaDetailActionIntent;
  state?: "default" | "saved";
  icon?: ReactNode;
  className?: string;
};

export type SharedMediaDetailVideoSnapshotHandler = (
  video: HTMLVideoElement,
  filenameHint?: string | null
) => void | Promise<void>;

export type SharedMediaDetailVideoSnapshotErrorHandler = (message: string) => void;

export type SharedMediaDetailSaveActionState =
  | "hidden"
  | "idle"
  | "saving"
  | "saved"
  | "failed"
  | "blocked_storage";

export type SharedMediaDetailItemBase = {
  surface: SharedMediaDetailSurface;
  selectionTarget: SharedMediaDetailSelectionTarget;
  capabilities: SharedMediaDetailCapabilities;
  media: SharedMediaDetailMedia;
  presentation?: SharedMediaDetailPresentation | null;
};

export type DetailModalContext = {
  activeVoiceChangerSourceVideo?: {
    aspect: string | null;
  } | null;
};
