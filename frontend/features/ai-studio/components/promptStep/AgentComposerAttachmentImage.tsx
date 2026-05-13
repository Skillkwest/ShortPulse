import React from "react";
import type { AgentAttachment } from "../../../../prefabs/agent/types";
import { AgentImageAttachmentPreview } from "../../../../prefabs/agent/components/AgentImageAttachmentPreview";
import { projectAgentAttachmentToComposerImageAttachment } from "../../logic/composerImageAttachment";
import { formatPerfAuditDebugLine } from "../../logic/perfAuditDebug";

type AgentComposerAttachmentImageProps = {
  attachment: AgentAttachment;
};

export const AgentComposerAttachmentImage: React.FC<AgentComposerAttachmentImageProps> = ({
  attachment,
}) => {
  const projectedAttachment = React.useMemo(
    () => projectAgentAttachmentToComposerImageAttachment(attachment),
    [attachment]
  );
  const debugLabel = React.useMemo(() => {
    if (!projectedAttachment) return formatPerfAuditDebugLine("chip", null);
    return [
      formatPerfAuditDebugLine("chip", projectedAttachment.preview.url),
      `src:${projectedAttachment.preview.source}`,
    ].join(" | ");
  }, [projectedAttachment]);

  return (
    <AgentImageAttachmentPreview
      src={projectedAttachment?.preview.url ?? null}
      sources={projectedAttachment?.preview.candidates ?? null}
      debugLabel={debugLabel}
    />
  );
};
