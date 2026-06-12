/**
 * AI Studio page output adapter hook.
 * Keeps page-level output lookup, preview resolution, and in-flight derivations out of the page orchestrator while preserving current flag-gated behavior.
 */
import { useCallback, useMemo } from "react";
import type { StudioOutput, ToolId } from "../types";
import { useOutputSelector } from "./aiStudioOutputStore";

type UseAiStudioPageOutputAdaptersParams = {
  outputs: StudioOutput[];
  getOutputById: (id: string) => StudioOutput | null;
  referenceImageUrl: string | null;
  extraImageUrls: readonly (string | null)[];
  videoReferenceImageUrl: string | null;
  videoExtraImageUrls: readonly (string | null)[];
  outputSelectorStoreEnabled: boolean;
  selectorCallbacksEnabled: boolean;
};

/**
 * Returns page-scoped output lookup adapters consumed by AI Studio orchestration hooks.
 */
export const useAiStudioPageOutputAdapters = ({
  outputs,
  getOutputById,
  referenceImageUrl,
  extraImageUrls,
  videoReferenceImageUrl,
  videoExtraImageUrls,
  outputSelectorStoreEnabled,
  selectorCallbacksEnabled,
}: UseAiStudioPageOutputAdaptersParams) => {
  const selectorInFlightOutputIds = useOutputSelector((snapshot) => snapshot.indexes.inFlightIds);
  const fallbackInFlightOutputIds = useMemo(
    () =>
      new Set(
        outputs
          .filter((output) => output.taskState === "pending" || output.taskState === "running")
          .map((output) => output.id)
      ),
    [outputs]
  );
  const inFlightOutputIds = outputSelectorStoreEnabled
    ? selectorInFlightOutputIds
    : fallbackInFlightOutputIds;

  const resolvePanelOutputPreviewUrl = useCallback(
    (id: string | null | undefined) => {
      if (!id) return null;
      if (outputSelectorStoreEnabled) {
        return getOutputById(id)?.previewUrl ?? null;
      }
      return outputs.find((item) => item.id === id)?.previewUrl ?? null;
    },
    [getOutputById, outputSelectorStoreEnabled, outputs]
  );

  const resolveReferenceInputsForTool = useCallback(
    (tool: ToolId | null) => {
      if (tool === "video" || tool === "kling") {
        return {
          referenceImageUrl: videoReferenceImageUrl,
          extraImageUrls: videoExtraImageUrls,
        };
      }
      if (tool === "edit" || tool === "image") {
        return {
          referenceImageUrl,
          extraImageUrls,
        };
      }
      return {
        referenceImageUrl: null,
        extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
      };
    },
    [extraImageUrls, referenceImageUrl, videoExtraImageUrls, videoReferenceImageUrl]
  );

  const findOutputById = useCallback(
    (id: string) => {
      if (outputSelectorStoreEnabled && selectorCallbacksEnabled) {
        return getOutputById(id);
      }
      if (!id) return null;
      return outputs.find((item) => item.id === id) ?? null;
    },
    [getOutputById, outputSelectorStoreEnabled, outputs, selectorCallbacksEnabled]
  );

  return {
    inFlightOutputIds,
    resolvePanelOutputPreviewUrl,
    resolveReferenceInputsForTool,
    findOutputById,
  };
};
