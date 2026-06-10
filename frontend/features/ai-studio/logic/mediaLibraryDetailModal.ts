import type { StudioAudioSourceMode } from "../types";
import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailItemBase,
  SharedMediaDetailSelectionTarget,
  SharedMediaDetailSurface,
} from "../components/detail-modal/detailModalPlatformTypes";
import type { MediaFileRow } from "./mediaLibraryModalModel";

export type MediaLibraryDetailModalSurface = Extract<
  SharedMediaDetailSurface,
  "media-library-panel" | "character-media-panel" | "elements-media-panel"
>;

export type MediaLibraryDetailSelectionPayload = {
  id: string;
  url: string;
  fileType: "image" | "video" | "audio";
  createdAt?: string | null;
  filename?: string | null;
  promptText?: string | null;
  transcriptText?: string | null;
  lyricsText?: string | null;
  source?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  fullUrl?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
};

export type MediaLibraryDetailModalItem = SharedMediaDetailItemBase &
  MediaLibraryDetailSelectionPayload & {
    file: MediaFileRow;
    surface: MediaLibraryDetailModalSurface;
    selectionTarget: Extract<SharedMediaDetailSelectionTarget, { kind: "media-file" }>;
    capabilities: SharedMediaDetailCapabilities;
  };

const MEDIA_LIBRARY_DETAIL_CAPABILITIES: SharedMediaDetailCapabilities = {
  canSaveToLibrary: false,
  canDownload: true,
  canDelete: true,
  canEditPrompt: false,
  canSavePrompt: false,
  canShowCharacterContext: false,
  canShowStyleContext: false,
};

type MediaLibraryDetailFields = {
  url: string;
  fileType: "image" | "video" | "audio";
  createdAt?: string | null;
  filename?: string | null;
  promptText?: string | null;
  transcriptText?: string | null;
  lyricsText?: string | null;
  source?: string | null;
  previewStoragePath?: string | null;
  fullStoragePath?: string | null;
  previewUrl?: string | null;
  previewPosterUrl?: string | null;
  previewPosterStoragePath?: string | null;
  fullUrl?: string | null;
  audioSourceMode?: StudioAudioSourceMode | null;
  durationMs?: number | null;
  waveformPeaks?: number[] | null;
};

export const createMediaLibraryDetailSelectionPayload = (
  id: string,
  fields: MediaLibraryDetailFields
): MediaLibraryDetailSelectionPayload => ({
  id,
  ...fields,
});

export const createMediaLibraryDetailModalItem = ({
  file,
  surface,
  fields,
}: {
  file: MediaFileRow;
  surface: MediaLibraryDetailModalSurface;
  fields: MediaLibraryDetailFields;
}): MediaLibraryDetailModalItem => {
  const resolvedFilename = fields.filename?.trim() || file.filename || file.id;
  const isExternalUpload =
    fields.source?.trim()?.toLowerCase() === "upload" && Boolean(resolvedFilename);

  return {
    ...createMediaLibraryDetailSelectionPayload(file.id, fields),
    file,
    surface,
    selectionTarget: {
      kind: "media-file",
      fileId: file.id,
      surface,
    },
    capabilities: MEDIA_LIBRARY_DETAIL_CAPABILITIES,
    media: {
      id: file.id,
      kind: fields.fileType === "audio" ? "audio" : fields.fileType === "video" ? "video" : "image",
      ...fields,
    },
    presentation: {
      title: resolvedFilename,
      kindLabel: fields.fileType,
      topBarItems: isExternalUpload
        ? [{ label: fields.fileType, className: "art-meta-item" }]
        : [
            { label: fields.fileType, className: "art-meta-item" },
            {
              label: resolvedFilename,
              className: "art-meta-item art-meta-filename",
              title: resolvedFilename,
            },
          ],
      bladePlaceholder: "No prompt metadata available.",
    },
  };
};
