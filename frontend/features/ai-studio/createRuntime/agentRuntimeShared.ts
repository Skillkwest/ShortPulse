/**
 * Shared Create-runtime agent helpers.
 * Keeps identical message snapshot and prompt-reference logic in one place for
 * Standard and Pulse runtimes.
 */
import type { AgentMessage } from "../../../prefabs/agent";
import { isAgentMachineFailure } from "../../../prefabs/agent";
import { projectAgentAttachmentToComposerImageAttachment } from "../logic/composerImageAttachment";
import { isEphemeralLocalImageAttachment } from "../logic/ephemeralComposerImage";
import type { AiStudioSessionAgentMessageV1 } from "../logic/sessionSnapshot";

/**
 * Returns whether an assistant message is still a reusable prompt artifact.
 */
export const canUseAssistantMessageAsPrompt = (message: AgentMessage): boolean =>
  message.role === "assistant" &&
  !isAgentMachineFailure(message) &&
  message.canUseAsPrompt === true &&
  typeof message.outputPrompt === "string" &&
  message.outputPrompt.trim().length > 0;

/**
 * Converts one runtime message into the persisted session snapshot contract.
 */
export const serializeAgentMessageForSnapshot = (
  message: AgentMessage
): AiStudioSessionAgentMessageV1 => {
  const attachments = message.attachments
    ?.filter((attachment) => !isEphemeralLocalImageAttachment(attachment))
    .map((attachment) => {
      const projectedImageAttachment =
        attachment.kind === "image"
          ? projectAgentAttachmentToComposerImageAttachment(attachment)
          : null;
      return {
        id: attachment.id,
        kind: attachment.kind,
        referenceId: attachment.referenceId ?? null,
        mediaId: attachment.mediaId ?? null,
        text: attachment.text ?? null,
        previewStoragePath: attachment.previewStoragePath ?? null,
        fullStoragePath: attachment.fullStoragePath ?? null,
        referenceUrl: attachment.referenceUrl ?? null,
        referenceRenderUrl: attachment.referenceRenderUrl ?? null,
        imageUrl: projectedImageAttachment?.preview.url ?? attachment.imageUrl ?? null,
        imageFallbackUrls:
          projectedImageAttachment?.preview.candidates.slice(1) ?? attachment.imageFallbackUrls,
        aspect: attachment.aspect ?? null,
        deliveryStatus: attachment.deliveryStatus,
        deliveryError: attachment.deliveryError ?? null,
      };
    });
  return {
    id: message.id ?? null,
    role: message.role,
    content: message.content,
    ...(typeof message.outputPrompt === "string" || message.outputPrompt === null
      ? { outputPrompt: message.outputPrompt }
      : {}),
    ...(typeof message.canUseAsPrompt === "boolean"
      ? { canUseAsPrompt: message.canUseAsPrompt }
      : {}),
    ...(message.outcomeClass ? { outcomeClass: message.outcomeClass } : {}),
    ...(message.reasonCode ? { reasonCode: message.reasonCode } : {}),
    ...(message.decision ? { decision: message.decision } : {}),
    ...(attachments?.length ? { attachments } : {}),
  };
};

/**
 * Returns the distinct linked prompt-reference ids from staged attachments.
 */
export const resolveLinkedPromptReferenceIds = (
  attachments: AgentMessage["attachments"] = []
): string[] =>
  Array.from(
    new Set(
      attachments
        .map((attachment) => attachment.referenceId)
        .filter((referenceId): referenceId is string => Boolean(referenceId))
    )
  );
