import { useCallback, useEffect, useMemo, useRef } from "react";
import type { StudioOutput } from "../types";

type UseAiStudioSelectorsParams = {
  outputOrder: string[];
  archivedOutputOrder: string[];
  outputById: Record<string, StudioOutput>;
  archivedOutputById: Record<string, StudioOutput>;
  activeOutputId: string | null;
};

/**
 * Exposes narrow, stable selectors so non-grid UI can avoid full output-array coupling.
 */
export const useAiStudioSelectors = ({
  outputOrder,
  archivedOutputOrder,
  outputById,
  archivedOutputById,
  activeOutputId,
}: UseAiStudioSelectorsParams) => {
  const allOutputsByIdRef = useRef<Record<string, StudioOutput>>({});

  useEffect(() => {
    allOutputsByIdRef.current = {
      ...archivedOutputById,
      ...outputById,
    };
  }, [archivedOutputById, outputById]);

  const selectOutputById = useCallback((id: string | null | undefined) => {
    if (!id) return null;
    return allOutputsByIdRef.current[id] ?? null;
  }, []);

  const resolveOutputPreviewUrl = useCallback(
    (id: string | null | undefined) => {
      return selectOutputById(id)?.previewUrl ?? null;
    },
    [selectOutputById]
  );

  const activeOutputSummary = useMemo(() => {
    if (!activeOutputId) return null;
    const output = outputById[activeOutputId] ?? null;
    if (!output) return null;
    return {
      id: output.id,
      mode: output.mode,
      taskState: output.taskState,
      previewUrl: output.previewUrl ?? null,
    };
  }, [activeOutputId, outputById]);

  return {
    activeReferenceCount: outputOrder.length,
    archivedReferenceCount: archivedOutputOrder.length,
    activeOutputSummary,
    selectOutputById,
    resolveOutputPreviewUrl,
  };
};
