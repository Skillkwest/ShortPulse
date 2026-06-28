/**
 * AI Studio output derivations hook.
 * Centralizes memoized output-derived view state so the root state hook can stay focused on orchestration and handlers.
 */
import { useMemo } from "react";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../logic/editPromptPolicy";
import { resolveModelLabel } from "../logic/stateParsers";
import type { SharedMediaDetailSelectionTarget } from "../components/detail-modal/detailModalPlatformTypes";
import type { StudioOutput } from "../types";

const hasText = (value: string | null | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const isGeneratedAbandonmentRow = (output: StudioOutput): boolean =>
  output.mediaSource === "generated" &&
  (hasText(output.sourceRef) || hasText(output.generationId) || hasText(output.taskId));

const isPrimaryEditStageGenerationRow = (output: StudioOutput): boolean =>
  output.mode === "image" &&
  output.hiddenInReferenceGrid === true &&
  output.modelId !== BRIA_BACKGROUND_REMOVE_MODEL_ID &&
  output.taskState !== "success" &&
  output.taskState !== "fail" &&
  !isGeneratedAbandonmentRow(output);

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
  const resolvedDetailOutputId = useMemo(
    () =>
      detailSelectionTarget?.kind === "studio-output"
        ? detailSelectionTarget.outputId
        : detailOutputId,
    [detailOutputId, detailSelectionTarget]
  );
  const detailOutput = useMemo(() => {
    if (!resolvedDetailOutputId) return null;
    const currentOutput = activeOutputById[resolvedDetailOutputId] ?? null;
    if (currentOutput) return currentOutput;
    const selectedSnapshot =
      detailSelectionTarget?.kind === "studio-output"
        ? (detailSelectionTarget.outputSnapshot ?? null)
        : null;
    return selectedSnapshot?.id === resolvedDetailOutputId ? selectedSnapshot : null;
  }, [activeOutputById, detailSelectionTarget, resolvedDetailOutputId]);
  const currentModelLabel = useMemo(() => resolveModelLabel(model ?? undefined), [model]);
  const isPrimaryEditStageGenerating = useMemo(
    () => outputs.some((output) => isPrimaryEditStageGenerationRow(output)),
    [outputs]
  );

  return {
    detailOutput,
    currentModelLabel,
    isPrimaryEditStageGenerating,
  };
};
