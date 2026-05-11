/**
 * Composer attachment image preview with ordered fallback URL recovery.
 * Used by Standard and Pulse composer attachment strips.
 */
import React from "react";
import type { AgentAttachment } from "../../../../prefabs/agent/types";
import {
  buildAgentAttachmentImageCandidates,
  resolveAgentAttachmentPreviewUrl,
} from "../../logic/agentAttachmentImage";

type AgentComposerAttachmentImageProps = {
  attachment: AgentAttachment;
};

export const AgentComposerAttachmentImage: React.FC<AgentComposerAttachmentImageProps> = ({
  attachment,
}) => {
  const attachmentImageKey = React.useMemo(
    () =>
      [
        attachment.id,
        attachment.imageUrl ?? "",
        ...(attachment.imageFallbackUrls ?? []),
        attachment.referenceRenderUrl ?? "",
        attachment.referenceUrl ?? "",
        attachment.previewStoragePath ?? "",
        attachment.fullStoragePath ?? "",
        attachment.mediaId ?? "",
        attachment.referenceId ?? "",
      ].join("|"),
    [
      attachment.fullStoragePath,
      attachment.id,
      attachment.imageFallbackUrls,
      attachment.imageUrl,
      attachment.mediaId,
      attachment.previewStoragePath,
      attachment.referenceId,
      attachment.referenceRenderUrl,
      attachment.referenceUrl,
    ]
  );
  const [preferredSrc, setPreferredSrc] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const baseCandidateUrls = React.useMemo(
    () => buildAgentAttachmentImageCandidates(attachment),
    [attachment]
  );

  const candidateUrls = React.useMemo(
    () =>
      Array.from(
        new Set(
          [...baseCandidateUrls, preferredSrc].filter((candidate): candidate is string =>
            Boolean(candidate)
          )
        )
      ),
    [baseCandidateUrls, preferredSrc]
  );

  React.useEffect(() => {
    setPreferredSrc(null);
    setActiveIndex(0);
  }, [attachmentImageKey]);

  React.useEffect(() => {
    let isActive = true;
    void resolveAgentAttachmentPreviewUrl({
      previewStoragePath: attachment.previewStoragePath ?? null,
      fullStoragePath: attachment.fullStoragePath ?? null,
      referenceRenderUrl: attachment.referenceRenderUrl ?? null,
      referenceUrl: attachment.referenceUrl ?? null,
      imageUrl: attachment.imageUrl ?? null,
    }).then((resolvedUrl) => {
      if (!isActive || !resolvedUrl) return;
      setPreferredSrc((currentUrl) => {
        if (baseCandidateUrls.includes(resolvedUrl)) {
          return currentUrl === resolvedUrl ? currentUrl : null;
        }
        return currentUrl === resolvedUrl ? currentUrl : resolvedUrl;
      });
    });
    return () => {
      isActive = false;
    };
  }, [
    baseCandidateUrls,
    attachment.fullStoragePath,
    attachment.imageUrl,
    attachment.previewStoragePath,
    attachment.referenceRenderUrl,
    attachment.referenceUrl,
  ]);

  const handleError = React.useCallback(() => {
    setActiveIndex((currentIndex) =>
      currentIndex + 1 < candidateUrls.length ? currentIndex + 1 : currentIndex
    );
  }, [candidateUrls.length]);

  const activeSrc = candidateUrls[activeIndex] ?? null;

  if (!activeSrc) {
    return <div className="agent-attachment-card-media" aria-hidden="true" />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={activeSrc} alt="" className="agent-attachment-card-media" onError={handleError} />
  );
};
