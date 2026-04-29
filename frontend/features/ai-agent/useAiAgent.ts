/**
 * Compatibility hook for non-Create callers that still bind an agent runtime
 * with runtimeMode. Active Create paths should use the mode-owned hooks.
 */
import { resolvePulseCreateAgentTransportSuccess } from "./client/pulseTransportResultResolution";
import { sendPulseCreateAgentTurn } from "./client/pulseStudioAgentTransport";
import { resolveStandardCreateAgentTransportSuccess } from "./client/standardTransportResultResolution";
import { sendStandardCreateAgentTurn } from "./client/standardStudioAgentTransport";
import { buildAgentContext } from "./logic/contextBuilder";
import { buildStandardCreateAgentContext } from "./logic/standardContextBuilder";
import { useCreateAgentStateCore } from "./useCreateAgentStateCore";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

export const useAiAgent = ({
  runtimeMode = "standard",
  sendAgentTurn,
  resolveTransportSuccess,
  ...options
}: UseAiAgentOptions = {}) => {
  const isPulseRuntime = runtimeMode === "pulse";
  const resolvedSendAgentTurn =
    sendAgentTurn ?? (isPulseRuntime ? sendPulseCreateAgentTurn : sendStandardCreateAgentTurn);
  const resolvedTransportSuccess =
    resolveTransportSuccess ??
    (isPulseRuntime
      ? resolvePulseCreateAgentTransportSuccess
      : (response) => ({
          ...resolveStandardCreateAgentTransportSuccess(response),
          workflowSession: null,
        }));

  return useCreateAgentStateCore({
    ...options,
    requestRuntimeMode: runtimeMode,
    allowSessionNamespaceOverride: isPulseRuntime,
    sessionNamespaceOverrideErrorText: !isPulseRuntime
      ? "Standard agent cannot send to an override session namespace."
      : undefined,
    buildAgentContext: isPulseRuntime ? buildAgentContext : buildStandardCreateAgentContext,
    sendAgentTurn: resolvedSendAgentTurn,
    resolveTransportSuccess: resolvedTransportSuccess,
  });
};
