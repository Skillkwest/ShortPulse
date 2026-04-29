/**
 * Standard-only compatibility hook for legacy non-Create callers.
 * Active Create paths should use useStandardCreateAgent directly.
 */
import { resolveStandardCreateAgentTransportSuccess } from "./client/standardTransportResultResolution";
import { sendStandardCreateAgentTurn } from "./client/standardStudioAgentTransport";
import { buildStandardCreateAgentContext } from "./logic/standardContextBuilder";
import { useCreateAgentStateCore } from "./useCreateAgentStateCore";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

type StandardUseAiAgentOptions = Omit<UseAiAgentOptions, "runtimeMode">;

export const useAiAgent = ({
  sendAgentTurn,
  resolveTransportSuccess,
  ...options
}: StandardUseAiAgentOptions = {}) => {
  const resolvedSendAgentTurn = sendAgentTurn ?? sendStandardCreateAgentTurn;
  const resolvedTransportSuccess =
    resolveTransportSuccess ??
    ((response) => ({
      ...resolveStandardCreateAgentTransportSuccess(response),
      workflowSession: null,
    }));

  return useCreateAgentStateCore({
    ...options,
    requestRuntimeMode: "standard",
    allowSessionNamespaceOverride: false,
    sessionNamespaceOverrideErrorText:
      "Standard agent cannot send to an override session namespace.",
    buildAgentContext: buildStandardCreateAgentContext,
    sendAgentTurn: resolvedSendAgentTurn,
    resolveTransportSuccess: resolvedTransportSuccess,
  });
};
