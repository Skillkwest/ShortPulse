/**
 * Pure capacity planning for Create-agent composer attachments.
 * Replaces duplicate image references in place and rejects over-cap additions
 * without evicting attachments the user already selected.
 */
import type { AgentAttachment } from "../../../prefabs/agent";
import {
  AGENT_IMAGE_ATTACHMENT_MAX_ITEMS,
  AGENT_PROMPT_ATTACHMENT_MAX_ITEMS,
} from "../../../prefabs/agent/attachmentPolicy";

export type AgentAttachmentCapacityRejection = "image_limit" | "prompt_limit";

export type AgentAttachmentCapacityResult = {
  attachments: AgentAttachment[];
  accepted: boolean;
  replacedAttachment: AgentAttachment | null;
  rejection: AgentAttachmentCapacityRejection | null;
};

export const resolveAgentAttachmentSignature = (attachment: AgentAttachment): string =>
  attachment.referenceId
    ? `${attachment.kind}:reference:${attachment.referenceId}`
    : attachment.mediaId
      ? `${attachment.kind}:media:${attachment.mediaId}`
      : `${attachment.kind}:${attachment.imageUrl ?? attachment.text ?? attachment.id}`;

/**
 * Plans one attachment insertion against the shared count policy.
 */
export const planAgentAttachmentInsertion = ({
  attachments,
  attachment,
}: {
  attachments: AgentAttachment[];
  attachment: AgentAttachment;
}): AgentAttachmentCapacityResult => {
  const signature = resolveAgentAttachmentSignature(attachment);
  const existingIndex = attachments.findIndex(
    (candidate) => resolveAgentAttachmentSignature(candidate) === signature
  );
  if (existingIndex >= 0) {
    if (attachment.kind !== "image") {
      return {
        attachments,
        accepted: true,
        replacedAttachment: null,
        rejection: null,
      };
    }
    const existingAttachment = attachments[existingIndex];
    return {
      attachments: attachments.map((candidate, index) =>
        index === existingIndex
          ? {
              ...existingAttachment,
              ...attachment,
              id: existingAttachment.id,
            }
          : candidate
      ),
      accepted: true,
      replacedAttachment: existingAttachment,
      rejection: null,
    };
  }

  const imageCount = attachments.filter((candidate) => candidate.kind === "image").length;
  if (attachment.kind === "image" && imageCount >= AGENT_IMAGE_ATTACHMENT_MAX_ITEMS) {
    return {
      attachments,
      accepted: false,
      replacedAttachment: null,
      rejection: "image_limit",
    };
  }

  const promptCount = attachments.filter((candidate) => candidate.kind === "prompt").length;
  if (attachment.kind === "prompt" && promptCount >= AGENT_PROMPT_ATTACHMENT_MAX_ITEMS) {
    return {
      attachments,
      accepted: false,
      replacedAttachment: null,
      rejection: "prompt_limit",
    };
  }

  return {
    attachments: [...attachments, attachment],
    accepted: true,
    replacedAttachment: null,
    rejection: null,
  };
};
