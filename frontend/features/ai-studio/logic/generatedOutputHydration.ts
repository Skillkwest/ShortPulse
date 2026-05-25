import type { StudioOutput } from "../types";
import { sortStudioOutputsByCreatedAtDesc } from "./outputOrdering";

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isInFlightTaskState = (value: StudioOutput["taskState"] | null | undefined): boolean =>
  value === "pending" || value === "running";

const matchesHydratedGeneratedOutput = (
  existing: StudioOutput,
  hydrated: StudioOutput
): boolean => {
  const existingGenerationId = asTrimmedString(existing.generationId);
  const hydratedGenerationId = asTrimmedString(hydrated.generationId);
  if (
    existingGenerationId &&
    hydratedGenerationId &&
    existingGenerationId === hydratedGenerationId
  ) {
    return true;
  }

  const existingTaskId = asTrimmedString(existing.taskId);
  const hydratedTaskId = asTrimmedString(hydrated.taskId);
  if (existingTaskId && hydratedTaskId && existingTaskId === hydratedTaskId) {
    return true;
  }

  const existingSourceRef = asTrimmedString(existing.sourceRef);
  const hydratedSourceRef = asTrimmedString(hydrated.sourceRef);
  return Boolean(existingSourceRef && hydratedSourceRef && existingSourceRef === hydratedSourceRef);
};

const mergeHydratedGeneratedOutput = (
  existing: StudioOutput,
  hydrated: StudioOutput
): StudioOutput => ({
  ...existing,
  prompt: existing.prompt?.trim() ? existing.prompt : hydrated.prompt,
  transcriptText: existing.transcriptText?.trim()
    ? existing.transcriptText
    : (hydrated.transcriptText ?? null),
  mode: hydrated.mode,
  aspect: hydrated.aspect ?? existing.aspect,
  model: existing.model?.trim() ? existing.model : hydrated.model,
  createdAt:
    isInFlightTaskState(existing.taskState) && isInFlightTaskState(hydrated.taskState)
      ? (existing.createdAt ?? hydrated.createdAt ?? null)
      : (hydrated.createdAt ?? existing.createdAt ?? null),
  modelId: existing.modelId ?? hydrated.modelId,
  provider: existing.provider ?? hydrated.provider,
  sourceRef: existing.sourceRef ?? hydrated.sourceRef,
  generationId: existing.generationId ?? hydrated.generationId,
  status: "ready",
  timestamp: hydrated.timestamp,
  taskId: existing.taskId ?? hydrated.taskId,
  queueState: hydrated.queueState ?? existing.queueState,
  taskState: hydrated.taskState ?? existing.taskState,
  errorMessage: hydrated.errorMessage ?? existing.errorMessage ?? null,
  errorMessageShort: hydrated.errorMessageShort ?? existing.errorMessageShort ?? null,
  errorDetail: hydrated.errorDetail ?? existing.errorDetail ?? null,
  resultUrls: (hydrated.resultUrls?.length ?? 0) > 0 ? hydrated.resultUrls : existing.resultUrls,
  previewUrl: hydrated.previewUrl ?? existing.previewUrl,
  previewPosterUrl: hydrated.previewPosterUrl ?? existing.previewPosterUrl ?? null,
  previewPosterStoragePath:
    hydrated.previewPosterStoragePath ?? existing.previewPosterStoragePath ?? null,
  companionArtUrl: hydrated.companionArtUrl ?? existing.companionArtUrl ?? null,
  companionArtStoragePath:
    hydrated.companionArtStoragePath ?? existing.companionArtStoragePath ?? null,
  companionArtStatus: hydrated.companionArtStatus ?? existing.companionArtStatus ?? null,
  previewStoragePath: hydrated.previewStoragePath ?? existing.previewStoragePath ?? null,
  fullStoragePath: hydrated.fullStoragePath ?? existing.fullStoragePath ?? null,
  mediaSource: "generated",
  hiddenInReferenceGrid: hydrated.hiddenInReferenceGrid ?? existing.hiddenInReferenceGrid,
  previewTier: hydrated.previewTier ?? existing.previewTier,
  archivedAt: hydrated.taskState === "success" ? null : (existing.archivedAt ?? null),
  archiveReason: hydrated.taskState === "success" ? null : (existing.archiveReason ?? null),
  characterContext: hydrated.characterContext ?? existing.characterContext,
  styleContext: hydrated.styleContext ?? existing.styleContext,
  generationReplay: hydrated.generationReplay ?? existing.generationReplay,
});

const isCanonicalGeneratedOutput = (output: StudioOutput): boolean =>
  Boolean(
    output.mediaSource === "generated" ||
    asTrimmedString(output.generationId) ||
    asTrimmedString(output.taskId) ||
    asTrimmedString(output.sourceRef)
  );

const shouldPruneUnmatchedCanonicalOutput = (output: StudioOutput): boolean => {
  if (!isCanonicalGeneratedOutput(output)) return false;
  return output.taskState === "fail";
};

export const mergeCanonicalGeneratedOutputs = (
  existingOutputs: StudioOutput[],
  hydratedOutputs: StudioOutput[]
): StudioOutput[] => {
  const matchedExistingIndexes = new Set<number>();
  const canonicalOutputs: StudioOutput[] = [];
  for (const hydrated of hydratedOutputs) {
    const existingIndex = existingOutputs.findIndex(
      (item, index) =>
        !matchedExistingIndexes.has(index) && matchesHydratedGeneratedOutput(item, hydrated)
    );
    if (existingIndex >= 0) {
      matchedExistingIndexes.add(existingIndex);
      canonicalOutputs.push(mergeHydratedGeneratedOutput(existingOutputs[existingIndex], hydrated));
      continue;
    }
    canonicalOutputs.push(hydrated);
  }

  return sortStudioOutputsByCreatedAtDesc([
    ...canonicalOutputs,
    ...existingOutputs.filter(
      (output, index) =>
        !matchedExistingIndexes.has(index) && !shouldPruneUnmatchedCanonicalOutput(output)
    ),
  ]);
};
