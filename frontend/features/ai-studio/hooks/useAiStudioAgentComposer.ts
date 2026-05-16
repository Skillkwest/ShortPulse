import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { randomId } from "../logic/ids";
import {
  buildAgentAttachmentImageCandidates,
  normalizeAttachmentImageUrl,
  resolveAgentAttachmentPreviewUrl,
} from "../logic/agentAttachmentImage";
import { readMediaLibraryDragPayload } from "../logic/mediaLibraryDragPayload";
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

const buildResolvedInternalImageUrls = (candidates: Array<string | null | undefined>) =>
  buildAgentAttachmentImageCandidates({
    imageUrl: candidates[0] ?? null,
    imageFallbackUrls: resolveDroppedImageUrls(candidates.slice(1)),
    referenceRenderUrl: null,
    referenceUrl: null,
  });

const canCreateObjectUrl = () =>
  typeof URL !== "undefined" && typeof URL.createObjectURL === "function";

const materializeComposerPreviewBlobUrl = async (args: {
  displayArtifactUrl: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  referenceUrl?: string | null;
}): Promise<{ url: string; owned: boolean } | null> => {
  const displayArtifactUrl = normalizeDroppedImageCandidate(args.displayArtifactUrl);
  if (displayArtifactUrl?.startsWith("blob:")) {
    return { url: displayArtifactUrl, owned: false };
  }
  const durableReferenceUrl = normalizeDurableDroppedImageCandidate(args.referenceUrl);
  const hasDurableIdentity =
    Boolean(args.previewStoragePath?.trim()) ||
    Boolean(args.fullStoragePath?.trim()) ||
    Boolean(durableReferenceUrl);
  if (!canCreateObjectUrl()) {
    return displayArtifactUrl?.startsWith("data:")
      ? { url: displayArtifactUrl, owned: false }
      : null;
  }
  const resolvedSource = displayArtifactUrl?.startsWith("data:")
    ? displayArtifactUrl
    : hasDurableIdentity
      ? await resolveAgentAttachmentPreviewUrl({
          previewStoragePath: args.previewStoragePath ?? null,
          fullStoragePath: args.fullStoragePath ?? null,
          referenceRenderUrl: null,
          referenceUrl: durableReferenceUrl,
          imageUrl: null,
        }).catch(() => null)
      : displayArtifactUrl;
  if (!resolvedSource) return null;
  if (resolvedSource.startsWith("blob:") || resolvedSource.startsWith("data:")) {
    return { url: resolvedSource, owned: false };
  }
  try {
    const response = await fetch(resolvedSource);
    if (!response.ok) return null;
    const blob = await response.blob();
    if (!(blob instanceof Blob) || blob.size <= 0) return null;
    return { url: URL.createObjectURL(blob), owned: true };
  } catch {
    return null;
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
            existingAttachment.imageUrl !== normalizedAttachment.imageUrl
          ) {
            revokeOwnedObjectUrl(existingAttachment.imageUrl);
          }
          const replacementAttachment: AgentAttachment = {
            ...existingAttachment,
            ...normalizedAttachment,
            id: existingAttachment.id,
            deliveryStatus: normalizedAttachment.deliveryStatus ?? "pending",
            deliveryError: normalizedAttachment.deliveryError ?? null,
          };
          return prev.map((attachment, index) =>
            index === existingIndex ? replacementAttachment : attachment
          );
        }
        let next = [...prev, normalizedAttachment];
        if (nextAttachment.kind === "image") {
          const imageCount = next.filter((item) => item.kind === "image").length;
          if (imageCount > MAX_AGENT_IMAGE_ATTACHMENTS) {
            const oldestImageIndex = next.findIndex((item) => item.kind === "image");
            if (oldestImageIndex >= 0) {
              const removedAttachment = next[oldestImageIndex];
              if (removedAttachment?.kind === "image") {
                revokeOwnedObjectUrl(removedAttachment.imageUrl);
              }
              next = next.filter((_, index) => index !== oldestImageIndex);
            }
          }
        }
        if (next.length > MAX_AGENT_ATTACHMENTS) {
          const trimmedNext = next.slice(next.length - MAX_AGENT_ATTACHMENTS);
          next
            .filter((attachment) => !trimmedNext.includes(attachment))
            .forEach((attachment) => {
              if (attachment.kind === "image") {
                revokeOwnedObjectUrl(attachment.imageUrl);
              }
            });
          next = trimmedNext;
        }
        return next;
      });
      setAgentAttachmentError(null);
    },
    [revokeOwnedObjectUrl]
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
      if (droppedVideoFiles.length > 0) {
        setAgentAttachmentError(VIDEO_ATTACHMENT_REJECTION_MESSAGE);
        return;
      }
      if (droppedImageFiles.length > 0) {
        if (!agentSessionEnabled) {
          ensureAgentSession();
        }
        setAgentAttachmentError(null);
        droppedImageFiles.forEach((file) => {
          const objectUrl = URL.createObjectURL(file);
          registerOwnedObjectUrl(objectUrl);
          insertAttachment({
            id: randomId(),
            kind: "image",
            referenceId: null,
            imageUrl: objectUrl,
            text: null,
            aspect: null,
          });
        });
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
          if (normalizedInternalImageUrl) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            registerOwnedObjectUrl(normalizedInternalImageUrl);
            insertAttachment({
              id: randomId(),
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
              imageUrl: normalizedInternalImageUrl,
              imageFallbackUrls: internalImageUrls.slice(1),
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
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
            if (materializedPreview.owned) {
              registerOwnedObjectUrl(materializedPreview.url);
            }
            insertAttachment({
              id: randomId(),
              kind: "image",
              referenceId: droppedReferenceId,
              mediaId: composerImagePayload.mediaId ?? null,
              previewStoragePath: composerImagePayload.previewStoragePath ?? null,
              fullStoragePath: composerImagePayload.fullStoragePath ?? null,
              referenceUrl: durableReferenceUrl,
              referenceRenderUrl: null,
              imageUrl: materializedPreview.url,
              imageFallbackUrls: [],
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
            });
            return;
          }
          if (hasDurableIdentity) {
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
              referenceRenderUrl: null,
              imageUrl: null,
              imageFallbackUrls: [],
              text: normalizedPromptText,
              aspect: matchedOutput?.aspect ?? null,
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

          if (normalizedInternalImageUrl) {
            if (!agentSessionEnabled) {
              ensureAgentSession();
            }
            setAgentAttachmentError(null);
            registerOwnedObjectUrl(normalizedInternalImageUrl);
            insertAttachment({
              id: randomId(),
              kind: "image",
              referenceId: droppedReferenceId,
              mediaId: resolvedInternalImageSource?.mediaId ?? internalPayload.mediaId ?? null,
              previewStoragePath: resolvedInternalImageSource?.previewStoragePath ?? null,
              fullStoragePath: resolvedInternalImageSource?.fullStoragePath ?? null,
              referenceUrl: null,
              referenceRenderUrl: null,
              imageUrl: normalizedInternalImageUrl,
              imageFallbackUrls: internalImageUrls.slice(1),
              text: internalPromptText,
              aspect: matchedOutput?.aspect ?? null,
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
        const orderedImageUrls = Array.from(
          new Set([...normalizedImageUrls, ...fallbackImageUrls].filter(Boolean))
        );
        const normalizedImageUrl = orderedImageUrls[0] ?? null;
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
        if (removedAttachment?.kind === "image") {
          revokeOwnedObjectUrl(removedAttachment.imageUrl);
        }
        return prev.filter((item) => item.id !== id);
      });
    },
    [revokeOwnedObjectUrl]
  );

  const handleClearAgentAttachments = useCallback(() => {
    setAgentAttachmentError(null);
    setAgentAttachments((prev) => {
      prev.forEach((attachment) => {
        if (attachment.kind === "image") {
          revokeOwnedObjectUrl(attachment.imageUrl);
        }
      });
      return [];
    });
  }, [revokeOwnedObjectUrl]);

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
          prev.forEach((attachment) => {
            if (attachment.kind === "image") {
              revokeOwnedObjectUrl(attachment.imageUrl);
            }
          });
          return [];
        });
      }
      setIsAgentDropActive(false);
      agentDropDepthRef.current = 0;
    },
    [revokeOwnedObjectUrl]
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
