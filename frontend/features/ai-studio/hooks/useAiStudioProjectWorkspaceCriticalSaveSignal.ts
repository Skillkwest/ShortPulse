/**
 * Watches project-restorable right-rail output state and emits a save signal
 * when durable output authority changes after the project route is active.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { hasDurableGeneratedMediaDisplayAuthority } from "../../../lib/generatedMediaDisplayAuthority";
import type { StudioOutput } from "../types";

type UseAiStudioProjectWorkspaceCriticalSaveSignalParams = {
  projectId?: string | null;
  projectRouteRequested?: boolean;
  outputs: readonly StudioOutput[];
  curatedReferenceIds: readonly string[];
};

const normalizeStringList = (values: readonly string[] | null | undefined): string[] =>
  (values ?? []).map((value) => value.trim()).filter(Boolean);

const hasProjectRestorableOutputAuthority = (output: StudioOutput): boolean =>
  hasDurableGeneratedMediaDisplayAuthority({
    previewText: output.previewText,
    savedMediaIds: output.savedMediaIds,
    previewPosterStoragePath: output.previewPosterStoragePath,
    previewStoragePath: output.previewStoragePath,
    fullStoragePath: output.fullStoragePath,
    companionArtStoragePath: output.companionArtStoragePath,
  });

const createProjectRestorableOutputSignature = (output: StudioOutput) => ({
  id: output.id,
  mode: output.mode,
  aspect: output.aspect,
  model: output.model,
  modelId: output.modelId ?? null,
  provider: output.provider ?? null,
  prompt: output.prompt,
  title: output.title ?? null,
  previewText: output.previewText ?? null,
  status: output.status,
  taskState: output.taskState ?? null,
  generationId: output.generationId ?? null,
  taskId: output.taskId ?? null,
  sourceRef: output.sourceRef ?? null,
  promptId: output.promptId ?? null,
  savedMediaIds: normalizeStringList(output.savedMediaIds),
  previewPosterStoragePath: output.previewPosterStoragePath ?? null,
  previewStoragePath: output.previewStoragePath ?? null,
  fullStoragePath: output.fullStoragePath ?? null,
  companionArtStoragePath: output.companionArtStoragePath ?? null,
  durationMs: output.durationMs ?? null,
  audioSourceMode: output.audioSourceMode ?? null,
  musicMode: output.musicMode ?? null,
  hiddenInReferenceGrid: output.hiddenInReferenceGrid === true,
});

/**
 * Returns a monotonic signal for the existing project workspace autosave hook.
 * The first signature for a project is treated as baseline so project restore
 * itself does not become a separate persistence event.
 */
export const useAiStudioProjectWorkspaceCriticalSaveSignal = ({
  projectId = null,
  projectRouteRequested = false,
  outputs,
  curatedReferenceIds,
}: UseAiStudioProjectWorkspaceCriticalSaveSignalParams): number => {
  const [signal, setSignal] = useState(0);
  const activeProjectRef = useRef<string | null>(null);
  const previousSignatureRef = useRef<string | null>(null);

  const signature = useMemo(() => {
    if (!projectId || !projectRouteRequested) return null;
    const restorableOutputs = outputs
      .filter(hasProjectRestorableOutputAuthority)
      .map(createProjectRestorableOutputSignature);
    const restorableOutputIds = new Set(restorableOutputs.map((output) => output.id));
    return JSON.stringify({
      projectId,
      curatedReferenceIds: normalizeStringList(curatedReferenceIds).filter((id) =>
        restorableOutputIds.has(id)
      ),
      outputs: restorableOutputs,
    });
  }, [curatedReferenceIds, outputs, projectId, projectRouteRequested]);

  useEffect(() => {
    if (!projectId || !projectRouteRequested || signature == null) {
      activeProjectRef.current = null;
      previousSignatureRef.current = null;
      return;
    }

    if (activeProjectRef.current !== projectId) {
      activeProjectRef.current = projectId;
      previousSignatureRef.current = signature;
      return;
    }

    if (previousSignatureRef.current === signature) return;
    previousSignatureRef.current = signature;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setSignal((current) => current + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, projectRouteRequested, signature]);

  return signal;
};
