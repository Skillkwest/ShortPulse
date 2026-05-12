import React from "react";
import {
  formatPerfAuditDebugLine,
  isPerfAuditRuntimeEnabled,
} from "../../../features/ai-studio/logic/perfAuditDebug";

type AgentImageAttachmentPreviewProps = {
  src: string | null;
  alt?: string;
  debugLabel?: string | null;
};

export const AgentImageAttachmentPreview: React.FC<AgentImageAttachmentPreviewProps> = ({
  src,
  alt = "",
  debugLabel = null,
}) => {
  const showPerfAuditDebug = isPerfAuditRuntimeEnabled();
  const resolvedDebugLabel = debugLabel ?? formatPerfAuditDebugLine("chip", src);

  if (!src) {
    return (
      <>
        <div className="agent-attachment-card-media" aria-hidden="true" />
        {showPerfAuditDebug ? (
          <div
            aria-label={resolvedDebugLabel}
            style={{
              position: "absolute",
              left: 4,
              right: 4,
              bottom: 4,
              zIndex: 3,
              padding: "3px 4px",
              borderRadius: 4,
              background: "rgba(8, 11, 16, 0.88)",
              color: "#b9f3ff",
              fontSize: 8,
              lineHeight: 1.25,
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {resolvedDebugLabel}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="agent-attachment-card-media" />
      {showPerfAuditDebug ? (
        <div
          aria-label={resolvedDebugLabel}
          style={{
            position: "absolute",
            left: 4,
            right: 4,
            bottom: 4,
            zIndex: 3,
            padding: "3px 4px",
            borderRadius: 4,
            background: "rgba(8, 11, 16, 0.88)",
            color: "#b9f3ff",
            fontSize: 8,
            lineHeight: 1.25,
            fontFamily: "monospace",
            wordBreak: "break-all",
          }}
        >
          {resolvedDebugLabel}
        </div>
      ) : null}
    </>
  );
};
