/**
 * Active Create agent runtime binding for the AI Studio bridge.
 * Owns the mode-specific session namespace, request mode, transport, context builder, and response parser wiring.
 */
import { useMemo } from "react";
import { useCreateAgentStateCore } from "../../../ai-agent/useCreateAgentStateCore";
import type { AgentApiRequest, AgentContext, AgentResponse } from "../../../../prefabs/agent";
import type { ToolId } from "../../types";
import type { CreateAgentBridgeRuntime } from "./createAgentBridgeRuntime";
import { standardCreateAgentRuntimeBinding } from "./standardCreateAgentRuntimeBinding";

type UseCreateAgentBridgeActiveAgentParams = {
  bridgeRuntime: CreateAgentBridgeRuntime;
  agentEnabled: boolean;
  chatModeEnabled: boolean;
  directOpenAiBypassEnabled: boolean;
  selectedTool: ToolId | null;
};

const loadPulseCreateAgentRuntimeBinding = async () =>
  (await import("./pulseCreateAgentRuntimeBinding")).pulseCreateAgentRuntimeBinding;

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
    if (bridgeRuntime.kind === "standard") {
      return standardCreateAgentRuntimeBinding;
    }

    return {
      buildAgentContext: async (context: AgentContext) =>
        (await loadPulseCreateAgentRuntimeBinding()).buildAgentContext(context),
      sendAgentTurn: async (body: AgentApiRequest) =>
        (await loadPulseCreateAgentRuntimeBinding()).sendAgentTurn(body),
      resolveTransportSuccess: async (response: AgentResponse) =>
        (await loadPulseCreateAgentRuntimeBinding()).resolveTransportSuccess(response),
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
