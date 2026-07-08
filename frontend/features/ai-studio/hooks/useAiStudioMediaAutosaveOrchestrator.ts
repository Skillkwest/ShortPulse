/**
 * AI Studio media autosave orchestration hook.
 * Observes outputs and triggers autosave policy decisions without relying on DOM load callbacks.
 */
import { useEffect, useRef, useState } from "react";
import { requestMediaStorageQuotaSummaryRefresh } from "../../billing/useMediaStorageQuotaSummary";
import {
  canAutoSaveOutput,
  type MediaAutosaveSource,
  type PersistenceIntent,
} from "../../../lib/mediaAutosavePolicy";
import { hasStorageAuthority } from "../logic/referenceOutputAuthority";
import { AI_STUDIO_AUTOSAVE_MAX_ATTEMPTS_PER_OUTPUT } from "../logic/persistenceRetryPolicy";
import { hasDurableGenerationIdentity } from "./useAiStudioPersistenceActions";
import type { PersistOutputSaveResult } from "./persistenceActionContracts";
import { isLocalUploadPendingDurability } from "./persistenceOutputSaveUtils";
import type { StudioOutput } from "../types";
import type { MediaAutosaveSyncState } from "./useMediaAutosavePreference";

type UseAiStudioMediaAutosaveOrchestratorArgs = {
  enabled: boolean;
  isMediaStorageFull?: boolean;
  outputs: StudioOutput[];
  mediaAutosaveEnabled: boolean;
  mediaAutosaveSyncState: MediaAutosaveSyncState;
  saveReferenceToLibrary: (
    outputId: string,
    options?: { intent?: "manual" | "auto" }
  ) => Promise<PersistOutputSaveResult>;
};

const hasTextValue = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const hasRenderableMedia = (output: StudioOutput): boolean =>
  hasTextValue(output.previewUrl) ||
  hasTextValue(output.localObjectUrl) ||
  hasTextValue(output.previewStoragePath) ||
  hasTextValue(output.fullStoragePath) ||
  output.resultUrls?.some(hasTextValue) === true;

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
  hasDurableLibraryAuthority:
    output.mediaSource === "library" ? hasStorageAuthority(output) : false,
  hasPromptOnlyText: Boolean(output.previewText) && !hasRenderableMedia(output),
  saveState: output.saveState ?? "idle",
  savedMediaIds: output.savedMediaIds ?? [],
});

/**
 * Applies autosave policy to output snapshots and triggers bounded autosave retries for eligible unsaved media.
 */
export const useAiStudioMediaAutosaveOrchestrator = ({
  enabled,
  isMediaStorageFull = false,
  outputs,
  mediaAutosaveEnabled,
  mediaAutosaveSyncState,
  saveReferenceToLibrary,
}: UseAiStudioMediaAutosaveOrchestratorArgs) => {
  const inFlightOutputIdsRef = useRef<Set<string>>(new Set());
  const attemptCountByOutputIdRef = useRef<Map<string, number>>(new Map());
  const [retryRevision, setRetryRevision] = useState(0);

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

    if (!enabled || mediaAutosaveSyncState !== "ready" || !mediaAutosaveEnabled) return;

    outputs.forEach((output) => {
      if (inFlightOutputIdsRef.current.has(output.id)) return;
      if (isLocalUploadPendingDurability(output)) return;
      if (!isMediaStorageFull && output.saveState === "blocked_storage") {
        attemptCountByOutputIdRef.current.delete(output.id);
      }
      const attemptCount = attemptCountByOutputIdRef.current.get(output.id) ?? 0;
      if (attemptCount >= AI_STUDIO_AUTOSAVE_MAX_ATTEMPTS_PER_OUTPUT) return;
      if (output.mediaSource === "generated" && !hasDurableGenerationIdentity(output)) return;
      const effectiveOutput =
        !isMediaStorageFull && output.saveState === "blocked_storage"
          ? { ...output, saveState: "failed" as const }
          : output;
      const decision = canAutoSaveOutput(buildDecisionInput(effectiveOutput, mediaAutosaveEnabled));
      if (!decision.allowed) return;
      inFlightOutputIdsRef.current.add(output.id);
      attemptCountByOutputIdRef.current.set(output.id, attemptCount + 1);
      let shouldRetry = false;
      void saveReferenceToLibrary(output.id, { intent: "auto" })
        .then((result) => {
          if (result.ok) {
            attemptCountByOutputIdRef.current.delete(output.id);
            requestMediaStorageQuotaSummaryRefresh();
            return;
          }
          shouldRetry = true;
        })
        .catch(() => {
          shouldRetry = true;
        })
        .finally(() => {
          inFlightOutputIdsRef.current.delete(output.id);
          if (
            shouldRetry &&
            (attemptCountByOutputIdRef.current.get(output.id) ?? 0) <
              AI_STUDIO_AUTOSAVE_MAX_ATTEMPTS_PER_OUTPUT
          ) {
            setRetryRevision((current) => current + 1);
          }
        });
    });
  }, [
    enabled,
    isMediaStorageFull,
    mediaAutosaveEnabled,
    mediaAutosaveSyncState,
    outputs,
    retryRevision,
    saveReferenceToLibrary,
  ]);
};
