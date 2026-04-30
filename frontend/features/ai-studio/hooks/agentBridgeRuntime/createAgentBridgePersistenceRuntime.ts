import type { AgentAttachment, AgentMessage } from "../../../../prefabs/agent";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type {
  AiStudioSessionAgentMessageV1,
  AiStudioSessionAgentRuntimesV2,
} from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";

export type AgentBridgeRuntimeState = {
  messages: AgentMessage[];
  input: string;
  attachments: AgentAttachment[];
  latestAgentPrompt: string | null;
  promptOrigin: PromptOrigin;
  chatModeEnabled: boolean;
};

type AgentBridgeHydrationRuntime = AiStudioSessionHydrationPayload["agent"];

export const createAgentBridgeRuntimeStateFromHydration = (
  runtime: AgentBridgeHydrationRuntime,
  options?: {
    forceChatModeEnabled?: boolean;
  }
): AgentBridgeRuntimeState => ({
  messages: runtime.messages,
  input: runtime.input,
  attachments: [],
  latestAgentPrompt: runtime.latestAgentPrompt,
  promptOrigin: runtime.promptOrigin,
  chatModeEnabled: options?.forceChatModeEnabled ?? runtime.chatModeEnabled,
});

const createPersistedAgentRuntimeSnapshot = (
  runtime: AgentBridgeRuntimeState,
  options?: {
    forceChatModeEnabled?: boolean;
  }
): AiStudioSessionAgentRuntimesV2["standard"] => ({
  messages: runtime.messages.map(
    (message): AiStudioSessionAgentMessageV1 => ({
      id: message.id ?? null,
      role: message.role,
      content: message.content,
      attachments: message.attachments?.map((attachment) => ({
        id: attachment.id,
        kind: attachment.kind,
        referenceId: attachment.referenceId ?? null,
        text: attachment.text ?? null,
        imageUrl: attachment.imageUrl ?? null,
        aspect: attachment.aspect ?? null,
        deliveryStatus: attachment.deliveryStatus,
        deliveryError: attachment.deliveryError ?? null,
      })),
    })
  ),
  input: runtime.input,
  latestAgentPrompt: runtime.latestAgentPrompt,
  promptOrigin: runtime.promptOrigin,
  chatModeEnabled: options?.forceChatModeEnabled ?? runtime.chatModeEnabled,
  pulseWorkflowSession: null,
});

export const buildPersistedCreateAgentRuntimes = ({
  agentBridgeRuntimeStateBySessionKey,
  createDefaultRuntimeState,
  hasStoredPulseSession,
  pulseRuntimeScopeKey,
  resolvedStoredPulsePresetId,
  sessionId,
}: {
  agentBridgeRuntimeStateBySessionKey: Record<string, AgentBridgeRuntimeState>;
  createDefaultRuntimeState: (options?: {
    forceChatModeEnabled?: boolean;
  }) => AgentBridgeRuntimeState;
  hasStoredPulseSession: boolean;
  pulseRuntimeScopeKey: string;
  resolvedStoredPulsePresetId: string | null;
  sessionId: string | null;
}): AiStudioSessionAgentRuntimesV2 => ({
  standard: createPersistedAgentRuntimeSnapshot(
    agentBridgeRuntimeStateBySessionKey[`${sessionId ?? "none"}::standard`] ??
      createDefaultRuntimeState()
  ),
  pulsePresetId: hasStoredPulseSession ? resolvedStoredPulsePresetId : null,
  pulse: createPersistedAgentRuntimeSnapshot(
    hasStoredPulseSession
      ? (agentBridgeRuntimeStateBySessionKey[`${sessionId ?? "none"}::${pulseRuntimeScopeKey}`] ??
          createDefaultRuntimeState({ forceChatModeEnabled: true }))
      : createDefaultRuntimeState({ forceChatModeEnabled: true }),
    { forceChatModeEnabled: true }
  ),
});

export const buildHydratedCreateAgentRuntimeStateBySessionKey = ({
  workspace,
  agentRuntimes,
  sessionId,
}: Pick<AiStudioSessionHydrationPayload, "workspace" | "agentRuntimes"> & {
  sessionId: string | null;
}): {
  nextStateBySessionKey: Record<string, AgentBridgeRuntimeState>;
  restoredPulseWorkflowSession: AiStudioSessionAgentRuntimesV2["pulse"]["pulseWorkflowSession"];
} => {
  const sessionKeyPrefix = `${sessionId ?? "none"}::`;
  const nextStateBySessionKey: Record<string, AgentBridgeRuntimeState> = {
    [`${sessionKeyPrefix}standard`]: createAgentBridgeRuntimeStateFromHydration(
      agentRuntimes.standard
    ),
  };
  const pulsePresetId =
    workspace.expertCreateMode === "pulse"
      ? (agentRuntimes.pulsePresetId ?? workspace.activePulsePresetId)
      : null;
  const restoredPulseSessionInstanceId =
    workspace.expertCreateMode === "pulse" ? workspace.pulseSessionInstanceId : null;
  if (pulsePresetId && restoredPulseSessionInstanceId) {
    nextStateBySessionKey[
      `${sessionKeyPrefix}pulse:${pulsePresetId}:${restoredPulseSessionInstanceId}`
    ] = createAgentBridgeRuntimeStateFromHydration(agentRuntimes.pulse, {
      forceChatModeEnabled: true,
    });
  }

  return {
    nextStateBySessionKey,
    restoredPulseWorkflowSession:
      pulsePresetId && restoredPulseSessionInstanceId
        ? (agentRuntimes.pulse.pulseWorkflowSession ?? null)
        : null,
  };
};
