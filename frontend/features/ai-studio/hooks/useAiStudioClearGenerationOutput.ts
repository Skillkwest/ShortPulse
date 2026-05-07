import { useCallback } from "react";
import { abandonGenerationOutput } from "../logic/generationAbandonment";
import type { StudioOutput } from "../types";

type UseAiStudioClearGenerationOutputParams = {
  abandonTaskOutput: (outputId: string) => void;
  findOutputById: (outputId: string) => StudioOutput | null;
  forceDeleteOutput: (outputId: string) => void;
};

export const useAiStudioClearGenerationOutput = ({
  abandonTaskOutput,
  findOutputById,
  forceDeleteOutput,
}: UseAiStudioClearGenerationOutputParams) =>
  useCallback(
    (outputId: string) => {
      const output = findOutputById(outputId);
      abandonTaskOutput(outputId);
      forceDeleteOutput(outputId);
      if (!output) return;
      void abandonGenerationOutput({ output }).catch((error) => {
        console.warn("[ai-studio] failed to persist generation abandonment", error);
      });
    },
    [abandonTaskOutput, findOutputById, forceDeleteOutput]
  );
