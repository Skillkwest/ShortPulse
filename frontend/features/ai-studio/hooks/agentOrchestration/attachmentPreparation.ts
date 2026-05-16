/**
 * Attachment preparation pipeline for AI Studio agent sends.
 * Resolves image attachment URLs into safe HTTPS URLs with bounded caching.
 */
import type { AgentAttachment } from "../../../../prefabs/agent";
import { resolveAgentAttachmentPreviewUrl } from "../../logic/agentAttachmentImage";
import { projectAgentAttachmentToComposerImageAttachment } from "../../logic/composerImageAttachment";
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
  const imageAttachments = attachments.filter(
    (attachment): attachment is AgentAttachment => attachment.kind === "image"
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
      const projectedImageAttachment = projectAgentAttachmentToComposerImageAttachment(attachment);
      const sourceUrl =
        attachment.submissionImageUrl?.trim() ??
        (await resolveAgentAttachmentPreviewUrl({
          previewStoragePath: attachment.previewStoragePath ?? null,
          fullStoragePath: attachment.fullStoragePath ?? null,
          referenceRenderUrl: attachment.referenceRenderUrl ?? null,
          referenceUrl: attachment.referenceUrl ?? null,
          imageUrl: attachment.submissionImageUrl ?? attachment.imageUrl ?? null,
        }).catch(() => null)) ??
        projectedImageAttachment?.preview.url ??
        attachment.imageUrl?.trim() ??
        "";
      if (!sourceUrl) {
        return {
          attachmentId: attachment.id,
          safeUrl: null,
          missingUrl: true,
        };
      }
      const safeUrl = await resolvePreparedImageUrl(sourceUrl);
      return {
        attachmentId: attachment.id,
        safeUrl,
        missingUrl: false,
      };
    })
  );

  const preparedImageUrls = new Map<string, string>();
  const missingUrlAttachmentIds: string[] = [];
  const failedAttachmentIds: string[] = [];
  preparedResults.forEach((result, index) => {
    const attachmentId = imageAttachments[index]?.id;
    if (!attachmentId) return;
    if (result.status === "fulfilled" && result.value.missingUrl) {
      missingUrlAttachmentIds.push(attachmentId);
      return;
    }
    if (result.status === "fulfilled" && result.value.safeUrl?.startsWith("https://")) {
      preparedImageUrls.set(attachmentId, result.value.safeUrl);
      return;
    }
    failedAttachmentIds.push(attachmentId);
  });

  if (missingUrlAttachmentIds.length > 0) {
    return {
      ok: false,
      reason: "missing_url",
      failedIds: missingUrlAttachmentIds,
    };
  }

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
