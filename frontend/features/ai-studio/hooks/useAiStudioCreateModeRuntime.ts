/**
 * Owns Create-mode runtime authority for Standard versus Pulse behavior.
 * Keeps mode, active Pulse selection, and Pulse workflow state together so
 * page-level callers do not hand-roll transition cleanup.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AgentPulseWorkflowSession } from "../../../prefabs/agent";
import {
  isCreatePulsePresetId,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "../components/create/createPulsePresets";

export type AiStudioExpertCreateMode = "standard" | "pulse";

type UseAiStudioCreateModeRuntimeParams = {
  projectId?: string | null;
  selectedCreatePulsePresetIds: readonly CreatePulsePresetId[];
  savedCreatePulsePresets: readonly CreatePulseSavedPreset[];
  initialExpertCreateMode?: AiStudioExpertCreateMode;
  initialActiveCreatePulsePresetId?: CreatePulsePresetId | null;
  initialPulseWorkflowSession?: AgentPulseWorkflowSession | null;
};

const resolveStateActionValue = <T>(value: SetStateAction<T>, current: T): T =>
  typeof value === "function" ? (value as (previousValue: T) => T)(current) : value;

/**
 * Returns the authoritative Create-mode runtime state and interactive transitions.
 * Raw setters remain available for hydration/persistence code that must restore
 * exact state, while UI-triggered handlers apply the runtime cleanup contract.
 */
export const useAiStudioCreateModeRuntime = ({
  projectId = null,
  selectedCreatePulsePresetIds,
  savedCreatePulsePresets,
  initialExpertCreateMode = "standard",
  initialActiveCreatePulsePresetId = null,
  initialPulseWorkflowSession = null,
}: UseAiStudioCreateModeRuntimeParams) => {
  const [expertCreateModeState, setExpertCreateModeState] =
    useState<AiStudioExpertCreateMode>(initialExpertCreateMode);
  const [activeCreatePulsePresetIdState, setActiveCreatePulsePresetIdState] =
    useState<CreatePulsePresetId | null>(initialActiveCreatePulsePresetId);
  const [pulseWorkflowSessionState, setPulseWorkflowSessionState] =
    useState<AgentPulseWorkflowSession | null>(initialPulseWorkflowSession);

  const setExpertCreateMode: Dispatch<SetStateAction<AiStudioExpertCreateMode>> = useCallback(
    (value) => {
      setExpertCreateModeState((current) => resolveStateActionValue(value, current));
    },
    []
  );

  const setActiveCreatePulsePresetId: Dispatch<SetStateAction<CreatePulsePresetId | null>> =
    useCallback((value) => {
      setActiveCreatePulsePresetIdState((current) => resolveStateActionValue(value, current));
    }, []);

  const setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>> =
    useCallback((value) => {
      setPulseWorkflowSessionState((current) => resolveStateActionValue(value, current));
    }, []);

  const clearPulseRuntime = useCallback(() => {
    setActiveCreatePulsePresetIdState(null);
    setPulseWorkflowSessionState(null);
  }, []);

  const handleExpertCreateModeChange = useCallback(
    (nextMode: AiStudioExpertCreateMode) => {
      setExpertCreateModeState(nextMode);
      if (nextMode === "standard") {
        clearPulseRuntime();
      }
    },
    [clearPulseRuntime]
  );

  const handleActiveCreatePulsePresetIdChange = useCallback(
    (nextPresetId: CreatePulsePresetId | null) => {
      setActiveCreatePulsePresetIdState(nextPresetId);
      setPulseWorkflowSessionState((currentSession) => {
        if (!nextPresetId) return null;
        return currentSession?.presetId === nextPresetId ? currentSession : null;
      });
    },
    []
  );

  useEffect(() => {
    if (!activeCreatePulsePresetIdState) return;
    const isActivePulseDefined = isCreatePulsePresetId(
      activeCreatePulsePresetIdState,
      savedCreatePulsePresets
    );
    const isVisibleInPanel = selectedCreatePulsePresetIds.includes(activeCreatePulsePresetIdState);
    const isActivePulseStillAvailable = projectId
      ? isActivePulseDefined
      : isActivePulseDefined && isVisibleInPanel;
    if (!isActivePulseStillAvailable) {
      // Reconciles external preset-library changes back into the local runtime owner.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      clearPulseRuntime();
    }
  }, [
    activeCreatePulsePresetIdState,
    clearPulseRuntime,
    projectId,
    savedCreatePulsePresets,
    selectedCreatePulsePresetIds,
  ]);

  return {
    expertCreateMode: expertCreateModeState,
    activeCreatePulsePresetId: activeCreatePulsePresetIdState,
    pulseWorkflowSession: pulseWorkflowSessionState,
    setExpertCreateMode,
    setActiveCreatePulsePresetId,
    setPulseWorkflowSession,
    clearPulseRuntime,
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  };
};
