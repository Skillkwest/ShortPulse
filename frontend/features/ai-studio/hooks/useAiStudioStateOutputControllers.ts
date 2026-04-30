import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useAiStudioDeleteOutputController } from "./useAiStudioDeleteOutputController";
import { useAiStudioFastOutputAccess } from "./useAiStudioFastOutputAccess";
import { useAiStudioOutputLifecycle } from "./useAiStudioOutputLifecycle";
import { useAiStudioPersistenceActions } from "./useAiStudioPersistenceActions";
import type { ReferenceProjectionState } from "../reference-projections";
import type { StudioOutput } from "../types";

type UseAiStudioStateOutputControllersParams = {
  activeOutputByIdRef: MutableRefObject<Record<string, StudioOutput>>;
  activeOutputId: string | null;
  aspect: string;
  model: string | null;
  pendingAutoSavesRef: MutableRefObject<Record<string, unknown>>;
  pendingFinalizeRemovalIdsRef: MutableRefObject<Set<string>>;
  projectId: string | null;
  createPrompt: string;
  quickSlotIds: string[];
  setActiveOutputId: Dispatch<SetStateAction<string | null>>;
  setActiveOutputState: Dispatch<
    SetStateAction<{ order: string[]; byId: Record<string, StudioOutput> }>
  >;
  setOutputs: (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => void;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  setSaved: Dispatch<SetStateAction<boolean>>;
  setUiError: Dispatch<SetStateAction<string | null>>;
  outputs: StudioOutput[];
};

export const useAiStudioStateOutputControllers = ({
  activeOutputByIdRef,
  activeOutputId,
  aspect,
  model,
  pendingAutoSavesRef,
  pendingFinalizeRemovalIdsRef,
  projectId,
  createPrompt,
  quickSlotIds,
  setActiveOutputId,
  setActiveOutputState,
  setOutputs,
  setReferenceProjectionState,
  setSaved,
  setUiError,
  outputs,
}: UseAiStudioStateOutputControllersParams) => {
  const { findActiveOutputById, updateActiveOutputById } = useAiStudioFastOutputAccess({
    activeOutputByIdRef,
    setActiveOutputState,
  });

  const {
    updateOutputById,
    findOutputById,
    deleteOutput: deleteOutputFromLifecycle,
    notifyGenerationFailure,
    updateOutputPrompt,
  } = useAiStudioOutputLifecycle({
    outputs,
    setOutputs,
    updateOutputByIdFast: updateActiveOutputById,
    findOutputByIdFast: findActiveOutputById,
    activeOutputId,
    setActiveOutputId,
    pendingAutoSavesRef,
  });

  const { deleteOutput, forceDeleteOutput } = useAiStudioDeleteOutputController({
    quickSlotIds,
    setReferenceProjectionState,
    setActiveOutputId,
    deleteOutputFromLifecycle,
    pendingFinalizeRemovalIdsRef,
  });

  const {
    ensureGenerationRecord,
    ensureOutputPersisted,
    saveActiveOutput,
    saveReferenceToLibrary,
    savePromptReference,
    savePromptToLibrary,
  } = useAiStudioPersistenceActions({
    projectId,
    findOutputById,
    updateOutputById,
    setUiError,
    setOutputs,
    setSaved,
    activeOutputId,
    model,
    aspect,
    prompt: createPrompt,
  });

  return {
    deleteOutput,
    ensureGenerationRecord,
    ensureOutputPersisted,
    findOutputById,
    forceDeleteOutput,
    notifyGenerationFailure,
    saveActiveOutput,
    savePromptReference,
    savePromptToLibrary,
    saveReferenceToLibrary,
    updateOutputById,
    updateOutputPrompt,
  };
};
