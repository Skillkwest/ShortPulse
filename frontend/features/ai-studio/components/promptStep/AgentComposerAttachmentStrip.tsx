/**
 * Shared Standard/Pulse Create composer attachment strip.
 * Keeps dense attachment layout, status semantics, and removal labels aligned.
 */
import React from "react";
import type { AgentAttachment } from "../../../../prefabs/agent";
import { AgentComposerAttachmentImage } from "./AgentComposerAttachmentImage";

type AgentComposerAttachmentStripProps = {
  attachments: AgentAttachment[];
  onRemoveAttachment?: (attachmentId: string) => void;
};

export const AgentComposerAttachmentStrip: React.FC<AgentComposerAttachmentStripProps> = ({
  attachments,
  onRemoveAttachment,
}) => {
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");
  const readyImages = imageAttachments.filter(
    (attachment) => attachment.deliveryStatus === "ready"
  ).length;
  const preparingImages = imageAttachments.filter(
    (attachment) =>
      attachment.deliveryStatus === "preparing" || attachment.deliveryStatus === "pending"
  ).length;
  const failedImages = imageAttachments.filter(
    (attachment) => attachment.deliveryStatus === "failed"
  ).length;

  return (
    <div
      className="agent-composer-attachment-strip"
      aria-label="Attached references for next message"
    >
      <span className="sr-only" role="status" aria-live="polite">
        {`${readyImages} of ${imageAttachments.length} images ready, ${preparingImages} preparing, ${failedImages} failed.`}
      </span>
      <div className="agent-attachment-card-list agent-attachment-card-list--composer" role="list">
        {attachments.map((attachment, index) => {
          const isLinkedPromptRef = attachment.kind === "prompt" && Boolean(attachment.referenceId);
          const attachmentStatusClass =
            attachment.kind === "image" ? `is-${attachment.deliveryStatus ?? "pending"}` : "";
          return (
            <div
              key={attachment.id}
              role="listitem"
              className={`agent-attachment-card agent-attachment-card--composer agent-attachment-card--${attachment.kind} ${isLinkedPromptRef ? "is-linked-prompt-ref" : ""} ${attachmentStatusClass}`}
            >
              {attachment.kind === "image" ? (
                <AgentComposerAttachmentImage attachment={attachment} />
              ) : (
                <div className="agent-attachment-card-prompt" aria-hidden="true">
                  <span className="agent-attachment-card-prompt-marker">T</span>
                </div>
              )}
              {isLinkedPromptRef ? (
                <span className="agent-attachment-link-dot" aria-hidden="true" />
              ) : null}
              {onRemoveAttachment ? (
                <button
                  type="button"
                  className="agent-attachment-remove agent-attachment-remove--card"
                  aria-label={`Remove ${attachment.kind} ${index + 1} of ${attachments.length}`}
                  onClick={() => onRemoveAttachment(attachment.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};
