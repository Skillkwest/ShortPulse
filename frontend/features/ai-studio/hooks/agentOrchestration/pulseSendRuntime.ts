import type { AgentContext, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { Dispatch, SetStateAction } from "react";
import {
  PULSE_IMAGE_INTAKE_REQUIRED_NOTICE,
  hasPulseImageContext,
  isPulseImageIntakeStep,
} from "../../logic/pulseImageIntake";
import { buildPendingPulseWorkflowSessionForUserInput } from "../../logic/pulseWorkflowSession";

type PulseWorkflowPresetContext = {
  presetId: string;
  runtimeMode?: "workflow_gpt" | "custom_gpt";
  starterAssistantMessage?: string | null;
  workflowStageHints?: readonly string[] | null;
  workflowSession?: AgentPulseWorkflowSession | null;
};

/**
 * Returns the Pulse-only image intake block notice for workflow steps that require an image.
 */
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

/**
 * Builds the Pulse-owned request context and optimistic workflow session for a user reply.
 */
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
          runtimeMode: workflowPulse.runtimeMode,
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

/**
 * Captures Pulse workflow-session updates inside the Pulse orchestration runtime boundary.
 */
export const capturePulseWorkflowSession = ({
  workflowSession,
  setPulseWorkflowSession,
}: {
  workflowSession?: AgentPulseWorkflowSession | null;
  setPulseWorkflowSession: Dispatch<SetStateAction<AgentPulseWorkflowSession | null>>;
}) => {
  if (workflowSession) {
    setPulseWorkflowSession(workflowSession);
  }
};
