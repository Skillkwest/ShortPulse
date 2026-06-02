/**
 * AI Studio output derivations hook.
 * Centralizes memoized output-derived view state so the root state hook can stay focused on orchestration and handlers.
 */
import { useMemo } from "react";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { resolveModelLabel } from "../logic/stateParsers";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import type { StudioOutput } from "../types";

type UseAiStudioOutputDerivationsParams = {
  outputs: StudioOutput[];
  activeOutputById: Record<string, StudioOutput>;
  detailSelectionTarget?: SharedMediaDetailSelectionTarget | null;
  detailOutputId: string | null;
  model: string | null;
};

/**
 * Returns memoized output-driven values used by the AI Studio page shell.
 */
export const useAiStudioOutputDerivations = ({
  outputs,
  activeOutputById,
  detailSelectionTarget = null,
  detailOutputId,
  model,
}: UseAiStudioOutputDerivationsParams) => {
  const detailOutput = useMemo(() => {
    const resolvedDetailOutputId =
      detailSelectionTarget?.kind === "studio-output"
        ? detailSelectionTarget.outputId
        : detailOutputId;
    return resolvedDetailOutputId ? (activeOutputById[resolvedDetailOutputId] ?? null) : null;
  }, [activeOutputById, detailOutputId, detailSelectionTarget]);
  const currentModelLabel = useMemo(() => resolveModelLabel(model ?? undefined), [model]);
  const isPrimaryEditStageGenerating = useMemo(
    () =>
      outputs.some(
        (output) =>
          output.mode === "image" &&
          output.hiddenInReferenceGrid === true &&
          output.modelId !== BRIA_BACKGROUND_REMOVE_MODEL_ID &&
          output.taskState !== "success" &&
          output.taskState !== "fail"
      ),
    [outputs]
  );

  return {
    detailOutput,
    currentModelLabel,
    isPrimaryEditStageGenerating,
  };
};
