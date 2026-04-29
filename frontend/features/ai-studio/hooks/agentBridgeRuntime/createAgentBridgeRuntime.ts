import type { ToolId } from "../../types";
import {
  normalizeCreateAgentPulsePresetId,
  normalizeCreateAgentPulseSessionInstanceId,
  resolveCreateAgentModeRuntimeState,
} from "./createAgentModeRuntimeIdentity";

export type CreateAgentBridgeRuntimeKind = "standard" | "pulse";

export type CreateAgentBridgeRuntime = {
  kind: CreateAgentBridgeRuntimeKind;
  isPulseCreateMode: boolean;
  requestRuntimeMode: CreateAgentBridgeRuntimeKind;
  resolvedStoredPulsePresetId: string | null;
  resolvedStoredPulseSessionInstanceId: string | null;
  hasStoredPulseSession: boolean;
  hasVisiblePulseSession: boolean;
  pulseRuntimeScopeKey: string;
  agentRuntimeScopeKey: string;
  agentBridgeSessionKey: string;
  standardAgentSessionNamespace: string;
  pulseAgentSessionNamespace: string;
  activeAgentSessionNamespace: string;
  allowAgentSessionNamespaceOverride: boolean;
  sessionNamespaceOverrideErrorText?: string;
  defaultRuntimeStateOptions?: { forceChatModeEnabled: true };
  effectiveChatMode: (standardChatModeEnabled: boolean) => boolean;
  shouldHydrateStandardChatMode: boolean;
  shouldMirrorAssistantPromptToSharedPrompt: (selectedTool: ToolId | null) => boolean;
};

export const resolveCreateAgentBridgeRuntime = ({
  sessionId,
  expertCreateMode,
  activePulsePresetId,
  pulseSessionInstanceId,
}: {
  sessionId: string | null;
  expertCreateMode: "standard" | "pulse";
  activePulsePresetId: string | null;
  pulseSessionInstanceId: string | null;
}): CreateAgentBridgeRuntime => {
  const { isPulseCreateMode } = resolveCreateAgentModeRuntimeState({
    expertCreateMode,
    activePulsePresetId,
    pulseSessionInstanceId,
  });
  const resolvedStoredPulsePresetId = normalizeCreateAgentPulsePresetId(activePulsePresetId);
  const resolvedStoredPulseSessionInstanceId = resolvedStoredPulsePresetId
    ? normalizeCreateAgentPulseSessionInstanceId(pulseSessionInstanceId)
    : null;
  const hasStoredPulseSession =
    resolvedStoredPulsePresetId !== null && resolvedStoredPulseSessionInstanceId !== null;
  const hasVisiblePulseSession = isPulseCreateMode && hasStoredPulseSession;
  const pulseRuntimeScopeKey = hasStoredPulseSession
    ? `pulse:${resolvedStoredPulsePresetId}:${resolvedStoredPulseSessionInstanceId}`
    : "pulse:inactive";
  const agentRuntimeScopeKey = isPulseCreateMode ? pulseRuntimeScopeKey : "standard";
  const sessionKeyPrefix = sessionId ?? "none";
  const standardAgentSessionNamespace = `ai-studio:${sessionKeyPrefix}::standard`;
  const pulseAgentSessionNamespace = `ai-studio:${sessionKeyPrefix}::${pulseRuntimeScopeKey}`;

  return {
    kind: isPulseCreateMode ? "pulse" : "standard",
    isPulseCreateMode,
    requestRuntimeMode: isPulseCreateMode ? "pulse" : "standard",
    resolvedStoredPulsePresetId,
    resolvedStoredPulseSessionInstanceId,
    hasStoredPulseSession,
    hasVisiblePulseSession,
    pulseRuntimeScopeKey,
    agentRuntimeScopeKey,
    agentBridgeSessionKey: `${sessionKeyPrefix}::${agentRuntimeScopeKey}`,
    standardAgentSessionNamespace,
    pulseAgentSessionNamespace,
    activeAgentSessionNamespace: isPulseCreateMode
      ? pulseAgentSessionNamespace
      : standardAgentSessionNamespace,
    allowAgentSessionNamespaceOverride: isPulseCreateMode,
    sessionNamespaceOverrideErrorText: isPulseCreateMode
      ? undefined
      : "Standard agent cannot send to an override session namespace.",
    defaultRuntimeStateOptions: isPulseCreateMode ? { forceChatModeEnabled: true } : undefined,
    effectiveChatMode: (standardChatModeEnabled) =>
      isPulseCreateMode ? true : standardChatModeEnabled,
    shouldHydrateStandardChatMode: !isPulseCreateMode,
    shouldMirrorAssistantPromptToSharedPrompt: (selectedTool) =>
      !isPulseCreateMode && (selectedTool === "create" || selectedTool === "text"),
  };
};
