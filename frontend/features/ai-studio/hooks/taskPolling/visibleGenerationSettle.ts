import {
  resolveGenerationProjectionLifecycle,
  resolveVisibleGenerationReconcile,
  type GenerationProjectionLifecycle,
  type VisibleGenerationReconcile,
} from "../../logic/generatedMediaAuthority";
import { createShortErrorMessage } from "./providerStatusPolicy";

export type ProjectionFailureMessage = {
  message: string;
  detail: string;
  shortMessage: string;
};

export type VisibleGenerationSettleParams = {
  generationId?: string | null;
  requestId?: string | null;
  sourceRef?: string | null;
  projectId?: string | null;
};

export type VisibleGenerationSettleResult =
  | { kind: "unresolved" }
  | {
      kind: "hidden_or_failed";
      projectionLifecycle: GenerationProjectionLifecycle;
      failure: ProjectionFailureMessage;
    }
  | {
      kind: "visible";
      visibleGeneration: VisibleGenerationReconcile;
    };

const isTerminallyUnavailableProjection = (
  projectionLifecycle: GenerationProjectionLifecycle | null
): projectionLifecycle is GenerationProjectionLifecycle =>
  Boolean(
    projectionLifecycle &&
    (projectionLifecycle.taskState === "fail" ||
      projectionLifecycle.hiddenInReferenceGrid === true ||
      projectionLifecycle.referenceGridVisible === false)
  );

export const resolveProjectionFailureMessage = (
  projectionLifecycle: GenerationProjectionLifecycle
): ProjectionFailureMessage => {
  const detail = projectionLifecycle.errorDetail?.trim() || projectionLifecycle.errorMessageShort;
  const message = projectionLifecycle.errorMessageShort?.trim() || detail || "Generation failed.";
  return {
    message,
    detail: detail || message,
    shortMessage: createShortErrorMessage(message),
  };
};

export const resolveVisibleGenerationSettle = async ({
  generationId,
  requestId,
  sourceRef,
  projectId,
}: VisibleGenerationSettleParams): Promise<VisibleGenerationSettleResult> => {
  const projectionLifecycle = await resolveGenerationProjectionLifecycle({
    generationId: generationId ?? null,
    requestId: requestId ?? null,
    ...(sourceRef ? { sourceRef } : {}),
    ...(projectId ? { projectId } : {}),
  }).catch(() => null);

  if (isTerminallyUnavailableProjection(projectionLifecycle)) {
    return {
      kind: "hidden_or_failed",
      projectionLifecycle,
      failure: resolveProjectionFailureMessage(projectionLifecycle),
    };
  }

  const visibleGeneration = await resolveVisibleGenerationReconcile({
    generationId: generationId ?? null,
    requestId: requestId ?? null,
    ...(sourceRef ? { sourceRef } : {}),
    ...(projectId ? { projectId } : {}),
  }).catch(() => null);

  if (!visibleGeneration) {
    return {
      kind: "unresolved",
    };
  }

  return {
    kind: "visible",
    visibleGeneration,
  };
};
