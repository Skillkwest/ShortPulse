/**
 * Clipboard and paste-surface parsing helpers for the Reference Grid.
 * Keeps URL/media/text normalization logic isolated from component rendering.
 */
export type PastedMediaReference = {
  url: string;
  mimeType?: string | null;
};

export type ClipboardMediaUrlReference = {
  url: string;
  mimeType?: string | null;
};

const IMAGE_URL_PATTERN = /\.(avif|bmp|gif|heic|heif|jpe?g|png|svg|webp)(?:[?#].*)?$/i;
const VIDEO_URL_PATTERN = /\.(m4v|mov|mp4|ogg|ogv|webm)(?:[?#].*)?$/i;
const IMAGE_EXTENSION_TO_MIME: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};
const VIDEO_EXTENSION_TO_MIME: Record<string, string> = {
  m4v: "video/mp4",
  mov: "video/quicktime",
  mp4: "video/mp4",
  ogg: "video/ogg",
  ogv: "video/ogg",
  webm: "video/webm",
};

/**
 * Trims clipboard text to a stable comparable value.
 */
export const normalizeClipboardText = (value: string): string => value.trim();

/**
 * Parses an HTTP(S), data, or blob URL candidate from clipboard text.
 */
export const parseUrlCandidate = (value: string): string | null => {
  const candidate = normalizeClipboardText(value);
  if (!candidate || (typeof window !== "undefined" && candidate === window.location.href))
    return null;
  if (/^data:(image|video)\//i.test(candidate)) return candidate;
  if (/^blob:/i.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
};

/**
 * Returns true when a URL points to image/video media.
 */
export const isMediaUrl = (url: string): boolean =>
  /^data:(image|video)\//i.test(url) || IMAGE_URL_PATTERN.test(url) || VIDEO_URL_PATTERN.test(url);

/**
 * Extracts dropped prompt text while ignoring dropped media URLs.
 */
export const extractDroppedPromptText = (transfer: DataTransfer): string | null => {
  const promptText = normalizeClipboardText(
    transfer.getData("text/prompt") || transfer.getData("text/plain")
  );
  if (!promptText) return null;
  const parsedUrl = parseUrlCandidate(promptText);
  if (parsedUrl && isMediaUrl(parsedUrl)) return null;
  return promptText;
};

/**
 * Infers MIME type from filename extension.
 */
export const inferMimeTypeFromFilename = (filename: string): string | null => {
  const normalized = filename.trim().toLowerCase();
  const extension = normalized.includes(".") ? (normalized.split(".").pop() ?? "") : "";
  if (!extension) return null;
  return IMAGE_EXTENSION_TO_MIME[extension] ?? VIDEO_EXTENSION_TO_MIME[extension] ?? null;
};

/**
 * Normalizes media MIME type to image/video values only.
 */
export const normalizeMediaMimeType = (mimeType: string | null | undefined): string | null => {
  if (!mimeType) return null;
  const normalized = mimeType.trim().toLowerCase();
  if (!normalized) return null;
  return normalized.startsWith("image/") || normalized.startsWith("video/") ? normalized : null;
};

/**
 * Normalizes clipboard files to image/video Files with explicit MIME.
 */
export const normalizeMediaFile = (
  file: File | null,
  fallbackMimeType?: string | null,
  index: number = 0
): File | null => {
  if (!file) return null;
  const resolvedMimeType =
    normalizeMediaMimeType(file.type) ??
    normalizeMediaMimeType(fallbackMimeType) ??
    inferMimeTypeFromFilename(file.name);
  if (!resolvedMimeType) return null;
  if (file.type === resolvedMimeType && file.type.length > 0) {
    return file;
  }
  const extension =
    Object.entries({ ...IMAGE_EXTENSION_TO_MIME, ...VIDEO_EXTENSION_TO_MIME }).find(
      ([, mimeType]) => mimeType === resolvedMimeType
    )?.[0] ?? (resolvedMimeType.startsWith("image/") ? "png" : "mp4");
  const normalizedName = file.name?.trim() || `pasted-media-${index + 1}.${extension}`;
  return new File([file], normalizedName, {
    type: resolvedMimeType,
    lastModified: file.lastModified,
  });
};

/**
 * Removes duplicate media files by stable file signature.
 */
export const dedupeMediaFiles = (files: File[]): File[] => {
  const seen = new Set<string>();
  const deduped: File[] = [];
  files.forEach((file) => {
    const signature = `${file.name}|${file.size}|${file.type}|${file.lastModified}`;
    if (seen.has(signature)) return;
    seen.add(signature);
    deduped.push(file);
  });
  return deduped;
};

/**
 * Collects media files from clipboard items/files and normalizes MIME metadata.
 */
export const collectClipboardMediaFiles = (clipboardData: DataTransfer): File[] => {
  const clipboardItems = Array.from(clipboardData.items || []);
  const directFiles = Array.from(clipboardData.files || [])
    .map((file, index) => normalizeMediaFile(file, clipboardItems[index]?.type, index))
    .filter((file): file is File => Boolean(file));
  if (directFiles.length > 0) {
    return dedupeMediaFiles(directFiles);
  }
  const itemFiles = clipboardItems
    .filter((item) => item.kind === "file")
    .map((item, index) => normalizeMediaFile(item.getAsFile(), item.type, index))
    .filter((file): file is File => Boolean(file));
  return dedupeMediaFiles(itemFiles);
};

/**
 * Parses media URL references from `text/uri-list` payloads.
 */
export const getMediaReferenceFromUriList = (
  uriList: string
): ClipboardMediaUrlReference | null => {
  const entries = uriList
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
  for (const entry of entries) {
    const parsed = parseUrlCandidate(entry);
    if (parsed && isMediaUrl(parsed)) {
      return {
        url: parsed,
        mimeType: inferClipboardMimeTypeFromUrl(parsed),
      };
    }
  }
  return null;
};

/**
 * Parses media URL references from HTML clipboard payloads.
 */
export const getMediaReferenceFromHtml = (html: string): ClipboardMediaUrlReference | null => {
  const trimmed = html.trim();
  if (!trimmed) return null;
  if (typeof DOMParser === "undefined") return null;
  const documentFragment = new DOMParser().parseFromString(trimmed, "text/html");
  const candidateNodes = Array.from(
    documentFragment.querySelectorAll("img[src],video[src],source[src],a[href]")
  );
  for (const node of candidateNodes) {
    const tagName = node.tagName.toLowerCase();
    const raw =
      node.getAttribute("src") ??
      node.getAttribute("href") ??
      (node instanceof HTMLAnchorElement ? node.href : "");
    if (!raw) continue;
    const parsed = parseUrlCandidate(raw);
    if (!parsed) continue;
    const declaredMimeType = normalizeMediaMimeType(node.getAttribute("type"));
    if (tagName === "img") {
      return { url: parsed, mimeType: declaredMimeType ?? "image/*" };
    }
    if (tagName === "video" || tagName === "source") {
      return { url: parsed, mimeType: declaredMimeType ?? "video/*" };
    }
    if (isMediaUrl(parsed)) {
      return {
        url: parsed,
        mimeType: declaredMimeType ?? inferClipboardMimeTypeFromUrl(parsed),
      };
    }
  }
  return null;
};

/**
 * Infers wildcard clipboard media MIME type from URL/extension.
 */
export const inferClipboardMimeTypeFromUrl = (url: string): string | null => {
  if (/^data:image\//i.test(url)) {
    const mime = url.slice(5, url.indexOf(";"));
    return mime || "image/*";
  }
  if (/^data:video\//i.test(url)) {
    const mime = url.slice(5, url.indexOf(";"));
    return mime || "video/*";
  }
  if (VIDEO_URL_PATTERN.test(url)) return "video/*";
  if (IMAGE_URL_PATTERN.test(url)) return "image/*";
  return null;
};

/**
 * Returns true when the element should preserve default text-input paste behavior.
 */
export const isEditableElement = (element: HTMLElement | null): boolean => {
  if (!element) return false;
  if (element.isContentEditable) return true;
  return (
    element.tagName === "INPUT" ||
    element.tagName === "TEXTAREA" ||
    element.getAttribute("role") === "textbox"
  );
};

/**
 * Resolves the DOM surfaces that can capture global reference-grid paste events.
 */
export const getReferencePasteSurfaces = (panelNode: HTMLDivElement): HTMLElement[] => {
  const surfaces: HTMLElement[] = [panelNode];
  const referenceColumnNode = panelNode.closest(".reference-column");
  if (referenceColumnNode instanceof HTMLElement) {
    surfaces.push(referenceColumnNode);
  }
  const shellRightNode = panelNode.closest(".ai-shell-right");
  if (shellRightNode instanceof HTMLElement) {
    surfaces.push(shellRightNode);
  }
  return surfaces;
};

/**
 * Returns true when a target node is inside any candidate surface.
 */
export const isNodeInsideAnySurface = (targetNode: Node | null, surfaces: HTMLElement[]): boolean =>
  Boolean(targetNode && surfaces.some((surface) => surface.contains(targetNode)));
