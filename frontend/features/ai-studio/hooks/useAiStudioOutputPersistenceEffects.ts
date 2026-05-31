import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useAiStudioReferenceProjectionEffects } from "./useAiStudioReferenceProjectionEffects";
import { useAiStudioOutputObjectUrlLifecycle } from "./useAiStudioOutputObjectUrlLifecycle";
import { useAiStudioSessionReferenceDurability } from "./useAiStudioSessionReferenceDurability";
import type { ReferenceProjectionState } from "../reference-projections";
import type { StudioOutput } from "../types";
import type { StudioOutputCollectionState } from "../reference-domain";

type UseAiStudioOutputPersistenceEffectsArgs = {
  outputs: StudioOutput[];
  archivedOutputs: StudioOutput[];
  setOutputsState: Dispatch<SetStateAction<StudioOutput[]>>;
  setArchivedOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
  referenceProjectionState: ReferenceProjectionState;
  setReferenceProjectionState: Dispatch<SetStateAction<ReferenceProjectionState>>;
  referenceProjectionStateRef: MutableRefObject<ReferenceProjectionState>;
  activeOutputState: StudioOutputCollectionState;
  archivedOutputState: StudioOutputCollectionState;
  curatedReferenceIds: string[];
  deferProjectionPrune?: boolean;
  setActiveOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
  setArchivedOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
};

export const useAiStudioOutputPersistenceEffects = ({
  outputs,
  archivedOutputs,
  setOutputsState,
  setArchivedOutputs,
  referenceProjectionState,
  setReferenceProjectionState,
  referenceProjectionStateRef,
  activeOutputState,
  archivedOutputState,
  curatedReferenceIds,
  deferProjectionPrune,
  setActiveOutputState,
  setArchivedOutputState,
}: UseAiStudioOutputPersistenceEffectsArgs) => {
  useAiStudioReferenceProjectionEffects({
    referenceProjectionState,
    setReferenceProjectionState,
    referenceProjectionStateRef,
    activeOutputState,
    archivedOutputState,
    curatedReferenceIds,
    deferProjectionPrune,
    setActiveOutputState,
    setArchivedOutputState,
  });

  useAiStudioOutputObjectUrlLifecycle({
    outputs,
    archivedOutputs,
  });

  useAiStudioSessionReferenceDurability({
    outputs,
    archivedOutputs,
    setOutputsState,
    setArchivedOutputs,
  });
};
