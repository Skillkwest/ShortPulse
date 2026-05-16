/**
 * Style-source drop capture helpers.
 * Captures the browser drag payload synchronously and exposes the minimal gate checks.
 */
import {
  getComposerImageDropSessionToken,
  COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_SESSION_TYPE,
  getInternalReferenceDragSessionToken,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../../lib/internalReferenceDragSession";
import {
  COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE,
  COMPOSER_IMAGE_DROP_PAYLOAD_TYPE,
} from "../../../../lib/internalReferenceDragPayload";
import { STYLE_DROP_HINT_TRANSFER_TYPES } from "./constants";
import { getNormalizedTransferTypes } from "../../utils/dragDrop";

export const REFERENCE_RENDER_URL_TRANSFER_TYPE = "text/reference-render-url";
export const REFERENCE_PREVIEW_STORAGE_PATH_TRANSFER_TYPE = "text/reference-preview-storage-path";
export const REFERENCE_FULL_STORAGE_PATH_TRANSFER_TYPE = "text/reference-full-storage-path";

export type StyleDropSnapshot = {
  transferTypes: string[];
  files: File[];
  internalReferenceDragToken: string;
  composerImageDropToken: string;
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

/**
 * Captures the Styles-relevant drop payload synchronously while the browser event is still live.
 */
export const captureStyleDropSnapshot = (transfer: DataTransfer): StyleDropSnapshot => ({
  transferTypes: getNormalizedTransferTypes(transfer),
  files: Array.from(transfer.files ?? []),
  internalReferenceDragToken: getInternalReferenceDragSessionToken(transfer) ?? "",
  composerImageDropToken: getComposerImageDropSessionToken(transfer) ?? "",
  composerImageDropPayload:
    transfer.getData(COMPOSER_IMAGE_DROP_PAYLOAD_TYPE) ||
    transfer.getData(COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE),
  referenceOrigin: transfer.getData("text/reference-origin"),
  referenceVersion: transfer.getData("text/reference-version"),
  referenceId: transfer.getData("text/reference-id"),
  referenceOutputId: transfer.getData("text/reference-output-id"),
  referenceMediaId: transfer.getData("text/reference-media-id"),
  referenceMediaKind: transfer.getData("text/reference-media-kind"),
  referencePreviewStoragePath: transfer.getData(REFERENCE_PREVIEW_STORAGE_PATH_TRANSFER_TYPE),
  referenceFullStoragePath: transfer.getData(REFERENCE_FULL_STORAGE_PATH_TRANSFER_TYPE),
  referenceImageIndex: transfer.getData("text/reference-image-index"),
  referenceWidth: transfer.getData("text/reference-width"),
  referenceHeight: transfer.getData("text/reference-height"),
  referenceSourceSurface: transfer.getData("text/reference-source-surface"),
  referenceUrl: transfer.getData("text/reference-url"),
  referenceRenderUrl: transfer.getData(REFERENCE_RENDER_URL_TRANSFER_TYPE),
  imageUrl: transfer.getData("image/url"),
  plainText: transfer.getData("text/plain"),
  uriList: transfer.getData("text/uri-list"),
});

const hasStyleReorderTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  return getNormalizedTransferTypes(transfer).includes("text/style-library-id");
};

/**
 * Returns true when a transfer payload should be accepted for style intake.
 */
export const canAcceptStyleLibraryImageDropHint = (
  transfer: DataTransfer | null | undefined
): boolean => {
  if (!transfer || hasStyleReorderTransfer(transfer)) return false;
  const transferTypes = getNormalizedTransferTypes(transfer);
  return transferTypes.some((type) => STYLE_DROP_HINT_TRANSFER_TYPES.has(type));
};

/**
 * Rehydrates a transfer-like object from a captured snapshot for downstream parsers.
 */
export const buildStyleDropSnapshotTransfer = (snapshot: StyleDropSnapshot): DataTransfer =>
  ({
    types: snapshot.transferTypes,
    files: snapshot.files,
    getData: (type: string) => {
      switch (type) {
        case "text/reference-origin":
          return snapshot.referenceOrigin;
        case COMPOSER_IMAGE_DROP_SESSION_TYPE:
        case COMPOSER_IMAGE_DROP_SESSION_TEXT_TYPE:
          return snapshot.composerImageDropToken;
        case INTERNAL_REFERENCE_DRAG_SESSION_TYPE:
        case INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE:
          return snapshot.internalReferenceDragToken;
        case COMPOSER_IMAGE_DROP_PAYLOAD_TYPE:
        case COMPOSER_IMAGE_DROP_PAYLOAD_TEXT_TYPE:
          return snapshot.composerImageDropPayload;
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
        case REFERENCE_PREVIEW_STORAGE_PATH_TRANSFER_TYPE:
          return snapshot.referencePreviewStoragePath;
        case REFERENCE_FULL_STORAGE_PATH_TRANSFER_TYPE:
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
        case REFERENCE_RENDER_URL_TRANSFER_TYPE:
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
