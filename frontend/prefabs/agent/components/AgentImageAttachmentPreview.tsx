import React from "react";
import type { AgentAttachment } from "../types";
import {
  formatPerfAuditDebugLine,
  isPerfAuditRuntimeEnabled,
} from "../../../features/ai-studio/logic/perfAuditDebug";
import { resolveAgentAttachmentPreviewUrl } from "../../../features/ai-studio/logic/agentAttachmentImage";

type AgentImageAttachmentPreviewProps = {
  src: string | null;
  sources?: string[] | null;
  repairAttachment?: Pick<
    AgentAttachment,
    "previewStoragePath" | "fullStoragePath" | "referenceRenderUrl" | "referenceUrl" | "imageUrl"
  > | null;
  alt?: string;
  debugLabel?: string | null;
};

export const AgentImageAttachmentPreview: React.FC<AgentImageAttachmentPreviewProps> = ({
  src,
  sources = null,
  repairAttachment = null,
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
  const repairAttachmentKey = React.useMemo(
    () =>
      [
        repairAttachment?.previewStoragePath ?? "",
        repairAttachment?.fullStoragePath ?? "",
        repairAttachment?.referenceRenderUrl ?? "",
        repairAttachment?.referenceUrl ?? "",
        repairAttachment?.imageUrl ?? "",
      ].join("\n"),
    [repairAttachment]
  );
  const [activeSourceIndex, setActiveSourceIndex] = React.useState(0);
  const [resolvedRepairSource, setResolvedRepairSource] = React.useState<string | null>(null);
  const [repairAttempted, setRepairAttempted] = React.useState(false);
  const repairRequestIdRef = React.useRef(0);

  React.useEffect(() => {
    setActiveSourceIndex(0);
    setResolvedRepairSource(null);
    setRepairAttempted(false);
    repairRequestIdRef.current += 1;
  }, [candidateSourcesKey, repairAttachmentKey]);

  const allSources = React.useMemo(
    () =>
      Array.from(
        new Set(
          [...candidateSources, resolvedRepairSource].filter(
            (candidate): candidate is string =>
              typeof candidate === "string" && candidate.length > 0
          )
        )
      ),
    [candidateSources, resolvedRepairSource]
  );

  const attemptIdentityRepair = React.useCallback(async () => {
    if (!repairAttachment || repairAttempted) return;
    setRepairAttempted(true);
    const requestId = repairRequestIdRef.current + 1;
    repairRequestIdRef.current = requestId;
    const repairedSource = await resolveAgentAttachmentPreviewUrl(repairAttachment).catch(
      () => null
    );
    if (repairRequestIdRef.current !== requestId || !repairedSource) return;
    setResolvedRepairSource((current) => current ?? repairedSource);
    setActiveSourceIndex((currentIndex) =>
      currentIndex >= candidateSources.length - 1 ? candidateSources.length : currentIndex
    );
  }, [candidateSources.length, repairAttachment, repairAttempted]);

  React.useEffect(() => {
    if (!allSources.length && repairAttachment && !repairAttempted) {
      void attemptIdentityRepair();
    }
  }, [allSources.length, attemptIdentityRepair, repairAttachment, repairAttempted]);

  const resolvedSrc = allSources[activeSourceIndex] ?? null;
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
          setActiveSourceIndex((currentIndex) => {
            if (currentIndex < allSources.length - 1) {
              return currentIndex + 1;
            }
            if (repairAttachment && !repairAttempted) {
              void attemptIdentityRepair();
            }
            return currentIndex;
          });
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
