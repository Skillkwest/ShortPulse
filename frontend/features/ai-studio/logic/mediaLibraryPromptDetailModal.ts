import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailItemBase,
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailSurface,
} from "../components/detail-modal/detailModalPlatformTypes";
import type { PromptRow } from "./mediaLibraryModalModel";

export type MediaLibraryPromptDetailModalSurface = Extract<
  SharedMediaDetailSurface,
  "media-library-panel" | "character-media-panel" | "elements-media-panel"
>;

export type MediaLibraryPromptDetailModalItem = SharedMediaDetailItemBase & {
  prompt: PromptRow;
  surface: MediaLibraryPromptDetailModalSurface;
  selectionTarget: Extract<SharedMediaDetailSelectionTarget, { kind: "media-prompt" }>;
  capabilities: SharedMediaDetailCapabilities;
};

const MEDIA_LIBRARY_PROMPT_DETAIL_CAPABILITIES: SharedMediaDetailCapabilities = {
  canSaveToLibrary: false,
  canDownload: false,
  canDelete: true,
  canEditPrompt: false,
  canSavePrompt: false,
  canShowCharacterContext: false,
  canShowStyleContext: false,
};

export const createMediaLibraryPromptDetailModalItem = ({
  prompt,
  surface,
}: {
  prompt: PromptRow;
  surface: MediaLibraryPromptDetailModalSurface;
}): MediaLibraryPromptDetailModalItem => {
  const resolvedTitle = prompt.title?.trim() || "Text reference";

  return {
    prompt,
    surface,
    selectionTarget: {
      kind: "media-prompt",
      promptId: prompt.id,
      surface,
    },
    capabilities: MEDIA_LIBRARY_PROMPT_DETAIL_CAPABILITIES,
    media: {
      id: prompt.id,
      kind: "prompt",
      url: "",
      createdAt: prompt.created_at ?? null,
      filename: resolvedTitle,
      promptText: prompt.prompt_text,
      source: prompt.source ?? "prompt",
    },
    presentation: {
      title: resolvedTitle,
      kindLabel: "Text",
      topBarItems: [
        { label: "Text", className: "art-meta-item" },
        {
          label: resolvedTitle,
          className: "art-meta-item art-meta-filename",
          title: resolvedTitle,
        },
      ],
      bladePlaceholder: "No prompt text available.",
    },
  };
};
