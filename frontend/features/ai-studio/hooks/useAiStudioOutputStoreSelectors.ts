import { useCallback } from "react";
import {
  getAiStudioOutputById,
  getAiStudioOutputSnapshot,
  subscribeAiStudioOutputs,
  type AiStudioOutputStoreSnapshot,
} from "./aiStudioOutputStore";
import type { StudioOutput } from "../types";

type UseAiStudioOutputStoreSelectorsArgs = {
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
};

export const useAiStudioOutputStoreSelectors = ({
  outputs,
  archivedOutputs,
}: UseAiStudioOutputStoreSelectorsArgs) => {
  const selectActiveOutputs = useCallback(() => outputs, [outputs]);
  const selectArchivedOutputs = useCallback(() => archivedOutputs, [archivedOutputs]);
  const getOutputById = useCallback(
    (id: string) => {
      if (!id) return null;
      const activeMatch = outputs.find((output) => output.id === id);
      if (activeMatch) return activeMatch;
      const archivedMatch = archivedOutputs.find((output) => output.id === id);
      if (archivedMatch) return archivedMatch;
      return getAiStudioOutputById(id);
    },
    [archivedOutputs, outputs]
  );
  const subscribeOutputs = useCallback((listener: () => void) => {
    return subscribeAiStudioOutputs(listener);
  }, []);
  const getOutputSnapshot = useCallback((): AiStudioOutputStoreSnapshot => {
    return getAiStudioOutputSnapshot();
  }, []);
  const selectOutputById = useCallback((id: string) => getOutputById(id), [getOutputById]);

  return {
    selectActiveOutputs,
    selectArchivedOutputs,
    getOutputById,
    subscribeOutputs,
    getOutputSnapshot,
    selectOutputById,
  };
};
