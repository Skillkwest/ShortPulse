import type { AgentAttachment } from "../../../../prefabs/agent";
import {
  isEphemeralLocalImageAttachment,
  resolveEphemeralLocalImageModelUrl,
} from "../../logic/ephemeralComposerImage";
import {
  recordCreateWorkflowEvent,
  summarizeCreateWorkflowUrl,
} from "../../logic/createWorkflowDebug";

export const EPHEMERAL_IMAGE_SEND_MISSING_MESSAGE =
  "Could not read the attached image. Remove it and attach it again.";

export type SplitAgentImageAttachmentsResult = {
  imageAttachmentIds: string[];
  durableImageAttachments: AgentAttachment[];
  durableImageAttachmentIds: string[];
  ephemeralImageUrls: Map<string, string>;
  failedEphemeralImageIds: string[];
};

export const splitAgentImageAttachmentsForSend = (
  attachments: AgentAttachment[]
): SplitAgentImageAttachmentsResult => {
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
  const ephemeralImageUrls = new Map<string, string>();
  const failedEphemeralImageIds: string[] = [];
  const durableImageAttachments: AgentAttachment[] = [];

  imageAttachments.forEach((attachment) => {
    if (!isEphemeralLocalImageAttachment(attachment)) {
      durableImageAttachments.push(attachment);
      return;
    }
    const modelUrl = resolveEphemeralLocalImageModelUrl(attachment);
    if (!modelUrl) {
      failedEphemeralImageIds.push(attachment.id);
      recordCreateWorkflowEvent("ephemeral_image_send_missing_model_payload", {
        attachmentId: attachment.id,
      });
      return;
    }
    ephemeralImageUrls.set(attachment.id, modelUrl);
    recordCreateWorkflowEvent("ephemeral_image_send_ready", {
      attachmentId: attachment.id,
      url: summarizeCreateWorkflowUrl(modelUrl),
    });
  });

  return {
    imageAttachmentIds: imageAttachments.map((attachment) => attachment.id),
    durableImageAttachments,
    durableImageAttachmentIds: durableImageAttachments.map((attachment) => attachment.id),
    ephemeralImageUrls,
    failedEphemeralImageIds,
  };
};
