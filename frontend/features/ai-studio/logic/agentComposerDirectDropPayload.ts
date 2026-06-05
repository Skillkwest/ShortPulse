import type { ComposerImageDropPayload, InternalReferenceDragPayload } from "../utils/dragDrop";

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
      kind: "unsupported";
      mediaKind?: "video" | "audio" | null;
    };
