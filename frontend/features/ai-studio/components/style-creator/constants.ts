/**
 * Shared constants for the styles-library creator domain.
 */
export const STYLE_PREVIEW_OUTPUT_SIZE_PX = 512;
export const CUSTOM_STYLE_NAME_PREFIX = "Custom Style";
export const IMAGE_FILE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|webp)$/i;

export const STYLE_DROP_HINT_TRANSFER_TYPES = new Set([
  "Files",
  "text/plain",
  "text/reference-url",
  "text/reference-id",
  "text/reference-origin",
  "image/url",
  "text/uri-list",
]);

export const BLOCKED_STYLE_IMAGE_SOURCE_ERROR = "blocked-style-image-source";
export const BLOCKED_STYLE_IMAGE_SOURCE_MESSAGE =
  "This image source blocks browser access. Download the image and drop the file directly.";

export const STYLE_EXTRACTION_TELEMETRY_SOURCE = "telemetry.ai_studio.style_extraction";
export const STYLE_EXTRACTION_TELEMETRY_FAMILY = "style_extraction";
