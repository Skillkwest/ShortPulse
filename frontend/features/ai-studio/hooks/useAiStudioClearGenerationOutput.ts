import { useCallback } from "react";
import {
  abandonGenerationOutput,
  canAbandonGenerationOutput,
} from "../logic/generationAbandonment";
import type { StudioOutput } from "../types";

type UseAiStudioClearGenerationOutputParams = {
  abandonTaskOutput: (outputId: string) => void;
  findOutputById: (outputId: string) => StudioOutput | null;
  forceDeleteOutput: (outputId: string) => void;
  setActiveOutputId: (value: string | null | ((previous: string | null) => string | null)) => void;
  updateOutputById: (id: string, updater: (item: StudioOutput) => StudioOutput) => void;
};

export const useAiStudioClearGenerationOutput = ({
  abandonTaskOutput,
  findOutputById,
  forceDeleteOutput,
  setActiveOutputId,
  updateOutputById,
}: UseAiStudioClearGenerationOutputParams) =>
  useCallback(
    (outputId: string) => {
      const output = findOutputById(outputId);
      abandonTaskOutput(outputId);
      if (output?.mediaSource === "generated" && canAbandonGenerationOutput(output)) {
        updateOutputById(outputId, (item) =>
          item.hiddenInReferenceGrid === true ? item : { ...item, hiddenInReferenceGrid: true }
        );
        setActiveOutputId((previous) => (previous === outputId ? null : previous));
        void abandonGenerationOutput({ output })
          .then(() => {
            forceDeleteOutput(outputId);
          })
          .catch((error) => {
            console.warn("[ai-studio] failed to persist generation abandonment", error);
          });
        return;
      }
      forceDeleteOutput(outputId);
      if (!output) return;
      void abandonGenerationOutput({ output }).catch((error) => {
        console.warn("[ai-studio] failed to persist generation abandonment", error);
      });
    },
    [abandonTaskOutput, findOutputById, forceDeleteOutput, setActiveOutputId, updateOutputById]
  );
