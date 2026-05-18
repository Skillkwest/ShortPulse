import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { randomId } from "../logic/ids";
import {
  buildAgentAttachmentImageCandidates,
  normalizeAttachmentImageUrl,
  resolveAgentAttachmentPreviewUrl,
} from "../logic/agentAttachmentImage";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
import {
  recordCreateWorkflowEvent,
  setCreateWorkflowAttachmentSnapshot,
  summarizeCreateWorkflowAttachment,
  summarizeCreateWorkflowUrl,
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
import { uploadImageAssetToStorage } from "../utils/imageUpload";
import {
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
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

const canCreateObjectUrl = () =>
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

const COMPOSER_PREVIEW_MAX_WIDTH_PX = 184;
const COMPOSER_PREVIEW_MAX_HEIGHT_PX = 230;
const COMPOSER_PREVIEW_JPEG_QUALITY = 0.72;

const downscaleBlobToComposerPreviewUrl = async (
  blob: Blob
): Promise<{ url: string; owned: boolean } | null> => {
  if (!(blob instanceof Blob) || blob.size <= 0 || !canCreateObjectUrl()) {
    return null;
  }

  const directObjectUrl = URL.createObjectURL(blob);
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    typeof Image === "undefined"
  ) {
    return { url: directObjectUrl, owned: true };
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context || typeof canvas.toBlob !== "function") {
    return { url: directObjectUrl, owned: true };
  }

  try {
    const bitmapUrl = directObjectUrl;
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const nextImage = new Image();
      nextImage.onload = () => resolve(nextImage);
      nextImage.onerror = () => reject(new Error("Unable to decode preview image."));
      nextImage.src = bitmapUrl;
    });

    const sourceWidth = Math.max(
      1,
      image.naturalWidth || image.width || COMPOSER_PREVIEW_MAX_WIDTH_PX
    );
    const sourceHeight = Math.max(
      1,
      image.naturalHeight || image.height || COMPOSER_PREVIEW_MAX_HEIGHT_PX
    );
    const scale = Math.min(
      1,
      COMPOSER_PREVIEW_MAX_WIDTH_PX / sourceWidth,
      COMPOSER_PREVIEW_MAX_HEIGHT_PX / sourceHeight
    );
    const targetWidth = Math.max(1, Math.round(sourceWidth * scale));
    const targetHeight = Math.max(1, Math.round(sourceHeight * scale));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    try {
      const previewDataUrl = canvas.toDataURL("image/jpeg", COMPOSER_PREVIEW_JPEG_QUALITY);
      if (typeof previewDataUrl === "string" && previewDataUrl.startsWith("data:image/")) {
        URL.revokeObjectURL(directObjectUrl);
        return { url: previewDataUrl, owned: false };
      }
    } catch {
      // Fall back to blob-backed thumbnail creation below.
    }

    const previewBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", COMPOSER_PREVIEW_JPEG_QUALITY);
    });

    if (!(previewBlob instanceof Blob) || previewBlob.size <= 0) {
      return { url: directObjectUrl, owned: true };
    }

    URL.revokeObjectURL(directObjectUrl);
    return {
      url: URL.createObjectURL(previewBlob),
      owned: true,
    };
  } catch {
    return { url: directObjectUrl, owned: true };
  }
};

const materializeComposerPreviewBlobUrl = async (args: {
  displayArtifactUrl: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl?: string | null;
}): Promise<{
  previewUrl: string;
  previewOwned: boolean;
} | null> => {
  const displayArtifactUrl = normalizeDroppedImageCandidate(args.displayArtifactUrl);
  const durableReferenceUrl = normalizeDurableDroppedImageCandidate(args.referenceUrl);
  const hasDurableIdentity =
    Boolean(args.previewStoragePath?.trim()) ||
    Boolean(args.fullStoragePath?.trim()) ||
    Boolean(durableReferenceUrl);
  if (!canCreateObjectUrl()) {
    return displayArtifactUrl?.startsWith("data:") || displayArtifactUrl?.startsWith("blob:")
      ? {
          previewUrl: displayArtifactUrl,
          previewOwned: false,
        }
      : null;
  }
  const resolvedSource = hasDurableIdentity
    ? await resolveAgentAttachmentPreviewUrl({
        previewStoragePath: args.previewStoragePath ?? null,
        fullStoragePath: args.fullStoragePath ?? null,
        referenceRenderUrl: null,
        referenceUrl: durableReferenceUrl,
        imageUrl: null,
      }).catch(() => null)
    : displayArtifactUrl;
  if (!resolvedSource) return null;
  try {
    const response = await fetch(resolvedSource);
    if (!response.ok) return null;
    const blob = await response.blob();
    const previewResult = await downscaleBlobToComposerPreviewUrl(blob);
    return {
      previewUrl: previewResult?.url ?? resolvedSource,
      previewOwned: previewResult?.owned ?? true,
    };
  } catch {
    return resolvedSource.startsWith("blob:") || resolvedSource.startsWith("data:")
      ? {
          previewUrl: resolvedSource,
          previewOwned: false,
        }
      : null;
  }
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
  const ownedObjectUrlsRef = useRef<Set<string>>(new Set());

  const registerOwnedObjectUrl = useCallback((value: string | null | undefined) => {
    const normalized = normalizeAttachmentImageUrl(value);
    if (!normalized?.startsWith("blob:")) return;
    ownedObjectUrlsRef.current.add(normalized);
  }, []);

  const revokeOwnedObjectUrl = useCallback((value: string | null | undefined) => {
    const normalized = normalizeAttachmentImageUrl(value);
    if (!normalized?.startsWith("blob:")) return;
    if (!ownedObjectUrlsRef.current.has(normalized)) return;
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(normalized);
    }
    ownedObjectUrlsRef.current.delete(normalized);
  }, []);

  const revokeOwnedAttachmentUrls = useCallback(
    (attachment: Pick<AgentAttachment, "kind" | "imageUrl" | "submissionImageUrl"> | null) => {
      if (!attachment || attachment.kind !== "image") return;
      revokeOwnedObjectUrl(attachment.imageUrl);
      revokeOwnedObjectUrl(attachment.submissionImageUrl);
    },
    [revokeOwnedObjectUrl]
  );

  useEffect(() => {
    const ownedObjectUrls = ownedObjectUrlsRef.current;
    return () => {
      ownedObjectUrls.forEach((objectUrl) => {
        if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
          URL.revokeObjectURL(objectUrl);
        }
      });
      ownedObjectUrls.clear();
    };
  }, []);

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

  const patchImageAttachment = useCallback(
    (id: string, updater: (attachment: AgentAttachment & { kind: "image" }) => AgentAttachment) => {
      setAgentAttachments((prev) =>
        prev.map((attachment) => {
          if (attachment.id !== id || attachment.kind !== "image") return attachment;
          return updater(attachment as AgentAttachment & { kind: "image" });
        })
      );
    },
    []
  );

  const uploadComposerImageBlob = useCallback(async (blob: Blob) => {
    if (!(blob instanceof Blob) || blob.size <= 0 || !canCreateObjectUrl()) {
      throw new Error("Could not read that image for upload.");
    }
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await uploadImageAssetToStorage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }, []);

  const promoteAttachmentToDurableSource = useCallback(
    async ({
      attachmentId,
      previewStoragePath,
      fullStoragePath,
      referenceUrl,
      sourceBlob,
    }: {
      attachmentId: string;
      previewStoragePath?: string | null;
      fullStoragePath?: string | null;
      referenceUrl?: string | null;
      sourceBlob?: Blob | null;
    }) => {
      recordCreateWorkflowEvent("attachment_delivery_started", {
        attachmentId,
        hasSourceBlob: sourceBlob instanceof Blob && sourceBlob.size > 0,
        previewStoragePath: previewStoragePath ?? null,
        fullStoragePath: fullStoragePath ?? null,
        referenceUrl: summarizeCreateWorkflowUrl(referenceUrl),
      });
      try {
        const durableReferenceUrl = await resolveAgentAttachmentPreviewUrl({
          previewStoragePath: null,
          fullStoragePath: null,
          referenceRenderUrl: null,
          referenceUrl: referenceUrl ?? null,
          imageUrl: null,
          submissionImageUrl: null,
        }).catch(() => null);
        const durableFullStorageUrl = fullStoragePath
          ? await resolveAgentAttachmentPreviewUrl({
              previewStoragePath: null,
              fullStoragePath,
              referenceRenderUrl: null,
              referenceUrl: null,
              imageUrl: null,
              submissionImageUrl: null,
            }).catch(() => null)
          : null;
        const durablePreviewStorageUrl =
          !durableFullStorageUrl && previewStoragePath
            ? await resolveAgentAttachmentPreviewUrl({
                previewStoragePath,
                fullStoragePath: null,
                referenceRenderUrl: null,
                referenceUrl: null,
                imageUrl: null,
                submissionImageUrl: null,
              }).catch(() => null)
            : null;
        const durableSubmissionUrl =
          durableReferenceUrl ?? durableFullStorageUrl ?? durablePreviewStorageUrl ?? null;

        if (
          durableSubmissionUrl &&
          !durableSubmissionUrl.startsWith("blob:") &&
          !durableSubmissionUrl.startsWith("data:")
        ) {
          patchImageAttachment(attachmentId, (attachment) => ({
            ...attachment,
            previewStoragePath: previewStoragePath ?? attachment.previewStoragePath ?? null,
            fullStoragePath: fullStoragePath ?? attachment.fullStoragePath ?? null,
            referenceUrl: referenceUrl ?? attachment.referenceUrl ?? durableSubmissionUrl,
            submissionImageUrl: durableSubmissionUrl,
            deliveryStatus: "ready",
            deliveryError: null,
          }));
          recordCreateWorkflowEvent("attachment_delivery_ready", {
            attachmentId,
            source: "durable_identity",
            submissionImageUrl: summarizeCreateWorkflowUrl(durableSubmissionUrl),
            previewStoragePath: previewStoragePath ?? null,
            fullStoragePath: fullStoragePath ?? null,
          });
          return;
        }

        if (!(sourceBlob instanceof Blob) || sourceBlob.size <= 0) {
          throw new Error("Image upload/preparation failed. Remove this image and try again.");
        }

        const uploaded = await uploadComposerImageBlob(sourceBlob);
        patchImageAttachment(attachmentId, (attachment) => ({
          ...attachment,
          previewStoragePath: previewStoragePath ?? attachment.previewStoragePath ?? null,
          fullStoragePath: uploaded.path ?? fullStoragePath ?? attachment.fullStoragePath ?? null,
          referenceUrl: referenceUrl ?? uploaded.url ?? attachment.referenceUrl ?? null,
          submissionImageUrl: uploaded.url,
          deliveryStatus: "ready",
          deliveryError: null,
        }));
        recordCreateWorkflowEvent("attachment_delivery_ready", {
          attachmentId,
          source: "uploaded_storage",
          submissionImageUrl: summarizeCreateWorkflowUrl(uploaded.url),
          fullStoragePath: uploaded.path ?? fullStoragePath ?? null,
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim().length > 0
            ? error.message.trim()
            : "Image upload/preparation failed. Remove this image and try again.";
        patchImageAttachment(attachmentId, (attachment) => ({
          ...attachment,
          submissionImageUrl: null,
          deliveryStatus: "failed",
          deliveryError: message,
        }));
        setAgentAttachmentError(
          "One or more attached images failed to prepare. Remove failed images and try again."
        );
        recordCreateWorkflowEvent("attachment_delivery_failed", {
          attachmentId,
          message,
        });
      }
    },
    [patchImageAttachment, uploadComposerImageBlob]
  );

  const insertAttachment = useCallback(
    (nextAttachment: AgentAttachment) => {
      setAgentAttachments((prev) => {
        const signature = attachmentSignature(nextAttachment);
        const normalizedAttachment: AgentAttachment = {
          ...nextAttachment,
          deliveryStatus:
            nextAttachment.kind === "prompt"
              ? "ready"
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
          if (
            existingAttachment.kind === "image" &&
            (existingAttachment.imageUrl !== normalizedAttachment.imageUrl ||
              existingAttachment.submissionImageUrl !== normalizedAttachment.submissionImageUrl)
          ) {
            revokeOwnedAttachmentUrls(existingAttachment);
          }
          const replacementAttachment: AgentAttachment = {
            ...existingAttachment,
            ...normalizedAttachment,
            id: existingAttachment.id,
            deliveryStatus: normalizedAttachment.deliveryStatus ?? "pending",
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
              revokeOwnedAttachmentUrls(removedAttachment ?? null);
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
              revokeOwnedAttachmentUrls(attachment);
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
    },
    [revokeOwnedAttachmentUrls]
  );

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
      const droppedFiles = Array.from(transfer.files ?? []);
      const droppedVideoFiles = droppedFiles.filter((file) => file.type.startsWith("video/"));
      const droppedImageFiles = droppedFiles
        .filter((file) => file.type.startsWith("image/"))
        .slice(
          0,
          Math.max(1, Math.min(MAX_AGENT_IMAGE_ATTACHMENTS, Math.trunc(maxImageAttachmentsPerDrop)))
        );
      recordCreateWorkflowEvent("drop_received", {
        transferTypes: Array.from(transfer.types ?? []),
        droppedFileCount: droppedFiles.length,
        droppedImageFileCount: droppedImageFiles.length,
        droppedVideoFileCount: droppedVideoFiles.length,
      });
      if (droppedVideoFiles.length > 0) {
        setAgentAttachmentError(VIDEO_ATTACHMENT_REJECTION_MESSAGE);
        return;
      }
      if (droppedImageFiles.length > 0) {
        void (async () => {
          if (!agentSessionEnabled) {
            ensureAgentSession();
          }
          setAgentAttachmentError(null);
          for (const file of droppedImageFiles) {
            const preview = await downscaleBlobToComposerPreviewUrl(file).catch(() => null);
            const previewUrl = preview?.url ?? null;
            if (preview?.owned) {
              registerOwnedObjectUrl(preview.url);
            }
            const attachmentId = randomId();
            insertAttachment({
              id: attachmentId,
              kind: "image",
              referenceId: null,
              imageUrl: previewUrl,
              submissionImageUrl: null,
              text: null,
              aspect: null,
              deliveryStatus: "preparing",
              deliveryError: null,
            });
            void promoteAttachmentToDurableSource({
              attachmentId,
              sourceBlob: file,
            });
          }
        })();
        return;
      }
      void (async () => {
        const internalPayload = extractInternalReferenceDragPayload(transfer);
        const resolvedInternalImageSource =
          internalPayload && resolveInternalImageDropSource
            ? await resolveInternalImageDropSource(internalPayload).catch(() => null)
            : null;
        const composerImagePayload = extractComposerImageDropPayload(transfer);
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
          const materializedInternalPreview =
            resolvedInternalImageSource && canCreateObjectUrl()
              ? await resolvedInternalImageSource
                  .loadBlob()
                  .then(async (blob) => ({
                    blob,
                    preview: await downscaleBlobToComposerPreviewUrl(blob),
                  }))
                  .catch(() => null)
              : null;
          const composerInternalPreviewUrl =
            materializedInternalPreview?.preview?.url ?? normalizedInternalImageUrl;
          if (composerInternalPreviewUrl) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            if (materializedInternalPreview?.preview?.owned) {
              registerOwnedObjectUrl(materializedInternalPreview.preview.url);
            }
            const attachmentId = randomId();
            insertAttachment({
              id: attachmentId,
              kind: "image",
              referenceId: droppedReferenceId,
              mediaId:
                resolvedInternalImageSource?.mediaId ??
                composerImagePayload.mediaId ??
                internalPayload?.mediaId ??
                null,
              previewStoragePath:
                resolvedInternalImageSource?.previewStoragePath ??
                composerImagePayload.previewStoragePath ??
                null,
              fullStoragePath:
                resolvedInternalImageSource?.fullStoragePath ??
                composerImagePayload.fullStoragePath ??
                null,
              referenceUrl: null,
              referenceRenderUrl: null,
              imageUrl: composerInternalPreviewUrl,
              submissionImageUrl: null,
              imageFallbackUrls:
                composerInternalPreviewUrl &&
                composerInternalPreviewUrl !== normalizedInternalImageUrl
                  ? [normalizedInternalImageUrl, ...internalImageUrls.slice(1)].filter(Boolean)
                  : internalImageUrls.slice(1),
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
              deliveryStatus: "preparing",
              deliveryError: null,
            });
            void promoteAttachmentToDurableSource({
              attachmentId,
              previewStoragePath:
                resolvedInternalImageSource?.previewStoragePath ??
                composerImagePayload.previewStoragePath ??
                null,
              fullStoragePath:
                resolvedInternalImageSource?.fullStoragePath ??
                composerImagePayload.fullStoragePath ??
                null,
              sourceBlob: materializedInternalPreview?.blob ?? null,
            });
            return;
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
          const materializedPreview = await materializeComposerPreviewBlobUrl({
            displayArtifactUrl,
            previewStoragePath: composerImagePayload.previewStoragePath ?? null,
            fullStoragePath: composerImagePayload.fullStoragePath ?? null,
            referenceUrl: durableReferenceUrl,
          });
          if (materializedPreview) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            if (materializedPreview.previewOwned) {
              registerOwnedObjectUrl(materializedPreview.previewUrl);
            }
            const attachmentId = randomId();
            insertAttachment({
              id: attachmentId,
              kind: "image",
              referenceId: droppedReferenceId,
              mediaId: composerImagePayload.mediaId ?? null,
              previewStoragePath: composerImagePayload.previewStoragePath ?? null,
              fullStoragePath: composerImagePayload.fullStoragePath ?? null,
              referenceUrl: durableReferenceUrl,
              referenceRenderUrl: null,
              imageUrl: materializedPreview.previewUrl,
              submissionImageUrl: null,
              imageFallbackUrls: [],
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
              deliveryStatus: "preparing",
              deliveryError: null,
            });
            void promoteAttachmentToDurableSource({
              attachmentId,
              previewStoragePath: composerImagePayload.previewStoragePath ?? null,
              fullStoragePath: composerImagePayload.fullStoragePath ?? null,
              referenceUrl: durableReferenceUrl,
            });
            return;
          }
          if (hasDurableIdentity) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            const attachmentId = randomId();
            insertAttachment({
              id: attachmentId,
              kind: "image",
              referenceId: droppedReferenceId,
              mediaId: composerImagePayload.mediaId ?? null,
              previewStoragePath: composerImagePayload.previewStoragePath ?? null,
              fullStoragePath: composerImagePayload.fullStoragePath ?? null,
              referenceUrl: durableReferenceUrl,
              referenceRenderUrl: null,
              imageUrl: null,
              submissionImageUrl: null,
              imageFallbackUrls: [],
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
              deliveryStatus: "preparing",
              deliveryError: null,
            });
            void promoteAttachmentToDurableSource({
              attachmentId,
              previewStoragePath: composerImagePayload.previewStoragePath ?? null,
              fullStoragePath: composerImagePayload.fullStoragePath ?? null,
              referenceUrl: durableReferenceUrl,
            });
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
          insertAttachment({
            id: randomId(),
            kind: "image",
            referenceId: droppedReferenceId,
            mediaId: composerImagePayload.mediaId ?? null,
            previewStoragePath: composerImagePayload.previewStoragePath ?? null,
            fullStoragePath: composerImagePayload.fullStoragePath ?? null,
            referenceUrl: durableReferenceUrl,
            referenceRenderUrl: displayArtifactUrl,
            imageUrl: normalizedImageUrl,
            submissionImageUrl: durableReferenceUrl,
            imageFallbackUrls: orderedImageUrls.slice(1),
            text: normalizedPromptText,
            aspect: matchedOutput?.aspect ?? null,
          });
          return;
        }

        const payload = extractDragDropPayload(transfer);
        const mediaLibraryPayload = readMediaLibraryDragPayload(transfer);
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
          const materializedInternalPreview =
            resolvedInternalImageSource && canCreateObjectUrl()
              ? await resolvedInternalImageSource
                  .loadBlob()
                  .then(async (blob) => ({
                    blob,
                    preview: await downscaleBlobToComposerPreviewUrl(blob),
                  }))
                  .catch(() => null)
              : null;
          const composerInternalPreviewUrl =
            materializedInternalPreview?.preview?.url ?? normalizedInternalImageUrl;
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

          if (composerInternalPreviewUrl) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            if (materializedInternalPreview?.preview?.owned) {
              registerOwnedObjectUrl(materializedInternalPreview.preview.url);
            }
            const attachmentId = randomId();
            insertAttachment({
              id: attachmentId,
              kind: "image",
              referenceId: droppedReferenceId,
              mediaId: resolvedInternalImageSource?.mediaId ?? internalPayload.mediaId ?? null,
              previewStoragePath: resolvedInternalImageSource?.previewStoragePath ?? null,
              fullStoragePath: resolvedInternalImageSource?.fullStoragePath ?? null,
              referenceUrl: null,
              referenceRenderUrl: null,
              imageUrl: composerInternalPreviewUrl,
              submissionImageUrl: null,
              imageFallbackUrls:
                composerInternalPreviewUrl &&
                composerInternalPreviewUrl !== normalizedInternalImageUrl
                  ? [normalizedInternalImageUrl, ...internalImageUrls.slice(1)].filter(Boolean)
                  : internalImageUrls.slice(1),
              text: internalPromptText,
              aspect: matchedOutput?.aspect ?? null,
              deliveryStatus: "preparing",
              deliveryError: null,
            });
            void promoteAttachmentToDurableSource({
              attachmentId,
              previewStoragePath: resolvedInternalImageSource?.previewStoragePath ?? null,
              fullStoragePath: resolvedInternalImageSource?.fullStoragePath ?? null,
              sourceBlob: materializedInternalPreview?.blob ?? null,
            });
            return;
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
          normalizeReferenceTransferUrlCandidate(transfer.getData("text/reference-url")) ?? null;
        const transferRenderUrl =
          normalizeReferenceTransferUrlCandidate(
            transfer.getData(REFERENCE_TRANSFER_RENDER_URL_TYPE),
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
          insertAttachment({
            id: randomId(),
            kind: "image",
            referenceId: droppedReferenceId,
            mediaId: resolvedInternalImageSource?.mediaId ?? mediaLibraryImagePayload?.id ?? null,
            previewStoragePath:
              resolvedInternalImageSource?.previewStoragePath ??
              mediaLibraryImagePayload?.previewStoragePath ??
              matchedOutput?.previewStoragePath ??
              null,
            fullStoragePath:
              mediaLibraryImagePayload?.fullStoragePath ?? matchedOutput?.fullStoragePath ?? null,
            referenceUrl: transferReferenceUrl ?? null,
            referenceRenderUrl: transferRenderUrl ?? null,
            imageUrl: normalizedImageUrl,
            submissionImageUrl: normalizedSubmissionImageUrl,
            imageFallbackUrls: orderedImageUrls.slice(1),
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
      })();
    },
    [
      agentSessionEnabled,
      ensureAgentSession,
      findOutputById,
      insertAttachment,
      maxImageAttachmentsPerDrop,
      promoteAttachmentToDurableSource,
      registerOwnedObjectUrl,
      resolveInternalImageDropSource,
      resolveOutputPreviewUrlById,
    ]
  );

  const handleRemoveAgentAttachment = useCallback(
    (id: string) => {
      setAgentAttachmentError(null);
      setAgentAttachments((prev) => {
        const removedAttachment = prev.find((item) => item.id === id);
        revokeOwnedAttachmentUrls(removedAttachment ?? null);
        recordCreateWorkflowEvent("attachment_removed", {
          attachmentId: removedAttachment?.id ?? id,
          attachment: removedAttachment
            ? summarizeCreateWorkflowAttachment(removedAttachment)
            : null,
        });
        return prev.filter((item) => item.id !== id);
      });
    },
    [revokeOwnedAttachmentUrls]
  );

  const handleClearAgentAttachments = useCallback(() => {
    setAgentAttachmentError(null);
    setAgentAttachments((prev) => {
      recordCreateWorkflowEvent("attachments_cleared", {
        attachmentIds: prev.map((attachment) => attachment.id),
      });
      prev.forEach((attachment) => revokeOwnedAttachmentUrls(attachment));
      return [];
    });
  }, [revokeOwnedAttachmentUrls]);

  const handleAgentInputChange = useCallback(
    (value: string) => {
      if (agentAttachmentError) {
        setAgentAttachmentError(null);
      }
      setAgentInput(value);
    },
    [agentAttachmentError]
  );

  const resetAgentComposer = useCallback(
    (options?: ResetAgentComposerOptions) => {
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
          prev.forEach((attachment) => revokeOwnedAttachmentUrls(attachment));
          return [];
        });
      }
      setIsAgentDropActive(false);
      agentDropDepthRef.current = 0;
    },
    [revokeOwnedAttachmentUrls]
  );

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
