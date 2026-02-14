import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { randomId } from "../logic/ids";
import { extractDragDropPayload } from "../utils/dragDrop";
import type { StudioOutput } from "../types";
import type { AgentAttachment, AgentAttachmentDeliveryStatus } from "../../../prefabs/agent";

const MAX_AGENT_ATTACHMENTS = 10;
const MAX_AGENT_IMAGE_ATTACHMENTS = 3;

const attachmentSignature = (attachment: AgentAttachment) =>
  attachment.referenceId
    ? `${attachment.kind}:${attachment.referenceId}`
    : `${attachment.kind}:${attachment.imageUrl ?? attachment.text ?? attachment.id}`;

const isCurrentDocumentUrl = (value: string) => {
  if (typeof window === "undefined") return false;
  try {
    const current = new URL(window.location.href);
    const candidate = new URL(value, window.location.href);
    return (
      candidate.origin === current.origin &&
      candidate.pathname === current.pathname &&
      candidate.search === current.search
    );
  } catch {
    return false;
  }
};

const normalizeAttachmentImageUrl = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isCurrentDocumentUrl(trimmed)) return null;
  return trimmed;
};

type UseAiStudioAgentComposerParams = {
  agentSessionEnabled: boolean;
  ensureAgentSession: () => void;
  outputs: StudioOutput[];
  resolvePreviewUrlById: (rows: StudioOutput[], outputId: string) => string | null;
};

export const useAiStudioAgentComposer = ({
  agentSessionEnabled,
  ensureAgentSession,
  outputs,
  resolvePreviewUrlById,
}: UseAiStudioAgentComposerParams) => {
  const [agentInput, setAgentInput] = useState("");
  const [agentAttachmentError, setAgentAttachmentError] = useState<string | null>(null);
  const [agentAttachments, setAgentAttachments] = useState<AgentAttachment[]>([]);
  const [isAgentDropActive, setIsAgentDropActive] = useState(false);
  const agentDropDepthRef = useRef(0);
  const describedAgentImageCacheRef = useRef<Map<string, string>>(new Map());

  const linkedPromptReferenceIds = useMemo(
    () =>
      Array.from(
        new Set(
          agentAttachments
            .filter((attachment) => attachment.kind === "prompt" && attachment.referenceId)
            .map((attachment) => attachment.referenceId as string)
        )
      ),
    [agentAttachments]
  );

  const isSupportedAttachmentDrag = useCallback((event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types ?? []);
    return (
      types.includes("Files") ||
      types.includes("text/reference-id") ||
      types.includes("text/reference-url") ||
      types.includes("text/uri-list") ||
      types.includes("image/url") ||
      types.includes("text/prompt") ||
      types.includes("text/plain")
    );
  }, []);

  const markAttachmentDelivery = useCallback(
    (
      ids: string[],
      status: AgentAttachmentDeliveryStatus,
      deliveryError?: string | null | ((attachment: AgentAttachment) => string | null)
    ) => {
      if (!ids.length) return;
      setAgentAttachments((prev) =>
        prev.map((attachment) => {
          if (!ids.includes(attachment.id)) return attachment;
          const resolvedError =
            typeof deliveryError === "function" ? deliveryError(attachment) : deliveryError;
          return {
            ...attachment,
            deliveryStatus: attachment.kind === "prompt" ? "ready" : status,
            deliveryError: attachment.kind === "prompt" ? null : (resolvedError ?? null),
          };
        })
      );
    },
    []
  );

  const insertAttachment = useCallback((nextAttachment: AgentAttachment) => {
    setAgentAttachments((prev) => {
      const signature = attachmentSignature(nextAttachment);
      if (prev.some((item) => attachmentSignature(item) === signature)) {
        return prev;
      }
      const normalizedAttachment: AgentAttachment = {
        ...nextAttachment,
        deliveryStatus:
          nextAttachment.kind === "prompt" ? "ready" : (nextAttachment.deliveryStatus ?? "pending"),
        deliveryError:
          nextAttachment.kind === "prompt" ? null : (nextAttachment.deliveryError ?? null),
      };
      let next = [...prev, normalizedAttachment];
      if (nextAttachment.kind === "image") {
        const imageCount = next.filter((item) => item.kind === "image").length;
        if (imageCount > MAX_AGENT_IMAGE_ATTACHMENTS) {
          const oldestImageIndex = next.findIndex((item) => item.kind === "image");
          if (oldestImageIndex >= 0) {
            next = next.filter((_, index) => index !== oldestImageIndex);
          }
        }
      }
      if (next.length > MAX_AGENT_ATTACHMENTS) {
        next = next.slice(next.length - MAX_AGENT_ATTACHMENTS);
      }
      return next;
    });
    setAgentAttachmentError(null);
  }, []);

  const handleAgentAttachmentDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isSupportedAttachmentDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    [isSupportedAttachmentDrag]
  );

  const handleAgentAttachmentDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!isSupportedAttachmentDrag(event)) return;
      event.preventDefault();
      agentDropDepthRef.current += 1;
      setIsAgentDropActive(true);
    },
    [isSupportedAttachmentDrag]
  );

  const handleAgentAttachmentDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    agentDropDepthRef.current = Math.max(0, agentDropDepthRef.current - 1);
    if (agentDropDepthRef.current === 0) {
      setIsAgentDropActive(false);
    }
  }, []);

  const handleAgentAttachmentDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      agentDropDepthRef.current = 0;
      setIsAgentDropActive(false);
      const payload = extractDragDropPayload(event.dataTransfer);
      const droppedReferenceId = payload.referenceId ?? null;
      const matchedOutput = droppedReferenceId
        ? (outputs.find((item) => item.id === droppedReferenceId) ?? null)
        : null;
      const resolvedPreviewUrl = droppedReferenceId
        ? resolvePreviewUrlById(outputs, droppedReferenceId)
        : null;
      const transferReferenceUrl = event.dataTransfer.getData("text/reference-url") || null;
      const normalizedPromptText =
        payload.promptText?.trim() ||
        matchedOutput?.prompt?.trim() ||
        matchedOutput?.previewText?.trim() ||
        null;
      const normalizedImageUrl = normalizeAttachmentImageUrl(
        resolvedPreviewUrl ||
          matchedOutput?.previewUrl ||
          transferReferenceUrl ||
          payload.imageUrl ||
          null
      );

      if (!normalizedImageUrl && !normalizedPromptText) return;
      if (!agentSessionEnabled) {
        ensureAgentSession();
      }
      setAgentAttachmentError(null);

      if (normalizedImageUrl) {
        insertAttachment({
          id: randomId(),
          kind: "image",
          referenceId: droppedReferenceId,
          imageUrl: normalizedImageUrl,
          text: normalizedPromptText,
          aspect: matchedOutput?.aspect ?? null,
        });
        return;
      }

      if (normalizedPromptText) {
        insertAttachment({
          id: randomId(),
          kind: "prompt",
          referenceId: droppedReferenceId,
          text: normalizedPromptText,
          aspect: matchedOutput?.aspect ?? null,
        });
      }
    },
    [agentSessionEnabled, ensureAgentSession, insertAttachment, outputs, resolvePreviewUrlById]
  );

  const handleRemoveAgentAttachment = useCallback((id: string) => {
    setAgentAttachmentError(null);
    setAgentAttachments((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearAgentAttachments = useCallback(() => {
    setAgentAttachmentError(null);
    setAgentAttachments([]);
  }, []);

  const handleAgentInputChange = useCallback(
    (value: string) => {
      if (agentAttachmentError) {
        setAgentAttachmentError(null);
      }
      setAgentInput(value);
    },
    [agentAttachmentError]
  );

  const resetAgentComposer = useCallback(() => {
    setAgentAttachmentError(null);
    setAgentInput("");
    setAgentAttachments([]);
    setIsAgentDropActive(false);
    agentDropDepthRef.current = 0;
  }, []);

  return {
    agentInput,
    setAgentInput,
    handleAgentInputChange,
    agentAttachmentError,
    setAgentAttachmentError,
    agentAttachments,
    setAgentAttachments,
    linkedPromptReferenceIds,
    isAgentDropActive,
    describedAgentImageCacheRef,
    markAttachmentDelivery,
    handleAgentAttachmentDragOver,
    handleAgentAttachmentDragEnter,
    handleAgentAttachmentDragLeave,
    handleAgentAttachmentDrop,
    handleRemoveAgentAttachment,
    handleClearAgentAttachments,
    resetAgentComposer,
  };
};
