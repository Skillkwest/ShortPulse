/**
 * Shared detail-modal helpers for populated product reference slots.
 * Keeps Character and Elements slot previews on the common media-detail shell
 * without requiring a Media Library row or persisted page-level selection target.
 */
import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailItemBase,
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailSurface,
} from "../components/detail-modal/detailModalPlatformTypes";
import {
  downloadReferenceProviderBlob,
  downloadBlobToFile,
  downloadUrlToFile,
} from "./referenceDownload";

export type SlotReferenceDetailSurface = Extract<
  SharedMediaDetailSurface,
  "character-media-panel" | "elements-media-panel"
>;

export type SlotReferenceDetailModalItem = SharedMediaDetailItemBase & {
  surface: SlotReferenceDetailSurface;
  selectionTarget: Extract<SharedMediaDetailSelectionTarget, { kind: "slot-reference" }>;
};

const SLOT_REFERENCE_DETAIL_CAPABILITIES: SharedMediaDetailCapabilities = {
  canSaveToLibrary: false,
  canDownload: true,
  canDelete: false,
  canEditPrompt: false,
  canSavePrompt: false,
  canShowCharacterContext: false,
  canShowStyleContext: false,
};

const normalizeText = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const filenameFromPath = (value: string | null | undefined): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const filename = normalized.split("/").pop()?.trim();
  return filename || null;
};

export const createSlotReferenceDetailModalItem = ({
  surface,
  slotId,
  title,
  url,
  previewUrl = null,
  fullUrl = null,
  previewStoragePath = null,
  fullStoragePath = null,
  filename = null,
}: {
  surface: SlotReferenceDetailSurface;
  slotId: string;
  title: string;
  url: string | null | undefined;
  previewUrl?: string | null;
  fullUrl?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  filename?: string | null;
}): SlotReferenceDetailModalItem | null => {
  const normalizedTitle = normalizeText(title) ?? "Reference image";
  const normalizedUrl = normalizeText(url) ?? normalizeText(fullUrl) ?? normalizeText(previewUrl);
  if (!normalizedUrl) return null;
  const normalizedFullUrl = normalizeText(fullUrl);
  const normalizedPreviewUrl = normalizeText(previewUrl);
  const resolvedFilename =
    normalizeText(filename) ??
    filenameFromPath(fullStoragePath) ??
    filenameFromPath(previewStoragePath) ??
    `${normalizedTitle}.png`;

  return {
    surface,
    selectionTarget: {
      kind: "slot-reference",
      slotId,
      surface,
    },
    capabilities: SLOT_REFERENCE_DETAIL_CAPABILITIES,
    media: {
      id: slotId,
      kind: "image",
      url: normalizedUrl,
      filename: resolvedFilename,
      source: "slot_reference",
      previewStoragePath: normalizeText(previewStoragePath),
      fullStoragePath: normalizeText(fullStoragePath),
      previewUrl: normalizedPreviewUrl,
      fullUrl: normalizedFullUrl,
    },
    presentation: {
      title: normalizedTitle,
      kindLabel: "Image",
      topBarItems: [
        { label: "Image", className: "art-meta-item" },
        {
          label: normalizedTitle,
          className: "art-meta-item art-meta-filename",
          title: normalizedTitle,
        },
      ],
      bladePlaceholder: "No prompt metadata available.",
    },
  };
};

const resolveSlotReferenceDownloadUrl = (item: SlotReferenceDetailModalItem): string | null =>
  normalizeText(item.media.fullUrl) ??
  normalizeText(item.media.url) ??
  normalizeText(item.media.previewUrl);

export const downloadSlotReferenceDetailItem = async (item: SlotReferenceDetailModalItem) => {
  const downloadUrl = resolveSlotReferenceDownloadUrl(item);
  if (!downloadUrl) return;
  const filename = item.media.filename ?? item.presentation?.title ?? "reference";
  try {
    const blob = await downloadReferenceProviderBlob({ url: downloadUrl });
    downloadBlobToFile(blob, filename);
    return;
  } catch {
    downloadUrlToFile(downloadUrl, filename);
  }
};
