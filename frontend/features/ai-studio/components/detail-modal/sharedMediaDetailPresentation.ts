import type {
  SharedMediaDetailContentKind,
  SharedMediaDetailItemBase,
  SharedMediaDetailTopBarItem,
} from "./detailModalPlatformTypes";

type ResolveSharedMediaDetailBladeContentOptions = {
  item: SharedMediaDetailItemBase;
  promptTextOverride?: string | null;
  transcriptTextOverride?: string | null;
};

type SharedMediaDetailBladeContent = {
  label: "ERROR" | "LYRICS" | "PROMPT" | "TRANSCRIPT";
  value: string;
};

type ResolveSharedMediaDetailReferenceNamesOptions = {
  displayPreviewUrl: string | null;
  displayPromptText: string;
  generatedReferenceFallbackKind: SharedMediaDetailContentKind;
  isGeneratedReference: boolean;
  isLoadedReference: boolean;
  isPromptOnly: boolean;
  isUploadedReference: boolean;
  mediaTypeLabel: string;
  title?: string | null;
};

type SharedMediaDetailReferenceNames = {
  detailReferenceName: string | null | undefined;
  filenameFromUrl: string | null;
  uploadedHeaderFilename: string | null;
};

const GENERATED_PROMPT_SOURCES = new Set(["generated", "ai_studio", "prompt"]);
const PROMPTLESS_IMPORTED_SOURCES = new Set(["clipboard", "library", "upload"]);

const normalizeSource = (value?: string | null): string | null => {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
};

const looksLikeSharedMediaDetailFilename = (value?: string | null): boolean => {
  const candidate = value?.trim();
  if (!candidate) return false;
  if (/^data:/i.test(candidate) || /^blob:/i.test(candidate) || /^https?:\/\//i.test(candidate)) {
    return false;
  }
  if (/[\\/]/.test(candidate)) return false;
  return /\.[a-z0-9]{2,10}$/i.test(candidate);
};

const resolveSharedMediaDetailFilenameFromUrl = (
  displayPreviewUrl: string | null
): string | null => {
  if (!displayPreviewUrl) return null;
  try {
    const parsed = new URL(displayPreviewUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const trailing = decodeURIComponent(
      parsed.pathname.split("/").filter(Boolean).pop() ?? ""
    ).trim();
    return looksLikeSharedMediaDetailFilename(trailing) ? trailing : null;
  } catch {
    return null;
  }
};

const collectUniqueDetailBlocks = (...values: Array<string | null | undefined>): string[] => {
  const blocks: Array<{ text: string; comparable: string }> = [];
  values.forEach((value) => {
    const trimmed = value?.trim();
    if (!trimmed) return;
    const comparable = trimmed.toLowerCase().replace(/\s+/g, " ");
    const overlappingIndex = blocks.findIndex(
      (block) => comparable.includes(block.comparable) || block.comparable.includes(comparable)
    );
    if (overlappingIndex >= 0) {
      if (comparable.length > blocks[overlappingIndex].comparable.length) {
        blocks[overlappingIndex] = { text: trimmed, comparable };
      }
      return;
    }
    blocks.push({ text: trimmed, comparable });
  });
  return blocks.map((block) => block.text);
};

export const normalizeSharedMediaDetailKindLabel = (
  value?: SharedMediaDetailContentKind | string | null
): string => {
  const normalized = value?.trim().toLowerCase();
  switch (normalized) {
    case "audio":
      return "Audio";
    case "video":
      return "Video";
    case "image":
      return "Image";
    case "prompt":
    case "text":
      return "Text";
    default:
      return value?.trim() || "Media";
  }
};

export const resolveSharedMediaDetailGeneratedFallbackName = (
  kind: SharedMediaDetailContentKind
): string => `Generated ${normalizeSharedMediaDetailKindLabel(kind).toLowerCase()}`;

export const resolveSharedMediaDetailReferenceNames = ({
  displayPreviewUrl,
  displayPromptText,
  generatedReferenceFallbackKind,
  isGeneratedReference,
  isLoadedReference,
  isPromptOnly,
  isUploadedReference,
  mediaTypeLabel,
  title,
}: ResolveSharedMediaDetailReferenceNamesOptions): SharedMediaDetailReferenceNames => {
  const filenameFromUrl = resolveSharedMediaDetailFilenameFromUrl(displayPreviewUrl);
  const promptFilename = looksLikeSharedMediaDetailFilename(displayPromptText.trim())
    ? displayPromptText.trim()
    : null;
  const trimmedTitle = title?.trim();
  const uploadedHeaderFilename = isUploadedReference
    ? (promptFilename ??
      filenameFromUrl ??
      trimmedTitle ??
      `Uploaded ${mediaTypeLabel.toLowerCase()}`)
    : null;
  const loadedMediaReferenceName = isLoadedReference
    ? (promptFilename ?? filenameFromUrl ?? trimmedTitle ?? null)
    : null;
  const generatedReferenceName = isGeneratedReference
    ? (trimmedTitle ??
      resolveSharedMediaDetailGeneratedFallbackName(generatedReferenceFallbackKind))
    : null;
  const textReferenceName = isPromptOnly ? (trimmedTitle ?? "Text reference") : null;
  const detailReferenceName =
    uploadedHeaderFilename ??
    loadedMediaReferenceName ??
    generatedReferenceName ??
    textReferenceName;

  return { detailReferenceName, filenameFromUrl, uploadedHeaderFilename };
};

export const resolveSharedMediaDetailBladeContent = ({
  item,
  promptTextOverride = null,
  transcriptTextOverride = null,
}: ResolveSharedMediaDetailBladeContentOptions): SharedMediaDetailBladeContent => {
  const errorContent = item.presentation?.errorContent;
  const errorDetail = errorContent?.detail?.trim();
  if (errorDetail) {
    const summary = errorContent?.summary?.trim();
    const rawPayload = errorContent?.rawPayload?.trim();
    return {
      label: "ERROR",
      value: collectUniqueDetailBlocks(summary, errorDetail, rawPayload).join("\n\n"),
    };
  }

  const transcriptText =
    transcriptTextOverride?.trim() || item.media.transcriptText?.trim() || null;
  if (transcriptText) {
    return {
      label: "TRANSCRIPT",
      value: transcriptText,
    };
  }

  return {
    label: "PROMPT",
    value: promptTextOverride ?? item.media.promptText ?? "",
  };
};

export const resolveSharedMediaDetailKindLabel = (item: SharedMediaDetailItemBase): string => {
  const explicitKindLabel = item.presentation?.kindLabel?.trim();
  return normalizeSharedMediaDetailKindLabel(explicitKindLabel || item.media.kind);
};

export const resolveSharedMediaDetailTitle = (item: SharedMediaDetailItemBase): string => {
  const configuredTitle = item.presentation?.title?.trim();
  if (configuredTitle) return configuredTitle;
  const filename = item.media.filename?.trim();
  if (filename) return filename;
  const source = normalizeSource(item.media.source);
  if (source && GENERATED_PROMPT_SOURCES.has(source)) {
    return resolveSharedMediaDetailGeneratedFallbackName(item.media.kind);
  }
  return item.media.id;
};

export const resolveSharedMediaDetailTopBarItems = (
  item: SharedMediaDetailItemBase
): SharedMediaDetailTopBarItem[] => {
  const configuredItems = item.presentation?.topBarItems?.filter(
    (candidate): candidate is SharedMediaDetailTopBarItem =>
      Boolean(candidate?.label && candidate.label.trim().length > 0)
  );
  if (configuredItems && configuredItems.length > 0) {
    return configuredItems;
  }

  const title = resolveSharedMediaDetailTitle(item);
  return [
    { label: resolveSharedMediaDetailKindLabel(item), className: "art-meta-item" },
    { label: title, className: "art-meta-item art-meta-filename", title },
  ];
};

export const resolveSharedMediaDetailBladePlaceholder = (item: SharedMediaDetailItemBase): string =>
  item.presentation?.bladePlaceholder?.trim() || "No prompt metadata available.";

export const shouldRenderSharedMediaDetailInfoPanel = (
  item: SharedMediaDetailItemBase,
  bladeContent: SharedMediaDetailBladeContent
): boolean => {
  const value = bladeContent.value.trim();
  if (bladeContent.label !== "PROMPT") return value.length > 0;

  const source = normalizeSource(item.media.source);
  if (source && PROMPTLESS_IMPORTED_SOURCES.has(source)) return false;
  if (value.length > 0) return true;
  return Boolean(source && GENERATED_PROMPT_SOURCES.has(source));
};
