/**
 * Style-source drop capture helpers.
 * Captures the browser drag payload synchronously and exposes the minimal gate checks.
 */
import {
  getInternalReferenceDragSessionToken,
  INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE,
  INTERNAL_REFERENCE_DRAG_SESSION_TYPE,
} from "../../../../lib/internalReferenceDragSession";
import { STYLE_DROP_HINT_TRANSFER_TYPES } from "./constants";
import { getNormalizedTransferTypes } from "../../utils/dragDrop";

export const REFERENCE_RENDER_URL_TRANSFER_TYPE = "text/reference-render-url";

export type StyleDropSnapshot = {
  transferTypes: string[];
  files: File[];
  internalReferenceDragToken: string;
  referenceOrigin: string;
  referenceVersion: string;
  referenceOutputId: string;
  referenceMediaId: string;
  referenceImageIndex: string;
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
  referenceOrigin: transfer.getData("text/reference-origin"),
  referenceVersion: transfer.getData("text/reference-version"),
  referenceOutputId: transfer.getData("text/reference-output-id"),
  referenceMediaId: transfer.getData("text/reference-media-id"),
  referenceImageIndex: transfer.getData("text/reference-image-index"),
  referenceSourceSurface: transfer.getData("text/reference-source-surface"),
  referenceUrl: transfer.getData("text/reference-url"),
  referenceRenderUrl: transfer.getData(REFERENCE_RENDER_URL_TRANSFER_TYPE),
  imageUrl: transfer.getData("image/url"),
  plainText: transfer.getData("text/plain"),
  uriList: transfer.getData("text/uri-list"),
});

const hasStyleReorderTransfer = (transfer: DataTransfer | null | undefined): boolean => {
  if (!transfer) return false;
  return Array.from(transfer.types ?? []).includes("text/style-library-id");
};

/**
 * Returns true when a transfer payload should be accepted for style intake.
 */
export const canAcceptStyleLibraryImageDropHint = (
  transfer: DataTransfer | null | undefined
): boolean => {
  if (!transfer || hasStyleReorderTransfer(transfer)) return false;
  const transferTypes = Array.from(transfer.types ?? []);
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
        case INTERNAL_REFERENCE_DRAG_SESSION_TYPE:
        case INTERNAL_REFERENCE_DRAG_SESSION_TEXT_TYPE:
          return snapshot.internalReferenceDragToken;
        case "text/reference-version":
          return snapshot.referenceVersion;
        case "text/reference-output-id":
          return snapshot.referenceOutputId;
        case "text/reference-media-id":
          return snapshot.referenceMediaId;
        case "text/reference-image-index":
          return snapshot.referenceImageIndex;
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
