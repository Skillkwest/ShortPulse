/**
 * AI Studio media autosave orchestration hook.
 * Observes outputs and triggers autosave policy decisions without relying on DOM load callbacks.
 */
import { useEffect, useRef } from "react";
import {
  canAutoSaveOutput,
  type MediaAutosaveSource,
  type PersistenceIntent,
} from "../../../lib/mediaAutosavePolicy";
import { hasDurableGenerationIdentity } from "./useAiStudioPersistenceActions";
import type { StudioOutput } from "../types";

type UseAiStudioMediaAutosaveOrchestratorArgs = {
  outputs: StudioOutput[];
  mediaAutosaveEnabled: boolean;
  saveReferenceToLibrary: (outputId: string) => void;
};

const hasRenderableMedia = (output: StudioOutput): boolean =>
  Boolean(output.previewUrl) || Boolean(output.resultUrls?.length);

const inferMediaSource = (output: StudioOutput): MediaAutosaveSource => {
  if (output.mediaSource) return output.mediaSource;
  if (output.generationId) return "generated";
  return "upload";
};

const buildDecisionInput = (output: StudioOutput, mediaAutosaveEnabled: boolean) => ({
  intent: "auto" as PersistenceIntent,
  source: inferMediaSource(output),
  mediaAutosaveEnabled,
  hasMedia: hasRenderableMedia(output),
  hasPromptOnlyText: Boolean(output.previewText) && !hasRenderableMedia(output),
  saveState: output.saveState ?? "idle",
  savedMediaIds: output.savedMediaIds ?? [],
});

/**
 * Applies autosave policy to output snapshots and triggers one-shot autosave for eligible unsaved media.
 */
export const useAiStudioMediaAutosaveOrchestrator = ({
  outputs,
  mediaAutosaveEnabled,
  saveReferenceToLibrary,
}: UseAiStudioMediaAutosaveOrchestratorArgs) => {
  const attemptedOutputIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const activeIds = new Set(outputs.map((output) => output.id));
    for (const attemptedId of attemptedOutputIdsRef.current) {
      if (!activeIds.has(attemptedId)) {
        attemptedOutputIdsRef.current.delete(attemptedId);
      }
    }

    if (!mediaAutosaveEnabled) return;

    outputs.forEach((output) => {
      if (attemptedOutputIdsRef.current.has(output.id)) return;
      if (output.mediaSource === "generated" && !hasDurableGenerationIdentity(output)) return;
      const decision = canAutoSaveOutput(buildDecisionInput(output, mediaAutosaveEnabled));
      if (!decision.allowed) return;
      attemptedOutputIdsRef.current.add(output.id);
      saveReferenceToLibrary(output.id);
    });
  }, [mediaAutosaveEnabled, outputs, saveReferenceToLibrary]);
};
