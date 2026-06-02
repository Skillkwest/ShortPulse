import type { SharedMediaDetailItemBase } from "./detailModalPlatformTypes";

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
  item.media.filename?.trim() || item.media.id;
