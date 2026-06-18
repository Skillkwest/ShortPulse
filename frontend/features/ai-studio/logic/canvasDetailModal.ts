import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailItemBase,
  SharedMediaDetailSelectionTarget,
} from "../components/detail-modal/detailModalPlatformTypes";
import { normalizeSharedMediaDetailKindLabel } from "../components/detail-modal/sharedMediaDetailPresentation";
import type { CanvasWorkspaceInstanceId } from "../components/canvas/canvasWorkspaceContracts";
import type {
  CanvasAudioItem,
  CanvasImageItem,
  CanvasSceneItem,
  CanvasVideoItem,
} from "../components/canvas/canvasTypes";

type CanvasDetailModalMediaItem = CanvasImageItem | CanvasVideoItem | CanvasAudioItem;

export type CanvasDetailModalItem = SharedMediaDetailItemBase & {
  item: CanvasDetailModalMediaItem;
  selectionTarget: Extract<SharedMediaDetailSelectionTarget, { kind: "canvas-item" }>;
  capabilities: SharedMediaDetailCapabilities;
};

const CANVAS_PREVIEW_ONLY_CAPABILITIES: SharedMediaDetailCapabilities = {
  canSaveToLibrary: false,
  canDownload: true,
  canDelete: false,
  canEditPrompt: false,
  canSavePrompt: false,
  canShowCharacterContext: false,
  canShowStyleContext: false,
};

const resolveCanvasDetailTitle = (item: CanvasDetailModalMediaItem): string => {
  if (item.kind === "image") {
    const alt = item.alt.trim();
    if (alt) return alt;
  }
  if (item.kind === "video") {
    const title = item.title?.trim();
    if (title) return title;
  }
  if (item.kind === "audio") {
    const title = item.title?.trim();
    if (title) return title;
  }
  return item.mediaId?.trim() || item.outputId?.trim() || item.id;
};

export const createCanvasDetailModalItem = ({
  item,
  instanceId,
}: {
  item: CanvasSceneItem;
  instanceId?: CanvasWorkspaceInstanceId;
}): CanvasDetailModalItem | null => {
  if (item.kind === "text") return null;

  const title = resolveCanvasDetailTitle(item);
  const kindLabel = normalizeSharedMediaDetailKindLabel(item.kind);

  return {
    item,
    surface: "right-rail-canvas",
    selectionTarget: {
      kind: "canvas-item",
      itemId: item.id,
      surface: "right-rail-canvas",
      ...(instanceId ? { instanceId } : {}),
    },
    capabilities: CANVAS_PREVIEW_ONLY_CAPABILITIES,
    media:
      item.kind === "image"
        ? {
            id: item.mediaId?.trim() || item.outputId?.trim() || item.id,
            kind: "image",
            url: item.src,
            filename: title,
            fullUrl: item.src,
            previewUrl: item.src,
          }
        : item.kind === "video"
          ? {
              id: item.mediaId?.trim() || item.outputId?.trim() || item.id,
              kind: "video",
              url: item.videoUrl,
              filename: title,
              previewPosterUrl: item.posterUrl ?? null,
              fullUrl: item.videoUrl,
              previewUrl: item.videoUrl,
              durationMs: item.durationMs ?? null,
            }
          : {
              id: item.mediaId?.trim() || item.outputId?.trim() || item.id,
              kind: "audio",
              url: item.audioUrl,
              filename: title,
              previewUrl: item.audioUrl,
              fullUrl: item.audioUrl,
              source: item.audioSourceMode ?? null,
              audioSourceMode: item.audioSourceMode ?? null,
              durationMs: item.durationMs ?? null,
              waveformPeaks: item.waveformPeaks ?? null,
            },
    presentation: {
      title,
      kindLabel,
      topBarItems: [
        { label: kindLabel, className: "art-meta-item" },
        {
          label: title,
          className: "art-meta-item art-meta-filename",
          title,
        },
      ],
      bladePlaceholder: "No prompt metadata available.",
    },
  };
};
