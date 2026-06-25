/**
 * Captures AI Studio drag/drop payloads synchronously and rebuilds a stable
 * transfer-like adapter for downstream parsers after the browser event ends.
 */
import { getMediaLibraryDragTypes } from "./mediaLibraryDragPayload";
import {
  AI_STUDIO_REFERENCE_DROP_TRANSFER_TYPES,
  REFERENCE_TRANSFER_ID_TYPE,
  REFERENCE_TRANSFER_MEDIA_ID_TYPE,
  REFERENCE_TRANSFER_ORIGIN_TYPE,
  REFERENCE_TRANSFER_OUTPUT_ID_TYPE,
  REFERENCE_TRANSFER_RENDER_URL_TYPE,
  REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE,
  REFERENCE_TRANSFER_URL_TYPE,
} from "../../../lib/internalReferenceDragPayload";

export type AiStudioDropSnapshot = {
  transferTypes: string[];
  files: File[];
  data: Record<string, string>;
};

const MEDIA_LIBRARY_FALLBACK_TRANSFER_TYPES = [
  "text/shortpulse-media-library-marker",
  "text/shortpulse-media-library-kind",
  "text/shortpulse-media-library-id",
  "text/shortpulse-media-library-url",
  "text/shortpulse-media-library-file-type",
  "text/shortpulse-media-library-created-at",
  "text/shortpulse-media-library-origin-folder-id",
  "text/shortpulse-media-library-filename",
  "text/shortpulse-media-library-source",
  "text/shortpulse-media-library-preview-storage-path",
  "text/shortpulse-media-library-full-storage-path",
  "text/shortpulse-media-library-preview-url",
  "text/shortpulse-media-library-preview-poster-url",
  "text/shortpulse-media-library-preview-poster-storage-path",
  "text/shortpulse-media-library-full-url",
  "text/shortpulse-media-library-companion-art-url",
  "text/shortpulse-media-library-companion-art-storage-path",
  "text/shortpulse-media-library-audio-source-mode",
  "text/shortpulse-media-library-duration-ms",
  "text/shortpulse-media-library-waveform-peaks",
  "text/shortpulse-media-library-width",
  "text/shortpulse-media-library-height",
  "text/shortpulse-media-library-prompt",
  "text/shortpulse-media-library-transcript",
  "text/shortpulse-media-library-title",
] as const;

const GENERIC_TEXT_TRANSFER_TYPES = [
  "text/plain",
  "text",
  "text/prompt",
  "text/uri-list",
  "text/html",
] as const;

const URLISH_PATTERN = /^(?:data:(?:image|video|audio)\/|blob:|https?:\/\/)/i;

const KNOWN_AI_STUDIO_DROP_TRANSFER_TYPES = [
  ...getMediaLibraryDragTypes(),
  ...MEDIA_LIBRARY_FALLBACK_TRANSFER_TYPES,
  ...AI_STUDIO_REFERENCE_DROP_TRANSFER_TYPES,
  ...GENERIC_TEXT_TRANSFER_TYPES,
] as const;

const safeGetTransferData = (transfer: Pick<DataTransfer, "getData">, type: string): string => {
  try {
    return transfer.getData(type) || "";
  } catch {
    return "";
  }
};

const normalizeTransferTypes = (types: DataTransfer["types"] | readonly string[] | undefined) =>
  Array.from(types ?? []).map((type) => String(type));

const buildCaptureTypeList = (transferTypes: readonly string[]): string[] =>
  Array.from(new Set([...transferTypes, ...KNOWN_AI_STUDIO_DROP_TRANSFER_TYPES]));

/**
 * Captures all AI Studio drag metadata needed by structured drop resolvers.
 */
export const captureAiStudioDropSnapshot = (transfer: DataTransfer): AiStudioDropSnapshot => {
  const transferTypes = normalizeTransferTypes(transfer.types);
  const data: Record<string, string> = {};
  buildCaptureTypeList(transferTypes).forEach((type) => {
    data[type] = safeGetTransferData(transfer, type);
  });
  return {
    transferTypes,
    files: Array.from(transfer.files ?? []),
    data,
  };
};

/**
 * Rebuilds a stable transfer-like adapter from a captured AI Studio drop snapshot.
 */
export const buildAiStudioDropSnapshotTransfer = (snapshot: AiStudioDropSnapshot): DataTransfer =>
  ({
    types: snapshot.transferTypes,
    files: snapshot.files,
    getData: (type: string) => snapshot.data[type] ?? "",
  }) as unknown as DataTransfer;

/**
 * Returns true when the snapshot carries app-owned structured drag hints.
 */
export const hasAiStudioStructuredDropHints = (snapshot: AiStudioDropSnapshot): boolean => {
  const normalizedTypes = snapshot.transferTypes.map((type) => type.trim().toLowerCase());
  if (
    normalizedTypes.some(
      (type) =>
        type.startsWith("application/x-shortpulse-") ||
        type.startsWith("text/shortpulse-media-library-") ||
        type.startsWith("text/reference-") ||
        type === "image/url"
    )
  ) {
    return true;
  }

  const structuredValues = [
    snapshot.data[REFERENCE_TRANSFER_ORIGIN_TYPE],
    snapshot.data[REFERENCE_TRANSFER_ID_TYPE],
    snapshot.data[REFERENCE_TRANSFER_OUTPUT_ID_TYPE],
    snapshot.data[REFERENCE_TRANSFER_MEDIA_ID_TYPE],
    snapshot.data[REFERENCE_TRANSFER_SOURCE_SURFACE_TYPE],
    snapshot.data[REFERENCE_TRANSFER_URL_TYPE],
    snapshot.data[REFERENCE_TRANSFER_RENDER_URL_TYPE],
    snapshot.data["image/url"],
    snapshot.data["text/shortpulse-media-library-marker"],
    snapshot.data["text/shortpulse-media-library-kind"],
    snapshot.data["text/shortpulse-media-library-id"],
  ];
  if (structuredValues.some((value) => value?.trim())) return true;

  const plainText = snapshot.data["text/plain"]?.trim();
  const uriList = snapshot.data["text/uri-list"]?.trim();
  return Boolean(
    (plainText && URLISH_PATTERN.test(plainText)) || (uriList && URLISH_PATTERN.test(uriList))
  );
};
