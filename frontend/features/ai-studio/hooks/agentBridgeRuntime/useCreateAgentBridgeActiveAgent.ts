/**
 * Active Create agent runtime binding for the AI Studio bridge.
 * Owns the mode-specific session namespace, request mode, transport, context builder, and response parser wiring.
 */
import { useMemo } from "react";
import { useCreateAgentStateCore } from "../../../ai-agent/useCreateAgentStateCore";
import type { AgentApiRequest, AgentContext, AgentResponse } from "../../../../prefabs/agent";
import type { ToolId } from "../../types";
import type { CreateAgentBridgeRuntime } from "./createAgentBridgeRuntime";
import { loadCreateAgentRuntimeBinding } from "./createAgentRuntimeBindingLoader";

type UseCreateAgentBridgeActiveAgentParams = {
  bridgeRuntime: CreateAgentBridgeRuntime;
  agentEnabled: boolean;
  chatModeEnabled: boolean;
  directOpenAiBypassEnabled: boolean;
  selectedTool: ToolId | null;
};

/**
 * Returns the active mode-owned Create agent state engine for the bridge.
 */
export const useCreateAgentBridgeActiveAgent = ({
  bridgeRuntime,
  agentEnabled,
  chatModeEnabled,
  directOpenAiBypassEnabled,
  selectedTool,
}: UseCreateAgentBridgeActiveAgentParams) => {
  const activeAgentRuntimeBinding = useMemo(() => {
    const runtimeKind = bridgeRuntime.kind;
    return {
      buildAgentContext: async (context: AgentContext) =>
        (await loadCreateAgentRuntimeBinding(runtimeKind)).buildAgentContext(context),
      sendAgentTurn: async (body: AgentApiRequest) =>
        (await loadCreateAgentRuntimeBinding(runtimeKind)).sendAgentTurn(body),
      resolveTransportSuccess: async (response: AgentResponse) =>
        (await loadCreateAgentRuntimeBinding(runtimeKind)).resolveTransportSuccess(response),
    };
  }, [bridgeRuntime.kind]);

  return useCreateAgentStateCore({
    enabled: agentEnabled,
    sessionNamespace: bridgeRuntime.activeAgentSessionNamespace,
    directOpenAiBypassEnabled:
      chatModeEnabled &&
      directOpenAiBypassEnabled &&
      bridgeRuntime.shouldMirrorAssistantPromptToSharedPrompt(selectedTool),
    requestRuntimeMode: bridgeRuntime.requestRuntimeMode,
    allowSessionNamespaceOverride: bridgeRuntime.allowAgentSessionNamespaceOverride,
    sessionNamespaceOverrideErrorText: bridgeRuntime.sessionNamespaceOverrideErrorText,
    buildAgentContext: activeAgentRuntimeBinding.buildAgentContext,
    sendAgentTurn: activeAgentRuntimeBinding.sendAgentTurn,
    resolveTransportSuccess: activeAgentRuntimeBinding.resolveTransportSuccess,
  });
};
