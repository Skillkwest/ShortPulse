import type { AgentAttachment, AgentAttachmentDeliveryStatus } from "../../../prefabs/agent/types";
import {
  buildAgentAttachmentImageCandidates,
  normalizeAttachmentImageUrl,
} from "./agentAttachmentImage";

export type ComposerImageAttachmentPreviewSource =
  | "legacy_image_url"
  | "legacy_fallback_url"
  | "local_upload_blob"
  | "data_url";

export type ComposerImageAttachmentPreview = {
  url: string;
  source: ComposerImageAttachmentPreviewSource;
};

export type ComposerImageAttachmentIdentity = {
  referenceId: string | null;
  mediaId: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  referenceUrl: string | null;
};

export type ComposerImageAttachment = {
  id: string;
  kind: "image";
  preview: ComposerImageAttachmentPreview;
  identity: ComposerImageAttachmentIdentity;
  text: string | null;
  aspect: string | null;
  deliveryStatus: AgentAttachmentDeliveryStatus;
  deliveryError: string | null;
};

const resolvePreviewSource = (
  url: string,
  isPrimaryImageUrl: boolean
): ComposerImageAttachmentPreviewSource => {
  if (url.startsWith("blob:")) return "local_upload_blob";
  if (url.startsWith("data:")) return "data_url";
  return isPrimaryImageUrl ? "legacy_image_url" : "legacy_fallback_url";
};

export const resolveComposerImageAttachmentPreview = (
  attachment: Pick<
    AgentAttachment,
    "kind" | "imageUrl" | "imageFallbackUrls" | "referenceRenderUrl" | "referenceUrl"
  >
): ComposerImageAttachmentPreview | null => {
  if (attachment.kind !== "image") return null;
  const primaryImageUrl = normalizeAttachmentImageUrl(attachment.imageUrl);
  if (primaryImageUrl) {
    return {
      url: primaryImageUrl,
      source: resolvePreviewSource(primaryImageUrl, true),
    };
  }
  const legacyFallbackUrl = buildAgentAttachmentImageCandidates(attachment)[0] ?? null;
  if (!legacyFallbackUrl) return null;
  return {
    url: legacyFallbackUrl,
    source: resolvePreviewSource(legacyFallbackUrl, false),
  };
};

export const projectAgentAttachmentToComposerImageAttachment = (
  attachment: AgentAttachment
): ComposerImageAttachment | null => {
  if (attachment.kind !== "image") return null;
  const preview = resolveComposerImageAttachmentPreview(attachment);
  if (!preview) return null;
  return {
    id: attachment.id,
    kind: "image",
    preview,
    identity: {
      referenceId: attachment.referenceId ?? null,
      mediaId: attachment.mediaId ?? null,
      previewStoragePath: attachment.previewStoragePath ?? null,
      fullStoragePath: attachment.fullStoragePath ?? null,
      referenceUrl: attachment.referenceUrl ?? null,
    },
    text: attachment.text ?? null,
    aspect: attachment.aspect ?? null,
    deliveryStatus: attachment.deliveryStatus ?? "pending",
    deliveryError: attachment.deliveryError ?? null,
  };
};

export const hasComposerImageAttachmentPreview = (
  attachment: Pick<
    AgentAttachment,
    | "kind"
    | "imageUrl"
    | "imageFallbackUrls"
    | "referenceRenderUrl"
    | "referenceUrl"
    | "id"
    | "referenceId"
    | "mediaId"
    | "previewStoragePath"
    | "fullStoragePath"
    | "text"
    | "aspect"
    | "deliveryStatus"
    | "deliveryError"
  >
): boolean =>
  Boolean(projectAgentAttachmentToComposerImageAttachment(attachment as AgentAttachment));
