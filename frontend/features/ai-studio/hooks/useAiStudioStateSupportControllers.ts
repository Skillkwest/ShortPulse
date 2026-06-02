import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput } from "../types";
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
}: UseAiStudioStateSupportControllersParams) => {
  const referenceIngestion = useAiStudioReferenceIngestionActions({
    activeOutput,
    projectId,
    mode,
    aspect,
    model,
    setOutputs,
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
