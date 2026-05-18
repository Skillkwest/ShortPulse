import { getSignedMediaUrl, getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
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
    "imageUrl" | "submissionImageUrl" | "imageFallbackUrls" | "referenceRenderUrl" | "referenceUrl"
  >
): string[] =>
  Array.from(
    new Set(
      [
        attachment.imageUrl,
        attachment.submissionImageUrl,
        ...(attachment.imageFallbackUrls ?? []),
        attachment.referenceRenderUrl,
        attachment.referenceUrl,
      ]
        .map((candidate) => normalizeAttachmentImageUrl(candidate))
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );

const pushNormalizedUniqueCandidate = (
  candidates: string[],
  value: string | null | undefined
): void => {
  const normalized = normalizeAttachmentImageUrl(value);
  if (!normalized || candidates.includes(normalized)) return;
  candidates.push(normalized);
};

const refreshAttachmentPreviewUrl = async (
  value: string | null | undefined
): Promise<string | null> => {
  const normalized = normalizeAttachmentImageUrl(value);
  if (!normalized) return null;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return normalized;
  return await refreshSupabaseSignedUrlIfNeeded(normalized).catch(() => normalized);
};

const signAttachmentStoragePath = async (storagePath: string): Promise<string | null> => {
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: MEDIA_BUCKET,
    storagePaths: [storagePath],
    forceRefresh: true,
  }).catch(() => null);
  const batchSignedUrl = signedByPath?.get(storagePath) ?? null;
  if (batchSignedUrl) return batchSignedUrl;
  return await getSignedMediaUrl({
    bucket: MEDIA_BUCKET,
    storagePath,
    forceRefresh: true,
  }).catch(() => null);
};

export const resolveAgentAttachmentPreviewUrl = async (
  attachment: Pick<
    AgentAttachment,
    | "previewStoragePath"
    | "fullStoragePath"
    | "referenceRenderUrl"
    | "referenceUrl"
    | "imageUrl"
    | "submissionImageUrl"
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
      const signedUrl = await signAttachmentStoragePath(storagePath);
      const normalizedSignedUrl = normalizeAttachmentImageUrl(signedUrl);
      if (normalizedSignedUrl) return normalizedSignedUrl;
    }
  }

  for (const candidate of [
    attachment.referenceRenderUrl,
    attachment.submissionImageUrl,
    attachment.imageUrl,
    attachment.referenceUrl,
  ]) {
    const resolvedCandidate = await refreshAttachmentPreviewUrl(candidate);
    if (resolvedCandidate) return resolvedCandidate;
  }

  return null;
};

export const resolveAgentAttachmentSubmissionCandidates = async (
  attachment: Pick<
    AgentAttachment,
    | "previewStoragePath"
    | "fullStoragePath"
    | "referenceRenderUrl"
    | "referenceUrl"
    | "imageUrl"
    | "submissionImageUrl"
    | "imageFallbackUrls"
  >
): Promise<string[]> => {
  const candidates: string[] = [];
  pushNormalizedUniqueCandidate(candidates, attachment.submissionImageUrl);

  const durableCandidate = await resolveAgentAttachmentPreviewUrl({
    previewStoragePath: attachment.previewStoragePath,
    fullStoragePath: attachment.fullStoragePath,
    referenceRenderUrl: attachment.referenceRenderUrl,
    referenceUrl: attachment.referenceUrl,
    imageUrl: attachment.imageUrl,
    submissionImageUrl: null,
  }).catch(() => null);
  pushNormalizedUniqueCandidate(candidates, durableCandidate);

  pushNormalizedUniqueCandidate(candidates, attachment.imageUrl);
  (attachment.imageFallbackUrls ?? []).forEach((candidate) => {
    pushNormalizedUniqueCandidate(candidates, candidate);
  });
  pushNormalizedUniqueCandidate(candidates, attachment.referenceRenderUrl);
  pushNormalizedUniqueCandidate(candidates, attachment.referenceUrl);

  return candidates;
};
