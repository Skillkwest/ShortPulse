import type {
  SharedMediaDetailItemBase,
  SharedMediaDetailTopBarItem,
} from "./detailModalPlatformTypes";

type ResolveSharedMediaDetailBladeContentOptions = {
  item: SharedMediaDetailItemBase;
  promptTextOverride?: string | null;
  transcriptTextOverride?: string | null;
};

export const resolveSharedMediaDetailBladeContent = ({
  item,
  promptTextOverride = null,
  transcriptTextOverride = null,
}: ResolveSharedMediaDetailBladeContentOptions): {
  label: "PROMPT" | "TRANSCRIPT";
  value: string;
} => {
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
  if (explicitKindLabel) return explicitKindLabel;
  switch (item.media.kind) {
    case "audio":
      return "audio";
    case "video":
      return "video";
    case "image":
      return "image";
    default:
      return "prompt";
  }
};

export const resolveSharedMediaDetailTitle = (item: SharedMediaDetailItemBase): string =>
  item.presentation?.title?.trim() || item.media.filename?.trim() || item.media.id;

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
