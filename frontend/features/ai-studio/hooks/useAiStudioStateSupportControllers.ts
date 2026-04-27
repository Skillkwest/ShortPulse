import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../types";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioOutputStoreSelectors } from "./useAiStudioOutputStoreSelectors";
import { useAiStudioReferenceIngestionActions } from "./useAiStudioReferenceIngestionActions";

type UseAiStudioStateSupportControllersParams = {
  archivedOutputs: StudioOutput[];
  aspect: string;
  mode: StudioOutput["mode"];
  model: string | null;
  outputs: StudioOutput[];
  setOutputs: (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => void;
  setSharedPrompt: (value: string) => void;
  setUiError: Dispatch<SetStateAction<string | null>>;
  updateOutputById: ReturnType<typeof useAiStudioOutputLifecycle>["updateOutputById"];
};

export const useAiStudioStateSupportControllers = ({
  archivedOutputs,
  aspect,
  mode,
  model,
  outputs,
  setOutputs,
  setSharedPrompt,
  setUiError,
  updateOutputById,
}: UseAiStudioStateSupportControllersParams) => {
  const referenceIngestion = useAiStudioReferenceIngestionActions({
    mode,
    aspect,
    model,
    setOutputs,
    updateOutputById,
    setSharedPrompt,
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
