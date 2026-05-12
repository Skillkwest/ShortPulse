/**
 * Reference and inpaint input preflight preparation for generation submission.
 * Keeps media upload normalization and timeout telemetry out of the main submit hook.
 */
import { reportAppError } from "../../../../lib/appErrorReporter";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import { DeadlineExceededError, withAbortableDeadline } from "../../logic/withDeadline";
import { prepareImageUrlForSubmission, type PrepareImageStageEvent } from "../../utils/imageUpload";
import { resolvePrepareReferenceTimeoutBudget } from "./preflightTimeout";
import type { ToolId } from "../../types";

const preflightStageLevel = (
  status: PrepareImageStageEvent["status"]
): "info" | "warn" | "error" => {
  if (status === "error") return "warn";
  return "info";
};

type PrepareSubmissionReferenceInputsParams = {
  outputId: string;
  modelId: string;
  tool: ToolId | null;
  imageInputs: string[];
  inpaintOverride?: InpaintSubmissionOverride | null;
  timeoutMessage: string;
};

type PrepareSubmissionReferenceInputsResult = {
  preparedImageInputs: string[];
  preparedInpaintOverride: InpaintSubmissionOverride | null;
};

export const prepareSubmissionReferenceInputs = async ({
  outputId,
  modelId,
  tool,
  imageInputs,
  inpaintOverride = null,
  timeoutMessage,
}: PrepareSubmissionReferenceInputsParams): Promise<PrepareSubmissionReferenceInputsResult> => {
  const shouldPrepareStandardReferences = !inpaintOverride;
  const preflightTimeoutBudget = resolvePrepareReferenceTimeoutBudget({
    imageInputs,
    inpaintOverride,
  });
  const emitPreflightStage = (
    event: PrepareImageStageEvent,
    inputRole: "reference" | "inpaint_base" | "inpaint_mask",
    inputIndex: number
  ) => {
    addBreadcrumb({
      type: "ui",
      level: preflightStageLevel(event.status),
      message: "generation_preflight_prepare_stage",
      data: {
        output_id: outputId,
        model_id: modelId,
        tool,
        input_role: inputRole,
        input_index: inputIndex,
        stage: event.stage,
        stage_status: event.status,
        source_kind: event.sourceKind,
        elapsed_ms: event.elapsedMs,
        timeout_ms: event.timeoutMs ?? null,
        detail: event.detail ?? null,
      },
    });
  };

  try {
    addBreadcrumb({
      type: "ui",
      level: "info",
      message: "generation_preflight_started",
      data: {
        output_id: outputId,
        model_id: modelId,
        tool,
      },
    });
    const prepared = await withAbortableDeadline({
      timeoutMs: preflightTimeoutBudget.timeoutMs,
      timeoutMessage,
      run: async (abortSignal) => {
        const preparedReferences = shouldPrepareStandardReferences
          ? (
              await Promise.all(
                imageInputs.map(async (url, index) => {
                  const normalized = await prepareImageUrlForSubmission(url, {
                    abortSignal,
                    onStage: (event) => {
                      emitPreflightStage(event, "reference", index);
                    },
                  });
                  return normalized ?? null;
                })
              )
            ).filter((url): url is string => Boolean(url))
          : [];

        if (!inpaintOverride) {
          return {
            preparedImageInputs: preparedReferences,
            preparedInpaintOverride: null,
          };
        }

        const [preparedBaseImageInput, preparedMaskInput, preparedReferenceImageInput] =
          await Promise.all([
            prepareImageUrlForSubmission(inpaintOverride.baseImageInput, {
              abortSignal,
              onStage: (event) => {
                emitPreflightStage(event, "inpaint_base", 0);
              },
            }),
            prepareImageUrlForSubmission(inpaintOverride.maskInput, {
              abortSignal,
              onStage: (event) => {
                emitPreflightStage(event, "inpaint_mask", 0);
              },
            }),
            inpaintOverride.referenceImageInput
              ? prepareImageUrlForSubmission(inpaintOverride.referenceImageInput, {
                  abortSignal,
                  onStage: (event) => {
                    emitPreflightStage(event, "reference", 0);
                  },
                })
              : Promise.resolve(null),
          ]);

        return {
          preparedImageInputs: preparedReferences,
          preparedInpaintOverride: {
            modelId: inpaintOverride.modelId ?? null,
            baseImageInput: preparedBaseImageInput ?? "",
            maskInput: preparedMaskInput ?? "",
            referenceImageInput: preparedReferenceImageInput,
            outputFormat: inpaintOverride.outputFormat,
            imageWidth: inpaintOverride.imageWidth ?? null,
            imageHeight: inpaintOverride.imageHeight ?? null,
          } satisfies InpaintSubmissionOverride,
        };
      },
    });

    return prepared;
  } catch (error) {
    if (error instanceof DeadlineExceededError) {
      void reportAppError({
        source: "generation_preflight_timeout",
        scope: "generation",
        severity: "medium",
        message: "Generation preflight timed out before submission.",
        metadata: {
          output_id: outputId,
          model_id: modelId,
          tool,
          duration_ms: error.timeoutMs,
          preflight_work_units: preflightTimeoutBudget.workUnitCount,
          preflight_timeout_ms: preflightTimeoutBudget.timeoutMs,
          reason_code: "PREFLIGHT_TIMEOUT",
        },
      });
    }
    throw error;
  }
};
