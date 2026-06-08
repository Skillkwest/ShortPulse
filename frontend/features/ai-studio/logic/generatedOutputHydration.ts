import type { StudioOutput } from "../types";
import { sortStudioOutputsByCreatedAtDesc } from "./outputOrdering";

const asTrimmedString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const isInFlightTaskState = (value: StudioOutput["taskState"] | null | undefined): boolean =>
  value === "pending" || value === "running";

type IndexedOutputMatchQueue = {
  indexes: number[];
  cursor: number;
};

const appendIndexedOutputMatch = (
  map: Map<string, IndexedOutputMatchQueue>,
  key: string | null,
  index: number
): void => {
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    existing.indexes.push(index);
    return;
  }
  map.set(key, {
    indexes: [index],
    cursor: 0,
  });
};

const buildIndexedOutputMatches = (
  existingOutputs: StudioOutput[]
): {
  byGenerationId: Map<string, IndexedOutputMatchQueue>;
  byTaskId: Map<string, IndexedOutputMatchQueue>;
  bySourceRef: Map<string, IndexedOutputMatchQueue>;
} => {
  const byGenerationId = new Map<string, IndexedOutputMatchQueue>();
  const byTaskId = new Map<string, IndexedOutputMatchQueue>();
  const bySourceRef = new Map<string, IndexedOutputMatchQueue>();
  existingOutputs.forEach((output, index) => {
    appendIndexedOutputMatch(byGenerationId, asTrimmedString(output.generationId), index);
    appendIndexedOutputMatch(byTaskId, asTrimmedString(output.taskId), index);
    appendIndexedOutputMatch(bySourceRef, asTrimmedString(output.sourceRef), index);
  });
  return {
    byGenerationId,
    byTaskId,
    bySourceRef,
  };
};

const resolveFirstUnmatchedIndex = (
  queue: IndexedOutputMatchQueue | undefined,
  matchedExistingIndexes: Set<number>
): number => {
  if (!queue) return -1;
  while (queue.cursor < queue.indexes.length) {
    const candidateIndex = queue.indexes[queue.cursor];
    if (!matchedExistingIndexes.has(candidateIndex)) {
      return candidateIndex;
    }
    queue.cursor += 1;
  }
  return -1;
};

const findIndexedHydratedGeneratedOutputMatch = (
  hydrated: StudioOutput,
  indexedMatches: ReturnType<typeof buildIndexedOutputMatches>,
  matchedExistingIndexes: Set<number>
): number => {
  const generationMatch = resolveFirstUnmatchedIndex(
    indexedMatches.byGenerationId.get(asTrimmedString(hydrated.generationId) ?? ""),
    matchedExistingIndexes
  );
  if (generationMatch >= 0) return generationMatch;

  const taskMatch = resolveFirstUnmatchedIndex(
    indexedMatches.byTaskId.get(asTrimmedString(hydrated.taskId) ?? ""),
    matchedExistingIndexes
  );
  if (taskMatch >= 0) return taskMatch;

  return resolveFirstUnmatchedIndex(
    indexedMatches.bySourceRef.get(asTrimmedString(hydrated.sourceRef) ?? ""),
    matchedExistingIndexes
  );
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
  width: hydrated.width ?? existing.width ?? null,
  height: hydrated.height ?? existing.height ?? null,
  mediaSource: "generated",
  hiddenInReferenceGrid:
    existing.hiddenInReferenceGrid === true
      ? true
      : (hydrated.hiddenInReferenceGrid ?? existing.hiddenInReferenceGrid),
  previewTier: hydrated.previewTier ?? existing.previewTier,
  archivedAt: hydrated.taskState === "success" ? null : (existing.archivedAt ?? null),
  archiveReason: hydrated.taskState === "success" ? null : (existing.archiveReason ?? null),
  characterContext: hydrated.characterContext ?? existing.characterContext,
  styleContext: hydrated.styleContext ?? existing.styleContext,
  generationReplay: hydrated.generationReplay ?? existing.generationReplay,
});

export const mergeCanonicalGeneratedOutputs = (
  existingOutputs: StudioOutput[],
  hydratedOutputs: StudioOutput[]
): StudioOutput[] => {
  const matchedExistingIndexes = new Set<number>();
  const indexedMatches = buildIndexedOutputMatches(existingOutputs);
  const canonicalOutputs: StudioOutput[] = [];
  for (const hydrated of hydratedOutputs) {
    const existingIndex = findIndexedHydratedGeneratedOutputMatch(
      hydrated,
      indexedMatches,
      matchedExistingIndexes
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
    ...existingOutputs.filter((_, index) => !matchedExistingIndexes.has(index)),
  ]);
};
