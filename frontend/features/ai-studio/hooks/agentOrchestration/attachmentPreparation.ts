/**
 * Attachment preparation pipeline for AI Studio agent sends.
 * Resolves image attachment URLs into safe HTTPS URLs with bounded caching.
 */
import type { AgentAttachment } from "../../../../prefabs/agent";
import {
  recordCreateWorkflowEvent,
  summarizeCreateWorkflowUrl,
} from "../../logic/createWorkflowDebug";
import { resolveAgentAttachmentSubmissionCandidates } from "../../logic/agentAttachmentImage";
import { prepareImageUrlForSubmission, type PrepareImageStageEvent } from "../../utils/imageUpload";

const PREPARED_AGENT_IMAGE_URL_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_PREPARED_IMAGE_URL_CACHE_ENTRIES = 64;
const AGENT_IMAGE_PREPARATION_CONCURRENCY = 3;

const settleWithBoundedConcurrency = async <T, R>({
  items,
  concurrency,
  worker,
}: {
  items: T[];
  concurrency: number;
  worker: (item: T) => Promise<R>;
}): Promise<Array<PromiseSettledResult<R>>> => {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;
  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index] as T) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () => runWorker())
  );
  return results;
};

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
      failureMessages: Record<string, string>;
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

  const resolvePreparedImageUrl = async (
    sourceUrl: string,
    attachmentId: string
  ): Promise<{ safeUrl: string | null; error: string | null }> => {
    const cached = preparedImageUrlCache.get(sourceUrl);
    if (cached && cached.expiresAtMs > Date.now()) {
      return {
        safeUrl: cached.safeUrl,
        error: null,
      };
    }
    if (cached) {
      preparedImageUrlCache.delete(sourceUrl);
    }
    if (!sourceUrl) {
      return {
        safeUrl: null,
        error: "Image source missing.",
      };
    }
    try {
      const preparedUrl = await prepareImageUrlForSubmission(sourceUrl, {
        onStage: (event: PrepareImageStageEvent) => {
          recordCreateWorkflowEvent("attachment_send_prepare_stage", {
            attachmentId,
            source: summarizeCreateWorkflowUrl(sourceUrl),
            ...event,
          });
        },
      });
      const safeUrl = preparedUrl?.startsWith("https://") ? preparedUrl : null;
      if (!safeUrl) {
        return {
          safeUrl: null,
          error: "Prepared image URL was invalid.",
        };
      }
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
      return {
        safeUrl,
        error: null,
      };
    } catch (error) {
      return {
        safeUrl: null,
        error:
          error instanceof Error && error.message.trim() ? error.message.trim() : "Unknown error",
      };
    }
  };

  const summarizeCandidateFailure = (error: string | null): string =>
    error?.trim() || "Image upload/preparation failed.";

  const summarizeAttachmentFailure = (errors: string[]): string =>
    errors.find(Boolean) ?? "Image upload/preparation failed.";

  const preparedResults = await settleWithBoundedConcurrency({
    items: imageAttachments,
    concurrency: AGENT_IMAGE_PREPARATION_CONCURRENCY,
    worker: async (attachment) => {
      const sourceUrls = await resolveAgentAttachmentSubmissionCandidates(attachment);
      recordCreateWorkflowEvent("attachment_send_prepare_started", {
        attachmentId: attachment.id,
        candidateCount: sourceUrls.length,
        candidates: sourceUrls.map((sourceUrl) => summarizeCreateWorkflowUrl(sourceUrl)),
      });
      if (!sourceUrls.length) {
        return {
          attachmentId: attachment.id,
          safeUrl: null,
          missingUrl: true,
          failureMessage: "Image URL missing. Remove this image and attach it again.",
        };
      }

      let safeUrl: string | null = null;
      const errors: string[] = [];
      for (const sourceUrl of sourceUrls) {
        const prepared = await resolvePreparedImageUrl(sourceUrl, attachment.id);
        if (prepared.safeUrl?.startsWith("https://")) {
          safeUrl = prepared.safeUrl;
          recordCreateWorkflowEvent("attachment_send_prepare_candidate_ready", {
            attachmentId: attachment.id,
            source: summarizeCreateWorkflowUrl(sourceUrl),
            prepared: summarizeCreateWorkflowUrl(prepared.safeUrl),
          });
          break;
        }
        errors.push(summarizeCandidateFailure(prepared.error));
        recordCreateWorkflowEvent("attachment_send_prepare_candidate_failed", {
          attachmentId: attachment.id,
          source: summarizeCreateWorkflowUrl(sourceUrl),
          message: summarizeCandidateFailure(prepared.error),
        });
      }

      return {
        attachmentId: attachment.id,
        safeUrl,
        missingUrl: false,
        failureMessage: safeUrl ? null : summarizeAttachmentFailure(errors),
      };
    },
  });

  const preparedImageUrls = new Map<string, string>();
  const missingUrlAttachmentIds: string[] = [];
  const failedAttachmentIds: string[] = [];
  const failureMessages: Record<string, string> = {};
  preparedResults.forEach((result, index) => {
    const attachmentId = imageAttachments[index]?.id;
    if (!attachmentId) return;
    if (result.status === "fulfilled" && result.value.missingUrl) {
      missingUrlAttachmentIds.push(attachmentId);
      if (result.value.failureMessage) {
        failureMessages[attachmentId] = result.value.failureMessage;
      }
      return;
    }
    if (result.status === "fulfilled" && result.value.safeUrl?.startsWith("https://")) {
      preparedImageUrls.set(attachmentId, result.value.safeUrl);
      return;
    }
    failedAttachmentIds.push(attachmentId);
    if (result.status === "fulfilled" && result.value.failureMessage) {
      failureMessages[attachmentId] = result.value.failureMessage;
    } else {
      failureMessages[attachmentId] = "Image upload/preparation failed.";
    }
  });

  if (missingUrlAttachmentIds.length > 0) {
    return {
      ok: false,
      reason: "missing_url",
      failedIds: missingUrlAttachmentIds,
    };
  }

  if (failedAttachmentIds.length) {
    recordCreateWorkflowEvent("attachment_prepare_failed", {
      failedIds: [...failedAttachmentIds],
      failureMessages,
    });
    return {
      ok: false,
      reason: "prepare_failed",
      failedIds: failedAttachmentIds,
      attemptedCount: imageAttachmentIds.length,
      failureMessages,
    };
  }

  recordCreateWorkflowEvent("attachment_send_prepare_ready", {
    imageAttachmentIds,
    preparedImageUrls: Array.from(preparedImageUrls.entries()).map(([attachmentId, safeUrl]) => ({
      attachmentId,
      safeUrl: summarizeCreateWorkflowUrl(safeUrl),
    })),
  });

  return {
    ok: true,
    imageAttachmentIds,
    preparedImageUrls,
  };
};
