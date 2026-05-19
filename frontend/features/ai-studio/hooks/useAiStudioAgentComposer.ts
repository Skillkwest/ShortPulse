import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { randomId } from "../logic/ids";
import {
  buildAgentAttachmentImageCandidates,
  normalizeAttachmentImageUrl,
  resolveAgentAttachmentPreviewUrl,
} from "../logic/agentAttachmentImage";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  createEphemeralComposerImageData,
  EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE,
  EPHEMERAL_IMAGE_UNREADABLE_MESSAGE,
  isEphemeralLocalImageAttachment,
} from "../logic/ephemeralComposerImage";
import { isSafeAgentImageMediaUrl } from "../../../prefabs/agent/mediaUrlPolicy";
import {
  recordCreateWorkflowEvent,
  setCreateWorkflowAttachmentSnapshot,
  summarizeCreateWorkflowAttachment,
} from "../logic/createWorkflowDebug";
import type { ResolveInternalReferenceDrop } from "../logic/referenceSource/internalReferenceSource";
import {
  extractComposerImageDropPayload,
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  REFERENCE_TRANSFER_RENDER_URL_TYPE,
  looksLikeAudioUrl,
  looksLikeImageUrl,
  looksLikeVideoUrl,
  normalizeReferenceTransferUrlCandidate,
  resolveReferenceTransferUrl,
} from "../utils/dragDrop";
import {
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../lib/internalReferenceDragSession";
import type { StudioOutput } from "../types";
import type { AgentAttachment, AgentAttachmentDeliveryStatus } from "../../../prefabs/agent";

const MAX_AGENT_ATTACHMENTS = 10;
const MAX_AGENT_IMAGE_ATTACHMENTS = 3;
const VIDEO_ATTACHMENT_REJECTION_MESSAGE = "This is a video. Try adding an image instead.";
const NON_IMAGE_ATTACHMENT_REJECTION_MESSAGE =
  "This reference is not an image. Try adding an image instead.";
const INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE =
  "Could not attach that image. Try dragging it again or add it from Media Library.";

const attachmentSignature = (attachment: AgentAttachment) =>
  attachment.referenceId
    ? `${attachment.kind}:reference:${attachment.referenceId}`
    : attachment.mediaId
      ? `${attachment.kind}:media:${attachment.mediaId}`
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

const normalizeDroppedImageCandidate = (value: string | null | undefined) => {
  const normalized = normalizeAttachmentImageUrl(value);
  if (!normalized) return null;
  if (isCurrentDocumentUrl(normalized)) return null;
  if (!looksLikeImageUrl(normalized) || looksLikeVideoUrl(normalized)) return null;
  return normalized;
};

const normalizeDurableDroppedImageCandidate = (value: string | null | undefined) => {
  const normalized = normalizeDroppedImageCandidate(value);
  if (!normalized) return null;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return null;
  return normalized;
};

const resolveDroppedImageUrls = (candidates: Array<string | null | undefined>) => {
  return Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeDroppedImageCandidate(candidate))
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );
};

const resolveDurableDroppedImageUrls = (candidates: Array<string | null | undefined>) => {
  return Array.from(
    new Set(
      candidates
        .map((candidate) => normalizeDurableDroppedImageCandidate(candidate))
        .filter((candidate): candidate is string => Boolean(candidate))
    )
  );
};

const buildResolvedInternalImageUrls = (candidates: Array<string | null | undefined>) =>
  buildAgentAttachmentImageCandidates({
    imageUrl: candidates[0] ?? null,
    imageFallbackUrls: resolveDroppedImageUrls(candidates.slice(1)),
    referenceRenderUrl: null,
    referenceUrl: null,
  });

const isLocalInlineImageUrl = (value: string | null | undefined) =>
  Boolean(value && (value.startsWith("blob:") || value.startsWith("data:image/")));

type ComposerDropSnapshot = {
  transferTypes: string[];
  files: File[];
  internalReferenceDragSessionToken: string;
  composerImageDropSessionToken: string;
  composerImageDropPayload: string;
  referenceOrigin: string;
  referenceVersion: string;
  referenceId: string;
  referenceOutputId: string;
  referenceMediaId: string;
  referenceMediaKind: string;
  referencePreviewStoragePath: string;
  referenceFullStoragePath: string;
  referenceImageIndex: string;
  referenceWidth: string;
  referenceHeight: string;
  referenceSourceSurface: string;
  referenceUrl: string;
  referenceRenderUrl: string;
  imageUrl: string;
  plainText: string;
  uriList: string;
};

const captureComposerDropSnapshot = (transfer: DataTransfer): ComposerDropSnapshot => ({
  transferTypes: Array.from(transfer.types ?? []),
  files: Array.from(transfer.files ?? []),
  internalReferenceDragSessionToken:
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TYPE) ||
    transfer.getData(INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE),
  composerImageDropSessionToken:
    transfer.getData(COMPOSER_IMAGE_DROP_SESSION_TYPE) ||
    transfer.getData(COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE),
  composerImageDropPayload:
    transfer.getData(COMPOSER_IMAGE_DROP_PAYLOAD_TYPE) ||
    transfer.getData(COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE),
  referenceOrigin: transfer.getData("text/reference-origin"),
  referenceVersion: transfer.getData("text/reference-version"),
  referenceId: transfer.getData("text/reference-id"),
  referenceOutputId: transfer.getData("text/reference-output-id"),
  referenceMediaId: transfer.getData("text/reference-media-id"),
  referenceMediaKind: transfer.getData("text/reference-media-kind"),
  referencePreviewStoragePath: transfer.getData("text/reference-preview-storage-path"),
  referenceFullStoragePath: transfer.getData("text/reference-full-storage-path"),
  referenceImageIndex: transfer.getData("text/reference-image-index"),
  referenceWidth: transfer.getData("text/reference-width"),
  referenceHeight: transfer.getData("text/reference-height"),
  referenceSourceSurface: transfer.getData("text/reference-source-surface"),
  referenceUrl: transfer.getData("text/reference-url"),
  referenceRenderUrl: transfer.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE),
  imageUrl: transfer.getData("image/url"),
  plainText: transfer.getData("text/plain"),
  uriList: transfer.getData("text/uri-list"),
});

const buildComposerDropSnapshotTransfer = (snapshot: ComposerDropSnapshot): DataTransfer =>
  ({
    types: snapshot.transferTypes,
    files: snapshot.files,
    getData: (type: string) => {
      switch (type) {
        case INTERNAL_REFERENCE_DRAG_SESSION_TYPE:
        case INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE:
          return snapshot.internalReferenceDragSessionToken;
        case COMPOSER_IMAGE_DROP_SESSION_TYPE:
        case COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE:
          return snapshot.composerImageDropSessionToken;
        case COMPOSER_IMAGE_DROP_PAYLOAD_TYPE:
        case COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE:
          return snapshot.composerImageDropPayload;
        case "text/reference-origin":
          return snapshot.referenceOrigin;
        case "text/reference-version":
          return snapshot.referenceVersion;
        case "text/reference-id":
          return snapshot.referenceId;
        case "text/reference-output-id":
          return snapshot.referenceOutputId;
        case "text/reference-media-id":
          return snapshot.referenceMediaId;
        case "text/reference-media-kind":
          return snapshot.referenceMediaKind;
        case "text/reference-preview-storage-path":
          return snapshot.referencePreviewStoragePath;
        case "text/reference-full-storage-path":
          return snapshot.referenceFullStoragePath;
        case "text/reference-image-index":
          return snapshot.referenceImageIndex;
        case "text/reference-width":
          return snapshot.referenceWidth;
        case "text/reference-height":
          return snapshot.referenceHeight;
        case "text/reference-source-surface":
          return snapshot.referenceSourceSurface;
        case "text/reference-url":
          return snapshot.referenceUrl;
        case REFERENCE_TRANSFER_RENDER_URL_TYPE:
          return snapshot.referenceRenderUrl;
        case "image/url":
          return snapshot.imageUrl;
        case "text/plain":
          return snapshot.plainText;
        case "text/uri-list":
          return snapshot.uriList;
        default:
          return "";
      }
    },
  }) as unknown as DataTransfer;

const hasSnapshotReferenceImageHints = (snapshot: ComposerDropSnapshot): boolean => {
  const normalizedTransferTypes = snapshot.transferTypes.map((type) => type.trim().toLowerCase());
  const normalizedImageUrl = normalizeDroppedImageCandidate(snapshot.imageUrl);
  const normalizedReferenceUrl = normalizeDroppedImageCandidate(snapshot.referenceUrl);
  const normalizedRenderUrl = normalizeDroppedImageCandidate(snapshot.referenceRenderUrl);
  const normalizedUriUrl = normalizeDroppedImageCandidate(snapshot.uriList);
  const normalizedPlainTextUrl = normalizeDroppedImageCandidate(snapshot.plainText);
  const hasReferenceTransferTypeHints = normalizedTransferTypes.some(
    (type) =>
      type === COMPOSER_IMAGE_DROP_SESSION_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE.toLowerCase() ||
      type === INTERNAL_REFERENCE_DRAG_SESSION_TYPE.toLowerCase() ||
      type === INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_PAYLOAD_TYPE.toLowerCase() ||
      type === COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE.toLowerCase() ||
      type === "text/reference-origin" ||
      type === "text/reference-id" ||
      type === "text/reference-output-id" ||
      type === "text/reference-media-id" ||
      type === "text/reference-source-surface" ||
      type === "text/reference-url" ||
      type === REFERENCE_TRANSFER_RENDER_URL_TYPE.toLowerCase() ||
      type === "image/url"
  );

  return Boolean(
    hasReferenceTransferTypeHints ||
    snapshot.referenceOrigin.trim() ||
    snapshot.referenceId.trim() ||
    snapshot.referenceOutputId.trim() ||
    snapshot.referenceMediaId.trim() ||
    snapshot.referenceSourceSurface.trim() ||
    normalizedImageUrl ||
    normalizedReferenceUrl ||
    normalizedRenderUrl ||
    normalizedUriUrl ||
    normalizedPlainTextUrl
  );
};

const readLocalInlineImageBlob = async (url: string): Promise<Blob | null> => {
  if (!isLocalInlineImageUrl(url)) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob instanceof Blob && blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
};

const resolveStorageBackedDropImageUrl = async ({
  previewStoragePath,
  fullStoragePath,
  referenceUrl,
}: {
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl?: string | null;
}): Promise<string | null> =>
  await resolveAgentAttachmentPreviewUrl({
    previewStoragePath: previewStoragePath ?? null,
    fullStoragePath: fullStoragePath ?? null,
    referenceRenderUrl: null,
    referenceUrl: referenceUrl ?? null,
    imageUrl: null,
    submissionImageUrl: null,
  }).catch(() => null);

const createEphemeralDropImageData = async ({
  sourceBlob,
  previewUrl,
  modelUrl,
}: {
  sourceBlob?: Blob | null;
  previewUrl?: string | null;
  modelUrl?: string | null;
}): Promise<{ previewUrl: string; modelUrl: string } | null> => {
  if (sourceBlob instanceof Blob && sourceBlob.size > 0) {
    const imageData = await createEphemeralComposerImageData(sourceBlob).catch(() => null);
    if (imageData) {
      return {
        previewUrl: imageData.previewDataUrl,
        modelUrl: imageData.modelDataUrl,
      };
    }
  }

  const normalizedPreviewUrl = normalizeDroppedImageCandidate(previewUrl);
  const normalizedModelUrl = normalizeDroppedImageCandidate(modelUrl) ?? normalizedPreviewUrl;
  const localModelBlob = normalizedModelUrl
    ? await readLocalInlineImageBlob(normalizedModelUrl)
    : null;
  if (localModelBlob) {
    const imageData = await createEphemeralComposerImageData(localModelBlob).catch(() => null);
    if (imageData) {
      return {
        previewUrl: imageData.previewDataUrl,
        modelUrl: imageData.modelDataUrl,
      };
    }
  }

  if (!isSafeAgentImageMediaUrl(normalizedModelUrl)) return null;
  return {
    previewUrl: normalizedPreviewUrl ?? normalizedModelUrl,
    modelUrl: normalizedModelUrl,
  };
};

const createEphemeralImageAttachment = async ({
  id,
  referenceId,
  mediaId,
  text,
  aspect,
  sourceBlob,
  previewUrl,
  modelUrl,
}: {
  id: string;
  referenceId?: string | null;
  mediaId?: string | null;
  text?: string | null;
  aspect?: string | null;
  sourceBlob?: Blob | null;
  previewUrl?: string | null;
  modelUrl?: string | null;
}): Promise<AgentAttachment | null> => {
  const imageData = await createEphemeralDropImageData({
    sourceBlob,
    previewUrl,
    modelUrl,
  });
  if (!imageData) return null;
  return {
    id,
    kind: "image",
    source: "ephemeral_local",
    referenceId: referenceId ?? null,
    mediaId: mediaId ?? null,
    referenceUrl: null,
    referenceRenderUrl: null,
    imageUrl: imageData.previewUrl,
    modelDataUrl: imageData.modelUrl,
    submissionImageUrl: null,
    imageFallbackUrls: [],
    text: text ?? null,
    aspect: aspect ?? null,
    deliveryStatus: "ready",
    deliveryError: null,
  };
};

type UseAiStudioAgentComposerParams = {
  agentSessionEnabled: boolean;
  ensureAgentSession: () => void;
  findOutputById: (outputId: string) => StudioOutput | null;
  resolveOutputPreviewUrlById: (outputId: string) => string | null;
  resolveInternalImageDropSource?: ResolveInternalReferenceDrop;
  maxImageAttachmentsPerDrop?: number;
};

type ResetAgentComposerOptions = {
  preserveInput?: boolean;
  preserveAttachments?: boolean;
};

export const useAiStudioAgentComposer = ({
  agentSessionEnabled,
  ensureAgentSession,
  findOutputById,
  resolveOutputPreviewUrlById,
  resolveInternalImageDropSource,
  maxImageAttachmentsPerDrop = 1,
}: UseAiStudioAgentComposerParams) => {
  const [agentInput, setAgentInput] = useState("");
  const [agentAttachmentError, setAgentAttachmentError] = useState<string | null>(null);
  const [agentAttachments, setAgentAttachments] = useState<AgentAttachment[]>([]);
  const [isAgentDropActive, setIsAgentDropActive] = useState(false);
  const agentDropDepthRef = useRef(0);

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

  useEffect(() => {
    setCreateWorkflowAttachmentSnapshot(
      agentAttachments.map((attachment) => summarizeCreateWorkflowAttachment(attachment))
    );
  }, [agentAttachments]);

  const isSupportedAttachmentDrag = useCallback((event: DragEvent<HTMLDivElement>) => {
    const types = Array.from(event.dataTransfer.types ?? []);
    return (
      types.includes("Files") ||
      types.includes(COMPOSER_IMAGE_DROP_SESSION_TYPE) ||
      types.includes(COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE) ||
      types.includes(COMPOSER_IMAGE_DROP_PAYLOAD_TYPE) ||
      types.includes(COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE) ||
      types.includes(REFERENCE_TRANSFER_RENDER_URL_TYPE) ||
      types.includes("text/reference-drag-token") ||
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
      const normalizedAttachment: AgentAttachment = {
        ...nextAttachment,
        deliveryStatus:
          nextAttachment.kind === "prompt"
            ? "ready"
            : isEphemeralLocalImageAttachment(nextAttachment)
              ? (nextAttachment.deliveryStatus ?? "ready")
              : (nextAttachment.deliveryStatus ?? "pending"),
        deliveryError:
          nextAttachment.kind === "prompt" ? null : (nextAttachment.deliveryError ?? null),
      };
      const existingIndex = prev.findIndex((item) => attachmentSignature(item) === signature);
      if (existingIndex >= 0) {
        if (nextAttachment.kind !== "image") {
          return prev;
        }
        const existingAttachment = prev[existingIndex];
        const replacementAttachment: AgentAttachment = {
          ...existingAttachment,
          ...normalizedAttachment,
          id: existingAttachment.id,
          deliveryStatus: isEphemeralLocalImageAttachment(normalizedAttachment)
            ? (normalizedAttachment.deliveryStatus ?? "ready")
            : (normalizedAttachment.deliveryStatus ?? "pending"),
          deliveryError: normalizedAttachment.deliveryError ?? null,
        };
        recordCreateWorkflowEvent("attachment_replaced", {
          attachmentId: existingAttachment.id,
          before: summarizeCreateWorkflowAttachment(existingAttachment),
          after: summarizeCreateWorkflowAttachment(replacementAttachment),
        });
        return prev.map((attachment, index) =>
          index === existingIndex ? replacementAttachment : attachment
        );
      }
      let next = [...prev, normalizedAttachment];
      recordCreateWorkflowEvent("attachment_inserted", {
        attachmentId: normalizedAttachment.id,
        attachment: summarizeCreateWorkflowAttachment(normalizedAttachment),
      });
      if (nextAttachment.kind === "image") {
        const imageCount = next.filter((item) => item.kind === "image").length;
        if (imageCount > MAX_AGENT_IMAGE_ATTACHMENTS) {
          const oldestImageIndex = next.findIndex((item) => item.kind === "image");
          if (oldestImageIndex >= 0) {
            const removedAttachment = next[oldestImageIndex];
            recordCreateWorkflowEvent("attachment_trimmed", {
              attachmentId: removedAttachment?.id ?? null,
              attachment: removedAttachment
                ? summarizeCreateWorkflowAttachment(removedAttachment)
                : null,
            });
            next = next.filter((_, index) => index !== oldestImageIndex);
          }
        }
      }
      if (next.length > MAX_AGENT_ATTACHMENTS) {
        const trimmedNext = next.slice(next.length - MAX_AGENT_ATTACHMENTS);
        next
          .filter((attachment) => !trimmedNext.includes(attachment))
          .forEach((attachment) => {
            recordCreateWorkflowEvent("attachment_pruned_by_max_total", {
              attachmentId: attachment.id,
              attachment: summarizeCreateWorkflowAttachment(attachment),
            });
          });
        next = trimmedNext;
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
      const transfer = event.dataTransfer;
      const dropSnapshot = captureComposerDropSnapshot(transfer);
      const transferSnapshot = buildComposerDropSnapshotTransfer(dropSnapshot);
      const internalPayload = extractInternalReferenceDragPayload(transferSnapshot);
      const composerImagePayload = extractComposerImageDropPayload(transferSnapshot);
      const mediaLibraryPayload = readMediaLibraryDragPayload(transferSnapshot);
      const hasStructuredReferenceDrop = Boolean(
        internalPayload || composerImagePayload || mediaLibraryPayload
      );
      const hasReferenceImageHints =
        hasStructuredReferenceDrop || hasSnapshotReferenceImageHints(dropSnapshot);
      const droppedFiles = dropSnapshot.files;
      const droppedVideoFiles = droppedFiles.filter((file) => file.type.startsWith("video/"));
      const droppedImageFiles = droppedFiles
        .filter((file) => file.type.startsWith("image/"))
        .slice(
          0,
          Math.max(1, Math.min(MAX_AGENT_IMAGE_ATTACHMENTS, Math.trunc(maxImageAttachmentsPerDrop)))
        );
      recordCreateWorkflowEvent("drop_received", {
        transferTypes: dropSnapshot.transferTypes,
        droppedFileCount: droppedFiles.length,
        droppedImageFileCount: droppedImageFiles.length,
        droppedVideoFileCount: droppedVideoFiles.length,
      });
      if (droppedVideoFiles.length > 0) {
        setAgentAttachmentError(VIDEO_ATTACHMENT_REJECTION_MESSAGE);
        return;
      }
      if (!hasReferenceImageHints && droppedImageFiles.length > 0) {
        void (async () => {
          if (!agentSessionEnabled) {
            ensureAgentSession();
          }
          setAgentAttachmentError(null);
          for (const file of droppedImageFiles) {
            const imageData = await createEphemeralComposerImageData(file).catch((error) => {
              const message =
                error instanceof Error && error.message.trim().length > 0
                  ? error.message.trim()
                  : EPHEMERAL_IMAGE_UNREADABLE_MESSAGE;
              setAgentAttachmentError(
                message === EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE
                  ? EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE
                  : EPHEMERAL_IMAGE_UNREADABLE_MESSAGE
              );
              recordCreateWorkflowEvent("ephemeral_image_rejected", {
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size,
                message,
              });
              return null;
            });
            if (!imageData) continue;
            const attachmentId = randomId();
            insertAttachment({
              id: attachmentId,
              kind: "image",
              source: "ephemeral_local",
              referenceId: null,
              imageUrl: imageData.previewDataUrl,
              modelDataUrl: imageData.modelDataUrl,
              submissionImageUrl: null,
              text: null,
              aspect: null,
              deliveryStatus: "ready",
              deliveryError: null,
            });
            recordCreateWorkflowEvent("ephemeral_image_created", {
              attachmentId,
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              width: imageData.width,
              height: imageData.height,
            });
          }
        })();
        return;
      }
      void (async () => {
        const resolvedInternalImageSource =
          internalPayload && resolveInternalImageDropSource
            ? await resolveInternalImageDropSource(internalPayload).catch(() => null)
            : null;
        if (composerImagePayload) {
          const droppedReferenceId =
            composerImagePayload.outputId ??
            composerImagePayload.referenceId ??
            resolvedInternalImageSource?.outputId ??
            internalPayload?.outputId ??
            null;
          const matchedOutput = droppedReferenceId ? findOutputById(droppedReferenceId) : null;
          const normalizedPromptText =
            composerImagePayload.promptText?.trim() ||
            resolvedInternalImageSource?.promptText?.trim() ||
            matchedOutput?.prompt?.trim() ||
            matchedOutput?.previewText?.trim() ||
            null;

          const hasInternalVideoReference =
            internalPayload?.mediaKind === "video" || matchedOutput?.mode === "video";
          const hasInternalAudioReference =
            internalPayload?.mediaKind === "audio" || matchedOutput?.mode === "audio";
          if (hasInternalVideoReference) {
            setAgentAttachmentError(VIDEO_ATTACHMENT_REJECTION_MESSAGE);
            return;
          }
          if (hasInternalAudioReference) {
            setAgentAttachmentError(NON_IMAGE_ATTACHMENT_REJECTION_MESSAGE);
            return;
          }

          const internalImageUrls = resolvedInternalImageSource
            ? buildResolvedInternalImageUrls([
                resolvedInternalImageSource.preparedImageUrl,
                resolvedInternalImageSource.preview.url,
              ])
            : [];
          const normalizedInternalImageUrl = internalImageUrls[0] ?? null;
          const internalSourceBlob = resolvedInternalImageSource
            ? await resolvedInternalImageSource.loadBlob().catch(() => null)
            : null;
          if (normalizedInternalImageUrl || internalSourceBlob) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            const attachmentId = randomId();
            const ephemeralAttachment = await createEphemeralImageAttachment({
              id: attachmentId,
              referenceId: droppedReferenceId,
              mediaId:
                resolvedInternalImageSource?.mediaId ??
                composerImagePayload.mediaId ??
                internalPayload?.mediaId ??
                null,
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
              sourceBlob: internalSourceBlob,
              previewUrl: normalizedInternalImageUrl,
              modelUrl: normalizedInternalImageUrl,
            });
            if (ephemeralAttachment) {
              insertAttachment(ephemeralAttachment);
              return;
            }
          }

          const displayArtifactUrl = normalizeDroppedImageCandidate(
            composerImagePayload.displayArtifactUrl
          );
          const matchedOutputImageUrl = normalizeDurableDroppedImageCandidate(
            matchedOutput ? resolveReferenceTransferUrl(matchedOutput, "image") : null
          );
          const referenceUrl = normalizeDurableDroppedImageCandidate(
            composerImagePayload.referenceUrl
          );
          const durableReferenceUrl = referenceUrl ?? matchedOutputImageUrl ?? null;
          const hasDurableIdentity =
            Boolean(composerImagePayload.previewStoragePath?.trim()) ||
            Boolean(composerImagePayload.fullStoragePath?.trim()) ||
            Boolean(durableReferenceUrl);
          if (hasDurableIdentity) {
            const identityImageUrl =
              durableReferenceUrl ??
              (await resolveStorageBackedDropImageUrl({
                previewStoragePath: composerImagePayload.previewStoragePath ?? null,
                fullStoragePath: composerImagePayload.fullStoragePath ?? null,
                referenceUrl: durableReferenceUrl,
              }));
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            const attachmentId = randomId();
            const ephemeralAttachment = await createEphemeralImageAttachment({
              id: attachmentId,
              referenceId: droppedReferenceId,
              mediaId: composerImagePayload.mediaId ?? null,
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
              previewUrl: displayArtifactUrl ?? identityImageUrl,
              modelUrl: identityImageUrl,
            });
            if (ephemeralAttachment) {
              insertAttachment(ephemeralAttachment);
              return;
            }
            setAgentAttachmentError(INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE);
            return;
          }
          const orderedImageUrls = buildAgentAttachmentImageCandidates({
            imageUrl: displayArtifactUrl,
            imageFallbackUrls: resolveDroppedImageUrls([referenceUrl, matchedOutputImageUrl]),
            referenceRenderUrl: displayArtifactUrl,
            referenceUrl: durableReferenceUrl,
          });
          const normalizedImageUrl = orderedImageUrls[0] ?? null;

          if (!normalizedImageUrl) {
            setAgentAttachmentError(INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE);
            return;
          }

          if (!agentSessionEnabled) {
            ensureAgentSession();
          }
          setAgentAttachmentError(null);
          const fallbackAttachment = await createEphemeralImageAttachment({
            id: randomId(),
            referenceId: droppedReferenceId,
            mediaId: composerImagePayload.mediaId ?? null,
            text: normalizedPromptText,
            aspect: matchedOutput?.aspect ?? null,
            previewUrl: normalizedImageUrl,
            modelUrl: durableReferenceUrl ?? normalizedImageUrl,
          });
          if (!fallbackAttachment) {
            setAgentAttachmentError(INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE);
            return;
          }
          insertAttachment(fallbackAttachment);
          return;
        }

        const payload = extractDragDropPayload(transferSnapshot);
        const droppedReferenceId =
          payload.referenceId ??
          resolvedInternalImageSource?.outputId ??
          internalPayload?.outputId ??
          null;
        const matchedOutput = droppedReferenceId ? findOutputById(droppedReferenceId) : null;
        const droppedPromptText = payload.promptText?.trim() || null;
        const internalPromptText =
          droppedPromptText ||
          resolvedInternalImageSource?.promptText?.trim() ||
          matchedOutput?.prompt?.trim() ||
          matchedOutput?.previewText?.trim() ||
          null;

        if (internalPayload) {
          const internalImageUrls = resolvedInternalImageSource
            ? buildResolvedInternalImageUrls([
                resolvedInternalImageSource.preparedImageUrl,
                resolvedInternalImageSource.preview.url,
              ])
            : [];
          const normalizedInternalImageUrl = internalImageUrls[0] ?? null;
          const internalSourceBlob = resolvedInternalImageSource
            ? await resolvedInternalImageSource.loadBlob().catch(() => null)
            : null;
          const hasInternalVideoReference =
            payload.mediaKind === "video" ||
            internalPayload.mediaKind === "video" ||
            matchedOutput?.mode === "video";
          const hasInternalAudioReference =
            payload.mediaKind === "audio" ||
            internalPayload.mediaKind === "audio" ||
            matchedOutput?.mode === "audio";

          if (hasInternalVideoReference) {
            setAgentAttachmentError(VIDEO_ATTACHMENT_REJECTION_MESSAGE);
            return;
          }
          if (hasInternalAudioReference) {
            setAgentAttachmentError(NON_IMAGE_ATTACHMENT_REJECTION_MESSAGE);
            return;
          }

          if (normalizedInternalImageUrl || internalSourceBlob) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            const attachmentId = randomId();
            const ephemeralAttachment = await createEphemeralImageAttachment({
              id: attachmentId,
              referenceId: droppedReferenceId,
              mediaId: resolvedInternalImageSource?.mediaId ?? internalPayload.mediaId ?? null,
              text: internalPromptText,
              aspect: matchedOutput?.aspect ?? null,
              sourceBlob: internalSourceBlob,
              previewUrl: normalizedInternalImageUrl,
              modelUrl: normalizedInternalImageUrl,
            });
            if (ephemeralAttachment) {
              insertAttachment(ephemeralAttachment);
              return;
            }
          }

          if (droppedPromptText) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            insertAttachment({
              id: randomId(),
              kind: "prompt",
              referenceId: droppedReferenceId,
              text: droppedPromptText,
              aspect: matchedOutput?.aspect ?? null,
            });
            setAgentAttachmentError(INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE);
            return;
          }
          setAgentAttachmentError(INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE);
          return;
        }

        const shouldUseWeakPagePreviewFallback =
          !internalPayload && mediaLibraryPayload?.kind !== "libraryMedia";
        const resolvedPreviewUrl =
          droppedReferenceId && shouldUseWeakPagePreviewFallback
            ? resolveOutputPreviewUrlById(droppedReferenceId)
            : null;
        const matchedOutputImageUrl =
          matchedOutput && shouldUseWeakPagePreviewFallback
            ? resolveReferenceTransferUrl(matchedOutput, "image")
            : null;
        const transferReferenceUrl =
          normalizeReferenceTransferUrlCandidate(transferSnapshot.getData("text/reference-url")) ??
          null;
        const transferRenderUrl =
          normalizeReferenceTransferUrlCandidate(
            transferSnapshot.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE),
            { unwrapNextImage: false }
          ) ?? null;
        const mediaLibraryImagePayload =
          mediaLibraryPayload?.kind === "libraryMedia" ? mediaLibraryPayload.payload : null;
        const normalizedPromptText =
          payload.promptText?.trim() ||
          mediaLibraryImagePayload?.promptText?.trim() ||
          matchedOutput?.prompt?.trim() ||
          matchedOutput?.previewText?.trim() ||
          null;
        const normalizedImageUrls = buildAgentAttachmentImageCandidates({
          imageUrl:
            mediaLibraryImagePayload?.previewUrl ??
            transferRenderUrl ??
            payload.imageUrl ??
            resolvedPreviewUrl ??
            mediaLibraryImagePayload?.url ??
            null,
          imageFallbackUrls: resolveDroppedImageUrls([
            transferRenderUrl,
            payload.imageUrl,
            mediaLibraryImagePayload?.previewUrl,
            mediaLibraryImagePayload?.previewPosterUrl,
            resolvedPreviewUrl,
            mediaLibraryImagePayload?.url,
            mediaLibraryImagePayload?.fullUrl,
          ]),
          referenceRenderUrl: transferRenderUrl ?? null,
          referenceUrl: transferReferenceUrl ?? null,
        });
        const fallbackImageUrls = resolveDroppedImageUrls([
          transferRenderUrl,
          mediaLibraryImagePayload?.previewUrl,
          mediaLibraryImagePayload?.previewPosterUrl,
          mediaLibraryImagePayload?.url,
          mediaLibraryImagePayload?.fullUrl,
          transferReferenceUrl,
          matchedOutputImageUrl,
          resolvedPreviewUrl,
        ]);
        const durableSubmissionImageUrls = resolveDurableDroppedImageUrls([
          transferReferenceUrl,
          mediaLibraryImagePayload?.fullUrl,
          mediaLibraryImagePayload?.url,
          matchedOutputImageUrl,
          payload.imageUrl,
        ]);
        const orderedImageUrls = Array.from(
          new Set([...normalizedImageUrls, ...fallbackImageUrls].filter(Boolean))
        );
        const normalizedImageUrl = orderedImageUrls[0] ?? null;
        const normalizedSubmissionImageUrl = durableSubmissionImageUrls[0] ?? null;
        const hasVideoReference =
          payload.mediaKind === "video" ||
          mediaLibraryImagePayload?.fileType === "video" ||
          matchedOutput?.mode === "video" ||
          looksLikeVideoUrl(transferReferenceUrl ?? undefined) ||
          looksLikeVideoUrl(transferRenderUrl ?? undefined) ||
          looksLikeVideoUrl(payload.imageUrl ?? undefined) ||
          looksLikeVideoUrl(mediaLibraryImagePayload?.previewUrl ?? undefined) ||
          looksLikeVideoUrl(mediaLibraryImagePayload?.previewPosterUrl ?? undefined) ||
          looksLikeVideoUrl(mediaLibraryImagePayload?.url ?? undefined) ||
          looksLikeVideoUrl(mediaLibraryImagePayload?.fullUrl ?? undefined) ||
          looksLikeVideoUrl(matchedOutputImageUrl ?? undefined) ||
          looksLikeVideoUrl(resolvedPreviewUrl ?? undefined);
        const hasAudioReference =
          payload.mediaKind === "audio" ||
          mediaLibraryImagePayload?.fileType === "audio" ||
          matchedOutput?.mode === "audio" ||
          looksLikeAudioUrl(transferReferenceUrl ?? undefined) ||
          looksLikeAudioUrl(transferRenderUrl ?? undefined) ||
          looksLikeAudioUrl(payload.imageUrl ?? undefined) ||
          looksLikeAudioUrl(mediaLibraryImagePayload?.previewUrl ?? undefined) ||
          looksLikeAudioUrl(mediaLibraryImagePayload?.previewPosterUrl ?? undefined) ||
          looksLikeAudioUrl(mediaLibraryImagePayload?.url ?? undefined) ||
          looksLikeAudioUrl(mediaLibraryImagePayload?.fullUrl ?? undefined) ||
          looksLikeAudioUrl(matchedOutputImageUrl ?? undefined) ||
          looksLikeAudioUrl(resolvedPreviewUrl ?? undefined);

        if (hasVideoReference) {
          setAgentAttachmentError(VIDEO_ATTACHMENT_REJECTION_MESSAGE);
          return;
        }
        if (hasAudioReference) {
          setAgentAttachmentError(NON_IMAGE_ATTACHMENT_REJECTION_MESSAGE);
          return;
        }

        if (!normalizedImageUrl && !normalizedPromptText) return;
        if (!agentSessionEnabled) {
          ensureAgentSession();
        }
        setAgentAttachmentError(null);

        if (normalizedImageUrl) {
          const ephemeralAttachment = await createEphemeralImageAttachment({
            id: randomId(),
            referenceId: droppedReferenceId,
            mediaId: resolvedInternalImageSource?.mediaId ?? mediaLibraryImagePayload?.id ?? null,
            text: normalizedPromptText,
            aspect: matchedOutput?.aspect ?? null,
            previewUrl: normalizedImageUrl,
            modelUrl: normalizedSubmissionImageUrl ?? normalizedImageUrl,
          });
          if (!ephemeralAttachment) {
            setAgentAttachmentError(INTERNAL_IMAGE_ATTACHMENT_RESOLUTION_ERROR_MESSAGE);
            return;
          }
          insertAttachment(ephemeralAttachment);
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
      })();
    },
    [
      agentSessionEnabled,
      ensureAgentSession,
      findOutputById,
      insertAttachment,
      maxImageAttachmentsPerDrop,
      resolveInternalImageDropSource,
      resolveOutputPreviewUrlById,
    ]
  );

  const handleRemoveAgentAttachment = useCallback((id: string) => {
    setAgentAttachmentError(null);
    setAgentAttachments((prev) => {
      const removedAttachment = prev.find((item) => item.id === id);
      recordCreateWorkflowEvent("attachment_removed", {
        attachmentId: removedAttachment?.id ?? id,
        attachment: removedAttachment ? summarizeCreateWorkflowAttachment(removedAttachment) : null,
      });
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const handleClearAgentAttachments = useCallback(() => {
    setAgentAttachmentError(null);
    setAgentAttachments((prev) => {
      recordCreateWorkflowEvent("attachments_cleared", {
        attachmentIds: prev.map((attachment) => attachment.id),
      });
      return [];
    });
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

  const resetAgentComposer = useCallback((options?: ResetAgentComposerOptions) => {
    const preserveInput = options?.preserveInput === true;
    const preserveAttachments = options?.preserveAttachments === true;
    setAgentAttachmentError(null);
    if (!preserveInput) {
      setAgentInput("");
    }
    if (!preserveAttachments) {
      setAgentAttachments((prev) => {
        recordCreateWorkflowEvent("attachments_reset", {
          attachmentIds: prev.map((attachment) => attachment.id),
          preserveInput,
          preserveAttachments,
        });
        return [];
      });
    }
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
