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
  activeOutputOrder: string[];
  archivedOutputOrder: string[];
  curatedReferenceIds: string[];
  setActiveOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
  setArchivedOutputState: Dispatch<SetStateAction<StudioOutputCollectionState>>;
  setOutputs: Dispatch<SetStateAction<StudioOutput[]>>;
};

export const useAiStudioOutputPersistenceEffects = ({
  outputs,
  archivedOutputs,
  setOutputsState,
  setArchivedOutputs,
  referenceProjectionState,
  setReferenceProjectionState,
  referenceProjectionStateRef,
  activeOutputOrder,
  archivedOutputOrder,
  curatedReferenceIds,
  setActiveOutputState,
  setArchivedOutputState,
  setOutputs,
}: UseAiStudioOutputPersistenceEffectsArgs) => {
  useAiStudioReferenceProjectionEffects({
    referenceProjectionState,
    setReferenceProjectionState,
    referenceProjectionStateRef,
    activeOutputOrder,
    archivedOutputOrder,
    curatedReferenceIds,
    setActiveOutputState,
    setArchivedOutputState,
    setOutputs,
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
