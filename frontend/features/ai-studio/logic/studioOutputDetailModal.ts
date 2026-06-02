import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailItemBase,
  SharedMediaDetailSelectionTarget,
} from "../components/detail-modal/detailModalPlatformTypes";
import { canDownloadReferenceOutput, canSaveReferenceOutput } from "./referenceActionAvailability";
import type { StudioOutput } from "../types";

export type StudioOutputDetailModalItem = SharedMediaDetailItemBase & {
  output: StudioOutput;
  selectionTarget: Extract<SharedMediaDetailSelectionTarget, { kind: "studio-output" }>;
  capabilities: SharedMediaDetailCapabilities;
};

/**
 * Creates the canonical detail-modal contract for StudioOutput-backed right-rail previews.
 * This keeps the legacy DetailModal aligned with the shared cross-surface capability model.
 */
export const createStudioOutputDetailModalItem = ({
  output,
  canSavePrompt,
}: {
  output: StudioOutput;
  canSavePrompt: boolean;
}): StudioOutputDetailModalItem => ({
  output,
  selectionTarget: {
    kind: "studio-output",
    outputId: output.id,
    // Quick Slot currently shares the same opener path as Reference Grid.
    surface: "reference-grid",
  },
  surface: "reference-grid",
  capabilities: {
    canSaveToLibrary: canSaveReferenceOutput(output),
    canDownload: canDownloadReferenceOutput(output),
    canDelete: true,
    canEditPrompt: output.mode === "text",
    canSavePrompt,
    canShowCharacterContext: Boolean(output.characterContext?.applied),
    canShowStyleContext: Boolean(output.styleContext?.applied),
  },
  media: {
    id: output.id,
    kind:
      output.mode === "audio"
        ? "audio"
        : output.mode === "video"
          ? "video"
          : output.mode === "image"
            ? "image"
            : "prompt",
    url:
      output.previewUrl?.trim() ||
      output.resultUrls?.find((candidate) => candidate?.trim())?.trim() ||
      output.localObjectUrl?.trim() ||
      "",
    createdAt: output.createdAt ?? output.timestamp ?? null,
    filename: null,
    promptText: output.prompt,
    transcriptText: output.transcriptText ?? null,
    source: output.mediaSource ?? (output.mode === "text" ? "prompt" : null),
    previewStoragePath: output.previewStoragePath ?? null,
    fullStoragePath: output.fullStoragePath ?? null,
    previewUrl: output.previewUrl ?? output.localObjectUrl ?? null,
    previewPosterUrl: output.previewPosterUrl ?? null,
    previewPosterStoragePath: output.previewPosterStoragePath ?? null,
    fullUrl: output.resultUrls?.find((candidate) => candidate?.trim()) ?? null,
    audioSourceMode: output.audioSourceMode ?? null,
    durationMs: output.durationMs ?? null,
    waveformPeaks: output.waveformPeaks ?? null,
  },
});
