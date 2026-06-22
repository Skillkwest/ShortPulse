import type { ComposerImageDropPayload, InternalReferenceDragPayload } from "../utils/dragDrop";
import type { StudioAudioSourceMode } from "../types";

export type AgentComposerDirectDropPayload =
  | {
      kind: "text";
      text: string;
    }
  | {
      kind: "image";
      internalPayload: InternalReferenceDragPayload | null;
      composerImagePayload?: ComposerImageDropPayload | null;
    }
  | {
      kind: "video";
      videoUrl: string;
      internalPayload: InternalReferenceDragPayload | null;
      outputId?: string | null;
      mediaId?: string | null;
      durationMs?: number | null;
    }
  | {
      kind: "audio";
      audioUrl: string;
      audioStoragePath?: string | null;
      internalPayload: InternalReferenceDragPayload | null;
      outputId?: string | null;
      mediaId?: string | null;
      durationMs?: number | null;
      audioSourceMode?: StudioAudioSourceMode | null;
    }
  | {
      kind: "unsupported";
      mediaKind?: "video" | "audio" | null;
    };
