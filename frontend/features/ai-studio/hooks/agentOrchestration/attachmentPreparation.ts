/**
 * Attachment preparation pipeline for AI Studio agent sends.
 * Resolves image attachment URLs into safe HTTPS URLs with bounded caching.
 */
import type { AgentAttachment } from "../../../../prefabs/agent";
import { prepareImageUrl } from "../../logic/imageDescription";

const PREPARED_AGENT_IMAGE_URL_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_PREPARED_IMAGE_URL_CACHE_ENTRIES = 64;

export type PrepareImageAttachmentsResult =
  | {
      ok: true;
      imageAttachmentIds: string[];
      preparedImageUrls: Map<string, string>;
    }
  | {
      ok: false;
      reason: "missing_url";
      failedIds: string[];
    }
  | {
      ok: false;
      reason: "prepare_failed";
      failedIds: string[];
      attemptedCount: number;
    };

/**
 * Resolve attached image URLs into safe HTTPS URLs.
 * Returns structured failure reasons so the caller can preserve UI/error semantics.
 */
export const prepareAgentImageAttachments = async ({
  attachments,
  preparedImageUrlCache,
}: {
  attachments: AgentAttachment[];
  preparedImageUrlCache: Map<string, { safeUrl: string; expiresAtMs: number }>;
}): Promise<PrepareImageAttachmentsResult> => {
  const imageAttachmentsMissingUrl = attachments.filter(
    (attachment) => attachment.kind === "image" && !attachment.imageUrl?.trim()
  );
  if (imageAttachmentsMissingUrl.length > 0) {
    return {
      ok: false,
      reason: "missing_url",
      failedIds: imageAttachmentsMissingUrl.map((attachment) => attachment.id),
    };
  }

  const imageAttachments = attachments.filter(
    (attachment): attachment is AgentAttachment =>
      attachment.kind === "image" && Boolean(attachment.imageUrl?.trim())
  );
  const imageAttachmentIds = imageAttachments.map((attachment) => attachment.id);
  if (!imageAttachmentIds.length) {
    return {
      ok: true,
      imageAttachmentIds,
      preparedImageUrls: new Map<string, string>(),
    };
  }

  const resolvePreparedImageUrl = async (sourceUrl: string): Promise<string | null> => {
    const cached = preparedImageUrlCache.get(sourceUrl);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.safeUrl;
    }
    if (cached) {
      preparedImageUrlCache.delete(sourceUrl);
    }
    const safeUrl = sourceUrl ? await prepareImageUrl(sourceUrl) : null;
    if (!safeUrl?.startsWith("https://")) return safeUrl;
    preparedImageUrlCache.set(sourceUrl, {
      safeUrl,
      expiresAtMs: Date.now() + PREPARED_AGENT_IMAGE_URL_CACHE_TTL_MS,
    });
    if (preparedImageUrlCache.size > MAX_PREPARED_IMAGE_URL_CACHE_ENTRIES) {
      const oldestKey = preparedImageUrlCache.keys().next().value;
      if (oldestKey) {
        preparedImageUrlCache.delete(oldestKey);
      }
    }
    return safeUrl;
  };

  const preparedResults = await Promise.allSettled(
    imageAttachments.map(async (attachment) => {
      const sourceUrl = attachment.imageUrl?.trim() ?? "";
      const safeUrl = await resolvePreparedImageUrl(sourceUrl);
      return {
        attachmentId: attachment.id,
        safeUrl,
      };
    })
  );

  const preparedImageUrls = new Map<string, string>();
  const failedAttachmentIds: string[] = [];
  preparedResults.forEach((result, index) => {
    const attachmentId = imageAttachments[index]?.id;
    if (!attachmentId) return;
    if (result.status === "fulfilled" && result.value.safeUrl?.startsWith("https://")) {
      preparedImageUrls.set(attachmentId, result.value.safeUrl);
      return;
    }
    failedAttachmentIds.push(attachmentId);
  });

  if (failedAttachmentIds.length) {
    return {
      ok: false,
      reason: "prepare_failed",
      failedIds: failedAttachmentIds,
      attemptedCount: imageAttachmentIds.length,
    };
  }

  return {
    ok: true,
    imageAttachmentIds,
    preparedImageUrls,
  };
};
