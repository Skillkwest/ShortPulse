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
import { AI_STUDIO_AUTOSAVE_MAX_ATTEMPTS_PER_OUTPUT } from "../logic/persistenceRetryPolicy";
import { hasDurableGenerationIdentity } from "./useAiStudioPersistenceActions";
import type { PersistOutputSaveResult } from "./persistenceActionContracts";
import type { StudioOutput } from "../types";

type UseAiStudioMediaAutosaveOrchestratorArgs = {
  outputs: StudioOutput[];
  mediaAutosaveEnabled: boolean;
  saveReferenceToLibrary: (outputId: string) => Promise<PersistOutputSaveResult>;
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
 * Applies autosave policy to output snapshots and triggers bounded autosave retries for eligible unsaved media.
 */
export const useAiStudioMediaAutosaveOrchestrator = ({
  outputs,
  mediaAutosaveEnabled,
  saveReferenceToLibrary,
}: UseAiStudioMediaAutosaveOrchestratorArgs) => {
  const inFlightOutputIdsRef = useRef<Set<string>>(new Set());
  const attemptCountByOutputIdRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const activeIds = new Set(outputs.map((output) => output.id));
    for (const outputId of inFlightOutputIdsRef.current) {
      if (!activeIds.has(outputId)) {
        inFlightOutputIdsRef.current.delete(outputId);
      }
    }
    for (const trackedOutputId of attemptCountByOutputIdRef.current.keys()) {
      if (!activeIds.has(trackedOutputId)) {
        attemptCountByOutputIdRef.current.delete(trackedOutputId);
      }
    }

    if (!mediaAutosaveEnabled) return;

    outputs.forEach((output) => {
      if (inFlightOutputIdsRef.current.has(output.id)) return;
      const attemptCount = attemptCountByOutputIdRef.current.get(output.id) ?? 0;
      if (attemptCount >= AI_STUDIO_AUTOSAVE_MAX_ATTEMPTS_PER_OUTPUT) return;
      if (output.mediaSource === "generated" && !hasDurableGenerationIdentity(output)) return;
      const decision = canAutoSaveOutput(buildDecisionInput(output, mediaAutosaveEnabled));
      if (!decision.allowed) return;
      inFlightOutputIdsRef.current.add(output.id);
      attemptCountByOutputIdRef.current.set(output.id, attemptCount + 1);
      void saveReferenceToLibrary(output.id)
        .then((result) => {
          if (result.ok) {
            attemptCountByOutputIdRef.current.delete(output.id);
          }
        })
        .catch(() => {
          // Failure state is handled by persistence runtime; keep attempt count for bounded retry.
        })
        .finally(() => {
          inFlightOutputIdsRef.current.delete(output.id);
        });
    });
  }, [mediaAutosaveEnabled, outputs, saveReferenceToLibrary]);
};
