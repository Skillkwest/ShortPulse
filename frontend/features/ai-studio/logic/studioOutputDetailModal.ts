import type {
  SharedMediaDetailCapabilities,
  SharedMediaDetailSelectionTarget,
} from "../components/detail-modal/detailModalPlatformTypes";
import { canDownloadReferenceOutput, canSaveReferenceOutput } from "./referenceActionAvailability";
import type { StudioOutput } from "../types";

export type StudioOutputDetailModalItem = {
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
  capabilities: {
    canSaveToLibrary: canSaveReferenceOutput(output),
    canDownload: canDownloadReferenceOutput(output),
    canDelete: true,
    canEditPrompt: output.mode === "text",
    canSavePrompt,
    canShowCharacterContext: Boolean(output.characterContext?.applied),
    canShowStyleContext: Boolean(output.styleContext?.applied),
  },
});
