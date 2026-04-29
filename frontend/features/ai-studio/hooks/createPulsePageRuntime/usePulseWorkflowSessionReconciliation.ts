import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { AgentMessage, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { CreatePulseResolvedPreset } from "../../components/create/createPulsePresets";

type UsePulseWorkflowSessionReconciliationParams = {
  hasActivePulseSession: boolean;
  activeCreatePulsePresetId: string | null;
  activeCreatePulsePresetSnapshot: CreatePulseResolvedPreset | null;
  agentMessages: AgentMessage[];
  agentBusy: boolean;
  pulseWorkflowSession: AgentPulseWorkflowSession | null;
  setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
};

export const usePulseWorkflowSessionReconciliation = ({
  hasActivePulseSession,
  activeCreatePulsePresetId,
  activeCreatePulsePresetSnapshot,
  agentMessages,
  agentBusy,
  pulseWorkflowSession,
  setPulseWorkflowSession,
}: UsePulseWorkflowSessionReconciliationParams) => {
  useEffect(() => {
    if (!hasActivePulseSession) {
      setPulseWorkflowSession(null);
      return;
    }
    const activeWorkflowPulsePreset =
      activeCreatePulsePresetSnapshot?.presetId === activeCreatePulsePresetId &&
      activeCreatePulsePresetSnapshot.runtimeMode === "workflow_gpt"
        ? activeCreatePulsePresetSnapshot
        : null;
    let cancelled = false;
    void import("../../logic/pulseWorkflowSession").then(
      ({
        arePulseWorkflowSessionsEqual,
        derivePulseWorkflowSession,
        reconcilePulseWorkflowSession,
      }) => {
        if (cancelled) return;
        const derivedPulseWorkflowSession = derivePulseWorkflowSession({
          preset: activeWorkflowPulsePreset
            ? {
                presetId: activeWorkflowPulsePreset.presetId,
                runtimeMode: activeWorkflowPulsePreset.runtimeMode,
                starterAssistantMessage: activeWorkflowPulsePreset.starterAssistantMessage,
                workflowStageHints: activeWorkflowPulsePreset.workflowStageHints,
              }
            : null,
          agentMessages,
          isSending: agentBusy,
        });
        const reconciledPulseWorkflowSession = reconcilePulseWorkflowSession({
          authoritative: pulseWorkflowSession,
          derived: derivedPulseWorkflowSession,
          isSending: agentBusy,
        });
        setPulseWorkflowSession((current) =>
          arePulseWorkflowSessionsEqual(current, reconciledPulseWorkflowSession)
            ? current
            : reconciledPulseWorkflowSession
        );
      }
    );
    return () => {
      cancelled = true;
    };
  }, [
    activeCreatePulsePresetId,
    activeCreatePulsePresetSnapshot,
    agentBusy,
    agentMessages,
    hasActivePulseSession,
    pulseWorkflowSession,
    setPulseWorkflowSession,
  ]);
};
