/**
 * Attachment context projection for AI Studio agent sends.
 * Merges attachment-derived references/media into the base agent context.
 */
import type {
  AgentAttachment,
  AgentContext,
  AgentMediaPreview,
  AgentReferenceSummary,
} from "../../../../prefabs/agent";

const MAX_AGENT_IMAGE_ATTACHMENTS = 3;
const MAX_AGENT_REFERENCE_ATTACHMENTS = 24;
const MAX_SELECTED_REFERENCE_IDS = 8;

/**
 * Merge attachment metadata and prepared media URLs into the agent context.
 */
export const mergeAttachmentContext = ({
  baseContext,
  attachments,
  preparedImageUrls,
}: {
  baseContext: AgentContext;
  attachments: AgentAttachment[];
  preparedImageUrls: Map<string, string>;
}): AgentContext => {
  if (!attachments.length) return baseContext;

  const attachmentRefs: AgentReferenceSummary[] = [];
  const attachmentMedia: AgentMediaPreview[] = [];
  const selectedAttachmentIds: string[] = [];

  attachments.forEach((attachment) => {
    const referenceId = attachment.referenceId ?? attachment.id;
    const attachmentText = attachment.text?.trim() || null;
    if (attachment.referenceId) {
      selectedAttachmentIds.push(attachment.referenceId);
    }
    if (attachment.kind === "image") {
      attachmentRefs.push({
        id: referenceId,
        kind: "image",
        promptSnippet: attachmentText,
        aspect: attachment.aspect ?? null,
        caption: attachmentText,
      });
      const safeImageUrl = preparedImageUrls.get(attachment.id);
      if (safeImageUrl) {
        attachmentMedia.push({
          id: referenceId,
          kind: "image",
          url: safeImageUrl,
          thumbnailAlt: attachmentText,
        });
      }
      return;
    }
    attachmentRefs.push({
      id: referenceId,
      kind: "prompt",
      promptSnippet: attachmentText,
      aspect: attachment.aspect ?? null,
      caption: null,
    });
  });

  const dedupedRefs = [...attachmentRefs, ...(baseContext.references ?? [])].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.id === item.id && candidate.kind === item.kind) ===
      index
  );
  const dedupedMedia = [...attachmentMedia, ...(baseContext.media ?? [])].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.id === item.id && candidate.url === item.url) === index
  );
  const mergedSelectedReferenceIds = Array.from(
    new Set([...(baseContext.selectedReferenceIds ?? []), ...selectedAttachmentIds])
  ).slice(0, MAX_SELECTED_REFERENCE_IDS);
  const hasImageAttachments = attachmentMedia.length > 0;
  const hasCanonicalPromptContext = Boolean(
    baseContext.activePrompt?.trim() || baseContext.lastAssistantMessage?.trim()
  );
  const nextFocusedSource = hasImageAttachments
    ? "image"
    : hasCanonicalPromptContext
      ? (baseContext.focusedSource ?? "agent-output")
      : "prompt";

  return {
    ...baseContext,
    references: dedupedRefs.slice(0, MAX_AGENT_REFERENCE_ATTACHMENTS),
    media: dedupedMedia.slice(0, MAX_AGENT_IMAGE_ATTACHMENTS),
    selectedReferenceIds: mergedSelectedReferenceIds,
    focusedSource: nextFocusedSource,
    focusedReferenceId:
      mergedSelectedReferenceIds.length === 1 ? mergedSelectedReferenceIds[0] : null,
  };
};
