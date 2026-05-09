import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../types";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioOutputStoreSelectors } from "./useAiStudioOutputStoreSelectors";
import { useAiStudioReferenceIngestionActions } from "./useAiStudioReferenceIngestionActions";

type UseAiStudioStateSupportControllersParams = {
  activeOutput: StudioOutput | null;
  archivedOutputs: StudioOutput[];
  aspect: string;
  mode: StudioOutput["mode"];
  model: string | null;
  outputs: StudioOutput[];
  projectId?: string | null;
  setOutputs: (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  updateOutputById: ReturnType<typeof useAiStudioOutputLifecycle>["updateOutputById"];
};

export const useAiStudioStateSupportControllers = ({
  activeOutput,
  archivedOutputs,
  aspect,
  mode,
  model,
  outputs,
  projectId = null,
  setOutputs,
  setUiError,
  updateOutputById,
}: UseAiStudioStateSupportControllersParams) => {
  const referenceIngestion = useAiStudioReferenceIngestionActions({
    activeOutput,
    projectId,
    mode,
    aspect,
    model,
    setOutputs,
    updateOutputById,
    setUiError,
  });

  const outputStoreSelectors = useAiStudioOutputStoreSelectors({
    outputs,
    archivedOutputs,
  });

  return {
    ...referenceIngestion,
    ...outputStoreSelectors,
  };
};
