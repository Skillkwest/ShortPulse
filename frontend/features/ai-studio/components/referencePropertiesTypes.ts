/**
 * Shared type and media-ref helpers for AI Studio reference properties interactions.
 */
import {
  createInternalMediaRef,
  INTERNAL_MEDIA_REF_BUCKET,
} from "../../../lib/media/internalMediaRefs";
import type { AgentComposerDirectDropPayload } from "../logic/agentComposerDirectDropPayload";
import type { extractInternalReferenceDragPayload } from "../utils/dragDrop";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import type { AiStudioKlingElement } from "../logic/klingElements";
import type { ImageUploadResponse } from "../utils/imageUpload";
import type { VideoUploadResult } from "../utils/videoUpload";
import type { AudioUploadResult } from "../utils/audioUpload";

export type ReferenceStepKey =
  | "reference"
  | "model"
  | "imageSettings"
  | "prompt"
  | "motionAudio"
  | "videoSettings"
  | "klingAdvanced"
  | "klingAssets"
  | "klingGuidance"
  | "generate";

export type KlingMultiPrompt = { id: string; prompt: string; duration: number };

export type KlingElement = AiStudioKlingElement;

export type ReferenceImageDropSnapshot = {
  internalPayload: ReturnType<typeof extractInternalReferenceDragPayload> | null;
  imageUrl: string | null;
  imageFile?: File | null;
  fromFile?: boolean;
  referenceId?: string | null;
  mediaId?: string | null;
  mediaKind?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  displayPreviewUrl?: string | null;
  preferLocalRenderArtifact?: boolean;
};

export type UseReferencePropertiesInteractionsParams = {
  interactionScope?: "full" | "image";
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  onPrimaryImageChange: (url: string | null) => void;
  onExtraImageChange: (index: number, url: string | null) => void;
  onPromptTextChange: (value: string) => void;
  stagePrimaryImageForProviderAccess?: boolean;
  onMotionVideoChange?: (url: string | null) => void;
  onStageMotionVideoSelection?: (input: {
    videoFile?: File | null;
    videoUrl?: string | null;
  }) => Promise<void>;
  resolvePreviewUrlById?: (id: string | null) => string | null;
  resolveMotionVideoUrlById?: (id: string | null) => string | null;
  resolveInternalReferenceImageDropSource?: ResolveInternalReferenceDrop;
  resolveInternalReferenceVideoDropSource?: ResolveInternalReferenceDrop;
  klingMultiPrompts: KlingMultiPrompt[];
  onKlingMultiPromptsChange?: (value: KlingMultiPrompt[]) => void;
  klingElements: KlingElement[];
  onKlingElementsChange?: (value: KlingElement[]) => void;
  seedanceElementSlotCount?: number;
  onSeedanceElementMediaSlotChange?: (
    slotIndex: number,
    value: { kind: "image" | "video" | "audio"; url: string; name?: string | null } | null
  ) => void;
};

const IMAGE_STORAGE_PATH_PATTERN = /\.(?:avif|bmp|gif|heic|heif|jpe?g|png|tiff?|webp)(?:$|[?#])/i;
const NON_IMAGE_STORAGE_PATH_PATTERN =
  /\.(?:aac|flac|m4a|m4v|mov|mp3|mp4|oga|ogg|ogv|wav|webm)(?:$|[?#])/i;

export const trimOptionalString = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
};

export const isLocalRenderArtifactUrl = (value: string | null | undefined): boolean => {
  const trimmed = value?.trim() ?? "";
  return trimmed.startsWith("blob:") || trimmed.startsWith("data:image/");
};

const isImageStoragePath = (value: string | null | undefined): boolean =>
  Boolean(value && IMAGE_STORAGE_PATH_PATTERN.test(value.trim()));

const isKnownNonImageStoragePath = (value: string | null | undefined): boolean =>
  Boolean(value && NON_IMAGE_STORAGE_PATH_PATTERN.test(value.trim()));

export const resolveImageStoragePath = ({
  fullStoragePath,
  previewStoragePath,
  mediaKind,
}: {
  fullStoragePath?: string | null;
  previewStoragePath?: string | null;
  mediaKind?: string | null;
}): string | null => {
  const fullPath = trimOptionalString(fullStoragePath);
  const previewPath = trimOptionalString(previewStoragePath);
  if (!fullPath) return previewPath;
  if (!previewPath) return isKnownNonImageStoragePath(fullPath) ? null : fullPath;
  if (mediaKind && mediaKind !== "image") {
    return isImageStoragePath(previewPath) ? previewPath : null;
  }
  if (isKnownNonImageStoragePath(fullPath) && isImageStoragePath(previewPath)) return previewPath;
  return fullPath;
};

export const createImageSlotInternalMediaRef = ({
  fullStoragePath,
  previewStoragePath,
  mediaId,
  mediaKind,
}: {
  fullStoragePath?: string | null;
  previewStoragePath?: string | null;
  mediaId?: string | null;
  mediaKind?: string | null;
}) => {
  const storagePath = resolveImageStoragePath({
    fullStoragePath,
    previewStoragePath,
    mediaKind,
  });
  if (!storagePath) return null;
  return createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath,
    mediaFileId: mediaId ?? null,
  });
};

export const createUploadedImageInternalMediaRef = (uploaded: ImageUploadResponse) =>
  createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath: uploaded.path,
  });

export const createUploadedVideoInternalMediaRef = (uploaded: VideoUploadResult) =>
  createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath: uploaded.path,
  });

export const createUploadedAudioInternalMediaRef = (uploaded: AudioUploadResult) =>
  createInternalMediaRef({
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storagePath: uploaded.path,
  });

export const resolveCanvasTearOutReferenceImageSnapshot = (
  payload: AgentComposerDirectDropPayload
): ReferenceImageDropSnapshot | null => {
  if (payload.kind !== "image") return null;
  const internalPayload = payload.internalPayload ?? null;
  const composerImagePayload = payload.composerImagePayload ?? null;
  const imageUrl =
    trimOptionalString(composerImagePayload?.displayArtifactUrl) ??
    trimOptionalString(internalPayload?.referenceRenderUrl) ??
    trimOptionalString(internalPayload?.referenceUrl);
  const referenceId =
    trimOptionalString(composerImagePayload?.referenceId) ??
    trimOptionalString(internalPayload?.referenceId) ??
    trimOptionalString(composerImagePayload?.outputId) ??
    trimOptionalString(internalPayload?.outputId) ??
    trimOptionalString(composerImagePayload?.mediaId) ??
    trimOptionalString(internalPayload?.mediaId);
  return {
    internalPayload,
    imageUrl,
    referenceId,
    mediaKind: internalPayload?.mediaKind ?? null,
    displayPreviewUrl: trimOptionalString(composerImagePayload?.displayArtifactUrl),
    preferLocalRenderArtifact: Boolean(composerImagePayload?.displayArtifactUrl),
  };
};
