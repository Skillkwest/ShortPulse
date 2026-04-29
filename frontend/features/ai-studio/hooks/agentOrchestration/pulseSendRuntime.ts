import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import {
  PULSE_IMAGE_INTAKE_REQUIRED_NOTICE,
  hasPulseImageContext,
  isPulseImageIntakeStep,
} from "../../logic/pulseImageIntake";
import { buildPendingPulseWorkflowSessionForUserInput } from "../../logic/pulseWorkflowSession";

type PulseWorkflowPresetContext = {
  presetId: string;
  starterAssistantMessage?: string | null;
  workflowStageHints?: readonly string[] | null;
  workflowSession?: AgentPulseWorkflowSession | null;
};

export const resolvePulseImageIntakeBlock = ({
  context,
  hasImageAttachment,
}: {
  context: AgentContext;
  hasImageAttachment: boolean;
}): string | null => {
  if (
    isPulseImageIntakeStep(context.pulse) &&
    !hasImageAttachment &&
    !hasPulseImageContext(context)
  ) {
    return PULSE_IMAGE_INTAKE_REQUIRED_NOTICE;
  }
  return null;
};

export const buildPulseRequestContextForUserInput = ({
  context,
  workflowPulse,
  userInput,
}: {
  context: AgentContext;
  workflowPulse: PulseWorkflowPresetContext | null;
  userInput: string;
}): {
  requestContext: AgentContext;
  pendingWorkflowSession: AgentPulseWorkflowSession | null;
} => {
  const pendingWorkflowSession = buildPendingPulseWorkflowSessionForUserInput({
    preset: workflowPulse
      ? {
          presetId: workflowPulse.presetId,
          runtimeMode: "workflow_gpt",
          starterAssistantMessage: workflowPulse.starterAssistantMessage,
          workflowStageHints: workflowPulse.workflowStageHints,
        }
      : null,
    existingSession: workflowPulse?.workflowSession ?? null,
    userInput,
  });
  return {
    requestContext:
      pendingWorkflowSession && context.pulse
        ? {
            ...context,
            pulse: {
              ...context.pulse,
              workflowSession: pendingWorkflowSession,
            },
          }
        : context,
    pendingWorkflowSession,
  };
};
