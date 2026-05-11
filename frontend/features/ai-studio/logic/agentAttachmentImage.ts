import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import type { AgentAttachment } from "../../../prefabs/agent/types";
import { normalizeReferenceTransferUrlCandidate } from "../utils/dragDrop";
import { refreshSupabaseSignedUrlIfNeeded } from "../utils/imageUpload";

const MEDIA_BUCKET = "media_library";
const RENDERABLE_ATTACHMENT_IMAGE_URL_PATTERN = /^(?:data:image\/|blob:|https?:\/\/|\/)/i;

const normalizeText = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeAttachmentStoragePath = (value: string | null | undefined): string | null =>
  normalizeText(value);

const isCurrentDocumentUrl = (value: string) => {
  if (typeof window === "undefined") return false;
  try {
    const current = new URL(window.location.href);
    const candidate = new URL(value, window.location.href);
    return (
      candidate.origin === current.origin &&
      candidate.pathname === current.pathname &&
      candidate.search === current.search
    );
  } catch {
    return false;
  }
};

export const normalizeAttachmentImageUrl = (value: string | null | undefined): string | null => {
  const rawValue = normalizeText(value);
  if (!rawValue || !RENDERABLE_ATTACHMENT_IMAGE_URL_PATTERN.test(rawValue)) {
    return null;
  }
  const normalized =
    normalizeReferenceTransferUrlCandidate(rawValue, {
      unwrapNextImage: false,
    }) ?? rawValue;
  if (isCurrentDocumentUrl(normalized)) return null;
  return normalized;
};

export const buildAgentAttachmentImageCandidates = (
  attachment: Pick<
    AgentAttachment,
    "imageUrl" | "imageFallbackUrls" | "referenceRenderUrl" | "referenceUrl"
  >
): string[] =>
  Array.from(
    new Set(
      [
        attachment.imageUrl,
        ...(attachment.imageFallbackUrls ?? []),
        attachment.referenceRenderUrl,
        attachment.referenceUrl,
      ]
        .map((candidate) => normalizeAttachmentImageUrl(candidate))
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );

const refreshAttachmentPreviewUrl = async (
  value: string | null | undefined
): Promise<string | null> => {
  const normalized = normalizeAttachmentImageUrl(value);
  if (!normalized) return null;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return normalized;
  return await refreshSupabaseSignedUrlIfNeeded(normalized).catch(() => normalized);
};

export const resolveAgentAttachmentPreviewUrl = async (
  attachment: Pick<
    AgentAttachment,
    "previewStoragePath" | "fullStoragePath" | "referenceRenderUrl" | "referenceUrl" | "imageUrl"
  >
): Promise<string | null> => {
  const previewStoragePath = normalizeAttachmentStoragePath(attachment.previewStoragePath);
  const fullStoragePath = normalizeAttachmentStoragePath(attachment.fullStoragePath);
  const storagePath = previewStoragePath ?? fullStoragePath;
  if (storagePath) {
    const normalizedStorageUrl = normalizeAttachmentImageUrl(storagePath);
    if (normalizedStorageUrl) {
      const refreshedStorageUrl = await refreshAttachmentPreviewUrl(normalizedStorageUrl);
      if (refreshedStorageUrl) return refreshedStorageUrl;
    } else {
      const signedUrl = await getSignedMediaUrl({
        bucket: MEDIA_BUCKET,
        storagePath,
        forceRefresh: true,
      }).catch(() => null);
      const normalizedSignedUrl = normalizeAttachmentImageUrl(signedUrl);
      if (normalizedSignedUrl) return normalizedSignedUrl;
    }
  }

  for (const candidate of [
    attachment.referenceRenderUrl,
    attachment.imageUrl,
    attachment.referenceUrl,
  ]) {
    const resolvedCandidate = await refreshAttachmentPreviewUrl(candidate);
    if (resolvedCandidate) return resolvedCandidate;
  }

  return null;
};
