/**
 * Owns Create-mode runtime authority for Standard versus Pulse behavior.
 * Keeps mode, active Pulse selection, and Pulse workflow state together so
 * page-level callers do not hand-roll transition cleanup or cross-mode restore.
 */
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import type { AgentPulseWorkflowSession } from "../../../prefabs/agent";
import {
  isCreatePulsePresetId,
  type CreatePulsePresetId,
  type CreatePulseSavedPreset,
} from "../components/create/createPulsePresets";
import { createPulseSessionInstanceId } from "../logic/pulseSessionIdentity";
import { normalizePulseSessionInstanceId } from "../logic/pulseSessionState";

export type AiStudioExpertCreateMode = "standard" | "pulse";

type UseAiStudioCreateModeRuntimeParams = {
  projectId?: string | null;
  selectedCreatePulsePresetIds: readonly CreatePulsePresetId[];
  savedCreatePulsePresets: readonly CreatePulseSavedPreset[];
  initialExpertCreateMode?: AiStudioExpertCreateMode;
  initialActiveCreatePulsePresetId?: CreatePulsePresetId | null;
  initialPulseSessionInstanceId?: string | null;
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
  initialPulseSessionInstanceId = null,
  initialPulseWorkflowSession = null,
}: UseAiStudioCreateModeRuntimeParams) => {
  const [expertCreateModeState, setExpertCreateModeState] =
    useState<AiStudioExpertCreateMode>(initialExpertCreateMode);
  const [activeCreatePulsePresetIdState, setActiveCreatePulsePresetIdState] =
    useState<CreatePulsePresetId | null>(initialActiveCreatePulsePresetId);
  const [pulseSessionInstanceIdState, setPulseSessionInstanceIdState] = useState<string | null>(
    initialPulseSessionInstanceId
  );
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

  const setPulseSessionInstanceId: Dispatch<SetStateAction<string | null>> = useCallback(
    (value) => {
      setPulseSessionInstanceIdState((current) => resolveStateActionValue(value, current));
    },
    []
  );

  const setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>> =
    useCallback((value) => {
      setPulseWorkflowSessionState((current) => resolveStateActionValue(value, current));
    }, []);

  const clearPulseRuntime = useCallback(() => {
    setActiveCreatePulsePresetIdState(null);
    setPulseSessionInstanceIdState(null);
    setPulseWorkflowSessionState(null);
  }, []);

  const enterPulseMode = useCallback(() => {
    setExpertCreateModeState("pulse");
  }, []);

  const deactivatePulse = useCallback(() => {
    setExpertCreateModeState("pulse");
    clearPulseRuntime();
  }, [clearPulseRuntime]);

  const exitPulseMode = useCallback(() => {
    setExpertCreateModeState("standard");
    clearPulseRuntime();
  }, [clearPulseRuntime]);

  const activatePulse = useCallback((presetId: CreatePulsePresetId) => {
    const sessionInstanceId = createPulseSessionInstanceId();
    setExpertCreateModeState("pulse");
    setActiveCreatePulsePresetIdState(presetId);
    setPulseSessionInstanceIdState(sessionInstanceId);
    setPulseWorkflowSessionState(null);
    return sessionInstanceId;
  }, []);

  const restartPulse = useCallback(() => {
    if (!activeCreatePulsePresetIdState) return null;
    const sessionInstanceId = createPulseSessionInstanceId();
    setExpertCreateModeState("pulse");
    setPulseSessionInstanceIdState(sessionInstanceId);
    setPulseWorkflowSessionState(null);
    return {
      presetId: activeCreatePulsePresetIdState,
      sessionInstanceId,
    };
  }, [activeCreatePulsePresetIdState]);

  const handleExpertCreateModeChange = useCallback(
    (nextMode: AiStudioExpertCreateMode) => {
      setExpertCreateModeState((current) => (current === nextMode ? current : nextMode));
      if (nextMode === "standard") {
        clearPulseRuntime();
      }
    },
    [clearPulseRuntime]
  );

  const handleActiveCreatePulsePresetIdChange = useCallback(
    (nextPresetId: CreatePulsePresetId | null) => {
      if (!nextPresetId) {
        deactivatePulse();
        return null;
      }
      if (
        activeCreatePulsePresetIdState === nextPresetId &&
        normalizePulseSessionInstanceId(pulseSessionInstanceIdState)
      ) {
        return null;
      }
      return activatePulse(nextPresetId);
    },
    [activatePulse, activeCreatePulsePresetIdState, deactivatePulse, pulseSessionInstanceIdState]
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
    pulseSessionInstanceId: pulseSessionInstanceIdState,
    pulseWorkflowSession: pulseWorkflowSessionState,
    setExpertCreateMode,
    setActiveCreatePulsePresetId,
    setPulseSessionInstanceId,
    setPulseWorkflowSession,
    clearPulseRuntime,
    enterPulseMode,
    activatePulse,
    restartPulse,
    deactivatePulse,
    exitPulseMode,
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  };
};
