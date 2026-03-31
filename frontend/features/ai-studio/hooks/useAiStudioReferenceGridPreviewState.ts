import { useCallback, useMemo, useState } from "react";
import type { StudioOutput } from "../types";
import { resolveActiveOutputPreviewUrl } from "../logic/activeOutputPreviewAuthority";

type UseAiStudioReferenceGridPreviewStateArgs = {
  activeOutputById: Record<string, StudioOutput>;
  activeOutputId: string | null;
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
};

export const useAiStudioReferenceGridPreviewState = ({
  activeOutputById,
  activeOutputId,
  outputs,
  archivedOutputs,
}: UseAiStudioReferenceGridPreviewStateArgs) => {
  const [referenceGridReadyOutputIds, setReferenceGridReadyOutputIds] = useState<Set<string>>(
    () => new Set()
  );

  const validOutputIds = useMemo(
    () =>
      new Set<string>([
        ...outputs.map((item) => item.id),
        ...archivedOutputs.map((item) => item.id),
      ]),
    [archivedOutputs, outputs]
  );

  const visibleReferenceGridReadyOutputIds = useMemo(() => {
    if (referenceGridReadyOutputIds.size <= 0) return referenceGridReadyOutputIds;
    let changed = false;
    const next = new Set<string>();
    referenceGridReadyOutputIds.forEach((id) => {
      if (validOutputIds.has(id)) {
        next.add(id);
        return;
      }
      changed = true;
    });
    return changed ? next : referenceGridReadyOutputIds;
  }, [referenceGridReadyOutputIds, validOutputIds]);

  const activeOutput = useMemo(
    () => (activeOutputId ? (activeOutputById[activeOutputId] ?? null) : null),
    [activeOutputById, activeOutputId]
  );

  const activeOutputPreviewUrl = useMemo(
    () =>
      resolveActiveOutputPreviewUrl({
        activeOutput,
        referenceGridReadyOutputIds: visibleReferenceGridReadyOutputIds,
      }),
    [activeOutput, visibleReferenceGridReadyOutputIds]
  );

  const markReferenceGridReady = useCallback((outputId: string) => {
    setReferenceGridReadyOutputIds((previous) => {
      if (previous.has(outputId)) return previous;
      const next = new Set(previous);
      next.add(outputId);
      return next;
    });
  }, []);

  return {
    activeOutput,
    activeOutputPreviewUrl,
    markReferenceGridReady,
    referenceGridReadyOutputIds: visibleReferenceGridReadyOutputIds,
  };
};
