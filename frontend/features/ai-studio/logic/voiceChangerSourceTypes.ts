/**
 * Shared Voice Changer source model types.
 */
import type { InternalReferenceDragPayload } from "../utils/dragDrop";

export type VoiceChangerSourceKind = "audio" | "video";
export type VoiceChangerSourceOrigin = "local" | "reference-grid" | "url";
export type VoiceChangerSourceStatus = "uploading" | "extracting" | "ready" | "failed";
export type AcceptedVoiceSourceKind = VoiceChangerSourceKind;

export type VoiceChangerSource = {
  id: string;
  kind: VoiceChangerSourceKind;
  origin: VoiceChangerSourceOrigin;
  status: VoiceChangerSourceStatus;
  aspect: string | null;
  durationMs: number | null;
  name: string;
  mimeType: string | null;
  file: File | null;
  previewUrl: string | null;
  sourceUrl: string | null;
  objectUrl: string | null;
  storagePath: string | null;
  referenceOutputId: string | null;
  referenceMediaId: string | null;
  errorMessage: string | null;
  extractedFrom: {
    kind: "video";
    name: string;
    mimeType: string | null;
    previewUrl: string | null;
    sourceUrl: string | null;
    storagePath: string | null;
    aspect: string | null;
    referenceOutputId: string | null;
    referenceMediaId: string | null;
  } | null;
};

export type ResolveVoiceChangerInternalReferenceSource = (
  payload: InternalReferenceDragPayload
) => Promise<VoiceChangerSource | null> | VoiceChangerSource | null;

export type VoiceSourceDropSnapshot = {
  transferTypes: string[];
  files: File[];
  internalReferenceDragToken: string;
  referenceOrigin: string;
  referenceId: string;
  referenceOutputId: string;
  referenceMediaId: string;
  referenceMediaKind: string;
  referencePreviewStoragePath: string;
  referenceFullStoragePath: string;
  referenceSourceSurface: string;
  referenceUrl: string;
  referenceRenderUrl: string;
  imageUrl: string;
  plainText: string;
  uriList: string;
};
