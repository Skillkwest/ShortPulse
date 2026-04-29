import type { AgentContext } from "../../../../prefabs/agent";
import { resolvePulseRuntimeState } from "../../logic/pulseSessionState";
import type { StudioOutput } from "../../types";

type WorkflowPulseContext = NonNullable<AgentContext["pulse"]> & {
  runtimeMode: "workflow_gpt";
};

export type CreateAgentOrchestrationRuntimePolicy = {
  kind: "standard" | "pulse";
  hasActivePulseSession: boolean;
  pulseSessionInstanceId: string | null;
  includeActiveOutput: boolean;
  resolveSelectedOverride: (
    selectedOverride: StudioOutput | null | undefined
  ) => StudioOutput | null | undefined;
  resolveWorkflowPulse: (context: AgentContext) => WorkflowPulseContext | null;
  hasPromptApplyPulseContext: (context: AgentContext) => boolean;
  shouldCaptureWorkflowSession: boolean;
};

const STANDARD_CREATE_AGENT_ORCHESTRATION_RUNTIME_POLICY: CreateAgentOrchestrationRuntimePolicy = {
  kind: "standard",
  hasActivePulseSession: false,
  pulseSessionInstanceId: null,
  includeActiveOutput: false,
  resolveSelectedOverride: (selectedOverride) =>
    selectedOverride === undefined ? null : selectedOverride,
  resolveWorkflowPulse: () => null,
  hasPromptApplyPulseContext: () => false,
  shouldCaptureWorkflowSession: false,
};

export const resolveCreateAgentOrchestrationRuntimePolicy = ({
  expertCreateMode,
  activePulsePresetId,
  pulseSessionInstanceId,
}: {
  expertCreateMode: "standard" | "pulse";
  activePulsePresetId: string | null;
  pulseSessionInstanceId: string | null;
}): CreateAgentOrchestrationRuntimePolicy => {
  const {
    isPulseCreateMode,
    hasActivePulseSession,
    pulseSessionInstanceId: resolvedPulseSessionInstanceId,
  } = resolvePulseRuntimeState({
    expertCreateMode,
    activePulsePresetId,
    pulseSessionInstanceId,
  });

  if (!isPulseCreateMode) {
    return STANDARD_CREATE_AGENT_ORCHESTRATION_RUNTIME_POLICY;
  }

  return {
    kind: "pulse",
    hasActivePulseSession,
    pulseSessionInstanceId: resolvedPulseSessionInstanceId,
    includeActiveOutput: true,
    resolveSelectedOverride: (selectedOverride) => selectedOverride,
    resolveWorkflowPulse: (context) =>
      context.pulse?.runtimeMode === "workflow_gpt"
        ? (context.pulse as WorkflowPulseContext)
        : null,
    hasPromptApplyPulseContext: (context) => Boolean(context.pulse),
    shouldCaptureWorkflowSession: true,
  };
};
