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
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
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
  setArchivedOutputs,
  setUiError,
}: UseAiStudioStateSupportControllersParams) => {
  const referenceIngestion = useAiStudioReferenceIngestionActions({
    activeOutput,
    projectId,
    outputs,
    mode,
    aspect,
    model,
    setOutputs,
    archivedOutputs,
    setArchivedOutputs,
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
