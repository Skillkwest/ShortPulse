import React from "react";
import {
  formatPerfAuditDebugLine,
  isPerfAuditRuntimeEnabled,
} from "../../../features/ai-studio/logic/perfAuditDebug";

type AgentImageAttachmentPreviewProps = {
  src: string | null;
  sources?: string[] | null;
  alt?: string;
  debugLabel?: string | null;
};

export const AgentImageAttachmentPreview: React.FC<AgentImageAttachmentPreviewProps> = ({
  src,
  sources = null,
  alt = "",
  debugLabel = null,
}) => {
  const showPerfAuditDebug = isPerfAuditRuntimeEnabled();
  const candidateSources = React.useMemo(
    () =>
      Array.from(
        new Set(
          (sources?.length ? sources : [src]).filter(
            (candidate): candidate is string =>
              typeof candidate === "string" && candidate.length > 0
          )
        )
      ),
    [sources, src]
  );
  const candidateSourcesKey = React.useMemo(() => candidateSources.join("\n"), [candidateSources]);
  const [activeSourceIndex, setActiveSourceIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveSourceIndex(0);
  }, [candidateSourcesKey]);

  const resolvedSrc = candidateSources[activeSourceIndex] ?? null;
  const resolvedDebugLabel = debugLabel ?? formatPerfAuditDebugLine("chip", resolvedSrc);

  if (!resolvedSrc) {
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
      <img
        src={resolvedSrc}
        alt={alt}
        className="agent-attachment-card-media"
        onError={() => {
          setActiveSourceIndex((currentIndex) =>
            currentIndex < candidateSources.length - 1 ? currentIndex + 1 : currentIndex
          );
        }}
      />
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
