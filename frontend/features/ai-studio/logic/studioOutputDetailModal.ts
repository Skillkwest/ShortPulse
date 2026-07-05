import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailItemBase,
  SharedMediaDetailPresentation,
  SharedMediaDetailSelectionTarget,
} from "../components/detail-modal/detailModalPlatformTypes";
import { canDownloadReferenceOutput, canSaveReferenceOutput } from "./referenceActionAvailability";
import type { StudioOutput } from "../types";
import { resolveOutputAudioSourceMode } from "./audioSourceMode";
import { resolveAiStudioErrorPresentation } from "./errorPresentation";
import { stripHiddenVideoShotModePromptPrefix } from "../../../lib/model-runtime/videoShotModePromptVisibility";
import { sanitizeStoredWaveformPeaks } from "../reference-grid/logic/referenceGridAudioWaveform";

export type StudioOutputDetailModalItem = SharedMediaDetailItemBase & {
  output: StudioOutput;
  selectionTarget: Extract<SharedMediaDetailSelectionTarget, { kind: "studio-output" }>;
  capabilities: SharedMediaDetailCapabilities;
};

const resolveStudioOutputLyricsText = (output: StudioOutput): string | null => {
  const directLyrics = output.lyricsText?.trim();
  if (directLyrics) return directLyrics;
  const payload = output.workflowReload?.payload;
  if (payload?.kind !== "music") return null;
  const workflowLyrics = payload.lyrics?.trim();
  return workflowLyrics || null;
};

const resolveStudioOutputAudioSourceMode = (
  output: StudioOutput
): StudioOutput["audioSourceMode"] =>
  resolveOutputAudioSourceMode(output) ??
  (output.workflowReload?.payload?.kind === "music" ? "music" : null);

const resolveStudioOutputMusicMode = (output: StudioOutput): StudioOutput["musicMode"] => {
  if (output.musicMode === "instrumental" || output.musicMode === "vocal") {
    return output.musicMode;
  }
  const payload = output.workflowReload?.payload;
  if (payload?.kind !== "music") return null;
  return payload.mode === "instrumental" || payload.mode === "vocal" ? payload.mode : null;
};

const resolveStudioOutputDetailSource = (
  output: StudioOutput
): StudioOutput["mediaSource"] | null => {
  if (output.mediaSource) return output.mediaSource;
  if (output.mode === "text") return "prompt";
  if (output.id.startsWith("upload-") || output.timestamp === "Dropped") return "upload";
  if (output.id.startsWith("media-paste-") || output.timestamp === "Clipboard") return "clipboard";
  if (output.id.startsWith("library-") || output.timestamp === "Library") return "library";
  if (output.generationId?.trim() || output.taskId?.trim()) return "generated";
  return null;
};

/**
 * Creates the canonical detail-modal contract for StudioOutput-backed right-rail previews.
 * This keeps the legacy DetailModal aligned with the shared cross-surface capability model.
 */
export const createStudioOutputDetailModalItem = ({
  output,
  canSavePrompt,
  presentation = null,
}: {
  output: StudioOutput;
  canSavePrompt: boolean;
  presentation?: SharedMediaDetailPresentation | null;
}): StudioOutputDetailModalItem => {
  const errorPresentation =
    output.taskState === "fail" ? resolveAiStudioErrorPresentation(output) : null;
  const resolvedPresentation: SharedMediaDetailPresentation | null = errorPresentation
    ? {
        ...presentation,
        kindLabel: presentation?.kindLabel ?? "failed generation",
        bladePlaceholder: presentation?.bladePlaceholder ?? "No error details were captured.",
        errorContent: {
          summary: "",
          detail: errorPresentation.technicalDetail,
          rawPayload: null,
        },
      }
    : presentation;

  return {
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
      canEditPrompt: output.mode === "text" && output.taskState !== "fail",
      canSavePrompt: canSavePrompt && output.taskState !== "fail",
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
      promptText:
        stripHiddenVideoShotModePromptPrefix(output.workflowReload?.prompt?.display) ??
        stripHiddenVideoShotModePromptPrefix(output.prompt),
      transcriptText: output.transcriptText ?? null,
      lyricsText: resolveStudioOutputLyricsText(output),
      source: resolveStudioOutputDetailSource(output),
      previewStoragePath: output.previewStoragePath ?? null,
      fullStoragePath: output.fullStoragePath ?? null,
      previewUrl: output.previewUrl ?? output.localObjectUrl ?? null,
      previewPosterUrl: output.previewPosterUrl ?? null,
      previewPosterStoragePath: output.previewPosterStoragePath ?? null,
      fullUrl: output.resultUrls?.find((candidate) => candidate?.trim()) ?? null,
      companionArtUrl: output.companionArtUrl ?? null,
      companionArtStoragePath: output.companionArtStoragePath ?? null,
      audioSourceMode: resolveStudioOutputAudioSourceMode(output),
      musicMode: resolveStudioOutputMusicMode(output),
      durationMs: output.durationMs ?? null,
      waveformPeaks: sanitizeStoredWaveformPeaks(output.waveformPeaks),
    },
    presentation: resolvedPresentation,
  };
};
