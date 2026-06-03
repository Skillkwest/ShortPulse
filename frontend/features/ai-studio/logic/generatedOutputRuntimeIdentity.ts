import type { StudioOutput } from "../types";

export type GeneratedOutputRuntimeIdentity = {
  generationId: string | null;
  requestId: string | null;
  sourceRef: string | null;
};

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const resolveGeneratedOutputRuntimeIdentity = (
  output: Pick<StudioOutput, "generationId" | "taskId" | "sourceRef">
): GeneratedOutputRuntimeIdentity | null => {
  const generationId = asTrimmedString(output.generationId);
  const requestId = asTrimmedString(output.taskId);
  const sourceRef = asTrimmedString(output.sourceRef);
  if (!generationId && !requestId && !sourceRef) return null;
  return {
    generationId,
    requestId,
    sourceRef,
  };
};

export const hasGeneratedOutputRuntimeIdentity = (
  output: Pick<StudioOutput, "generationId" | "taskId" | "sourceRef">
): boolean => resolveGeneratedOutputRuntimeIdentity(output) !== null;

export const buildGeneratedOutputRuntimeIdentitySignature = (
  output: Pick<StudioOutput, "id" | "generationId" | "taskId" | "sourceRef">
): string => {
  const identity = resolveGeneratedOutputRuntimeIdentity(output);
  return [
    output.id,
    identity?.generationId ?? "",
    identity?.requestId ?? "",
    identity?.sourceRef ?? "",
  ].join(":");
};
