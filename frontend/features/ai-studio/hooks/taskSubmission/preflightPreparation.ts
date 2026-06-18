/**
 * Reference and inpaint input preflight preparation for generation submission.
 * Keeps media upload normalization and timeout telemetry out of the main submit hook.
 */
import { reportAppError } from "../../../../lib/appErrorReporter";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import type { InternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type { InpaintSubmissionOverride } from "../../logic/inpaintSubmission";
import {
  registerInternalMediaRefForUrl,
  resolveInternalMediaRefForUrl,
} from "../../logic/referenceInputInternalMediaRegistry";
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
  restoreOnlyImageInputs?: string[];
  inpaintOverride?: InpaintSubmissionOverride | null;
  timeoutMessage: string;
};

export type PreparedSubmissionReferenceInput = {
  originalUrl: string;
  preparedUrl: string;
  internalMediaRef: InternalMediaRef | null;
};

type PrepareSubmissionReferenceInputsResult = {
  preparedImageInputs: string[];
  preparedImageInputRefs: PreparedSubmissionReferenceInput[];
  preparedRestoreOnlyImageInputs: PreparedSubmissionReferenceInput[];
  preparedInpaintOverride: InpaintSubmissionOverride | null;
};

export const prepareSubmissionReferenceInputs = async ({
  outputId,
  modelId,
  tool,
  imageInputs,
  restoreOnlyImageInputs = [],
  inpaintOverride = null,
  timeoutMessage,
}: PrepareSubmissionReferenceInputsParams): Promise<PrepareSubmissionReferenceInputsResult> => {
  const resolvePreparedInternalMediaRef = (
    preparedUrl: string | null | undefined,
    originalUrl: string | null | undefined
  ) => resolveInternalMediaRefForUrl(preparedUrl) ?? resolveInternalMediaRefForUrl(originalUrl);
  const shouldPrepareStandardReferences = !inpaintOverride;
  const preflightTimeoutBudget = resolvePrepareReferenceTimeoutBudget({
    imageInputs: [...imageInputs, ...restoreOnlyImageInputs],
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
        const prepareReferenceList = async (
          urls: readonly string[],
          inputIndexOffset = 0
        ): Promise<PreparedSubmissionReferenceInput[]> =>
          (
            await Promise.all(
              urls.map(async (url, index) => {
                const normalized = await prepareImageUrlForSubmission(url, {
                  abortSignal,
                  onStage: (event) => {
                    emitPreflightStage(event, "reference", inputIndexOffset + index);
                  },
                });
                const internalMediaRef = resolvePreparedInternalMediaRef(normalized, url);
                if (normalized && internalMediaRef) {
                  registerInternalMediaRefForUrl(normalized, internalMediaRef);
                }
                return normalized
                  ? {
                      originalUrl: url,
                      preparedUrl: normalized,
                      internalMediaRef,
                    }
                  : null;
              })
            )
          ).filter((item): item is PreparedSubmissionReferenceInput => Boolean(item));

        const preparedReferenceInputs = shouldPrepareStandardReferences
          ? await prepareReferenceList(imageInputs)
          : [];
        const preparedRestoreOnlyImageInputs =
          shouldPrepareStandardReferences && restoreOnlyImageInputs.length > 0
            ? await prepareReferenceList(restoreOnlyImageInputs, imageInputs.length)
            : [];

        if (!inpaintOverride) {
          return {
            preparedImageInputs: preparedReferenceInputs.map((item) => item.preparedUrl),
            preparedImageInputRefs: preparedReferenceInputs,
            preparedRestoreOnlyImageInputs,
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
          preparedImageInputs: [],
          preparedImageInputRefs: [],
          preparedRestoreOnlyImageInputs: [],
          preparedInpaintOverride: {
            modelId: inpaintOverride.modelId ?? null,
            baseImageInput: preparedBaseImageInput ?? "",
            maskInput: preparedMaskInput ?? "",
            referenceImageInput: preparedReferenceImageInput,
            baseImageInternalMediaRef: resolvePreparedInternalMediaRef(
              preparedBaseImageInput,
              inpaintOverride.baseImageInput
            ),
            maskInternalMediaRef: resolvePreparedInternalMediaRef(
              preparedMaskInput,
              inpaintOverride.maskInput
            ),
            referenceImageInternalMediaRef: resolvePreparedInternalMediaRef(
              preparedReferenceImageInput,
              inpaintOverride.referenceImageInput
            ),
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
