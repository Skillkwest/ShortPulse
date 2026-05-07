/**
 * AI Studio reroll controller.
 * Validates stored generation replay payloads before routing them back through the normal submit path.
 */
import { useCallback, type Dispatch, type SetStateAction } from "react";
import { addBreadcrumb } from "../../../lib/clientBreadcrumbs";
import { canRerollOutput, isGenerationReplayConfigV1 } from "../logic/generationReplay";
import type { AiStudioImageRerollSubmitOptions } from "./contracts/taskSubmissionContracts";
import type { StudioOutput } from "../types";

type SubmitTask = (
  prompt: string,
  referenceInputs: string[],
  options: AiStudioImageRerollSubmitOptions
) => Promise<unknown>;

type UseAiStudioRerollControllerParams = {
  findOutputById: (id: string) => StudioOutput | null;
  setUiNotice: Dispatch<SetStateAction<string | null>>;
  submitTask: SubmitTask;
};

/**
 * Returns the reroll action for generation replay backed image outputs.
 */
export const useAiStudioRerollController = ({
  findOutputById,
  setUiNotice,
  submitTask,
}: UseAiStudioRerollControllerParams) => {
  const rerollOutputFromReplay = useCallback(
    (outputId: string) => {
      const normalizedOutputId = outputId.trim();
      if (!normalizedOutputId) return;
      const output = findOutputById(normalizedOutputId);
      if (!output || !canRerollOutput(output)) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "missing_output_or_replay",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }

      const replay = output.generationReplay;
      if (!isGenerationReplayConfigV1(replay)) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "invalid_replay_payload",
          },
        });
        setUiNotice("Re-roll is unavailable because original generation settings are missing.");
        return;
      }

      const hasLocalOnlyReplayReference = replay.referenceInputs.some(
        (input) => /^blob:/i.test(input) || /^data:/i.test(input)
      );
      if (hasLocalOnlyReplayReference) {
        addBreadcrumb({
          type: "ui",
          level: "warn",
          message: "reroll_blocked_missing_or_invalid_replay",
          data: {
            output_id: normalizedOutputId,
            reason: "local_reference",
          },
        });
        setUiNotice(
          "Re-roll is unavailable because original reference media are no longer accessible."
        );
        return;
      }

      addBreadcrumb({
        type: "ui",
        level: "info",
        message: "reroll_started",
        data: {
          output_id: normalizedOutputId,
          model_id: replay.modelId,
          tool: replay.submitTool,
          reference_count: replay.referenceInputs.length,
        },
      });
      void submitTask(replay.submissionPrompt, replay.referenceInputs, {
        modeOverride: "image",
        selectedToolOverride: replay.submitTool,
        displayPromptOverride: replay.displayPrompt,
        characterContextOverride: replay.characterContext,
        modelIdOverride: replay.modelId,
        aspectOverride: replay.aspect,
        imageResolutionOverride: replay.imageResolution ?? "model_default",
        ...(replay.styleContext ? { styleContextOverride: replay.styleContext } : {}),
      });
    },
    [findOutputById, setUiNotice, submitTask]
  );

  return {
    rerollOutputFromReplay,
  };
};
