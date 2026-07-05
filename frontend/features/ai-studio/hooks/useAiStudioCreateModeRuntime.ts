/**
 * Owns Create-mode runtime authority for Standard versus Pulse behavior.
 * Keeps mode, active Pulse selection, and Pulse workflow state together so
 * page-level callers do not hand-roll transition cleanup or cross-mode restore.
 */
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import type { AgentPulseWorkflowSession } from "../../../prefabs/agent";
import type { CreatePulsePresetId } from "../components/create/createPulsePresets";
import { createPulseSessionInstanceId } from "../logic/pulseSessionIdentity";
import {
  normalizePulseSessionInstanceId,
  resolvePulseRuntimeState,
} from "../logic/pulseSessionState";

export type AiStudioExpertCreateMode = "standard" | "pulse";
export type AiStudioPulsePresetChangeOptions = {
  forceNewSession?: boolean;
  sessionInstanceIdOverride?: string | null;
  workflowSessionOverride?: AgentPulseWorkflowSession | null;
  preserveWorkflowSession?: boolean;
};

type UseAiStudioCreateModeRuntimeParams = {
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
  initialExpertCreateMode = "standard",
  initialActiveCreatePulsePresetId = null,
  initialPulseSessionInstanceId = null,
  initialPulseWorkflowSession = null,
}: UseAiStudioCreateModeRuntimeParams = {}) => {
  const initialPulseRuntimeState = resolvePulseRuntimeState({
    expertCreateMode: initialExpertCreateMode,
    activePulsePresetId: initialActiveCreatePulsePresetId,
    pulseSessionInstanceId: initialPulseSessionInstanceId,
  });
  const [expertCreateModeState, setExpertCreateModeState] = useState<AiStudioExpertCreateMode>(
    initialPulseRuntimeState.expertCreateMode
  );
  const [activeCreatePulsePresetIdState, setActiveCreatePulsePresetIdState] =
    useState<CreatePulsePresetId | null>(initialPulseRuntimeState.activePulsePresetId);
  const [pulseSessionInstanceIdState, setPulseSessionInstanceIdState] = useState<string | null>(
    initialPulseRuntimeState.pulseSessionInstanceId
  );
  const [pulseWorkflowSessionState, setPulseWorkflowSessionState] =
    useState<AgentPulseWorkflowSession | null>(
      initialPulseRuntimeState.hasStoredPulseSession ? initialPulseWorkflowSession : null
    );

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

  const handleExpertCreateModeChange = useCallback((nextMode: AiStudioExpertCreateMode) => {
    setExpertCreateModeState((current) => (current === nextMode ? current : nextMode));
  }, []);

  const handleActiveCreatePulsePresetIdChange = useCallback(
    (nextPresetId: CreatePulsePresetId | null, options?: AiStudioPulsePresetChangeOptions) => {
      const normalizedNextPresetId = resolvePulseRuntimeState({
        expertCreateMode: "pulse",
        activePulsePresetId: nextPresetId,
        pulseSessionInstanceId: options?.sessionInstanceIdOverride ?? pulseSessionInstanceIdState,
      }).activePulsePresetId as CreatePulsePresetId | null;

      if (!normalizedNextPresetId) {
        deactivatePulse();
        return null;
      }
      const sessionInstanceIdOverride = normalizePulseSessionInstanceId(
        options?.sessionInstanceIdOverride ?? null
      );
      if (
        !options?.forceNewSession &&
        activeCreatePulsePresetIdState === normalizedNextPresetId &&
        normalizePulseSessionInstanceId(pulseSessionInstanceIdState) &&
        (!sessionInstanceIdOverride || sessionInstanceIdOverride === pulseSessionInstanceIdState)
      ) {
        return null;
      }
      if (sessionInstanceIdOverride) {
        setExpertCreateModeState("pulse");
        setActiveCreatePulsePresetIdState(normalizedNextPresetId);
        setPulseSessionInstanceIdState(sessionInstanceIdOverride);
        if (!options?.preserveWorkflowSession) {
          setPulseWorkflowSessionState(options?.workflowSessionOverride ?? null);
        }
        return sessionInstanceIdOverride;
      }
      return activatePulse(normalizedNextPresetId);
    },
    [activatePulse, activeCreatePulsePresetIdState, deactivatePulse, pulseSessionInstanceIdState]
  );

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
    handleExpertCreateModeChange,
    handleActiveCreatePulsePresetIdChange,
  };
};
