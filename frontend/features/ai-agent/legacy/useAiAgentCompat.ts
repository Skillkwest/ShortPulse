/**
 * Legacy compatibility hook for tests and old non-Create callers.
 * Active Create paths must use useStandardCreateAgent or usePulseCreateAgent.
 */
import { resolvePulseCreateAgentTransportSuccess } from "../client/pulseTransportResultResolution";
import { sendPulseCreateAgentTurn } from "../client/pulseStudioAgentTransport";
import { resolveStandardCreateAgentTransportSuccess } from "../client/standardTransportResultResolution";
import { sendStandardCreateAgentTurn } from "../client/standardStudioAgentTransport";
import { buildPulseCreateAgentContext } from "../logic/pulseCreateAgentContextBuilder";
import { buildStandardCreateAgentContext } from "../logic/standardContextBuilder";
import { useCreateAgentStateCore } from "../useCreateAgentStateCore";
import type { UseAiAgentOptions } from "../useAiAgentTypes";

/**
 * Runs the pre-split mode-switching agent hook for compatibility-only callers.
 */
export const useAiAgentCompat = ({
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
    buildAgentContext: isPulseRuntime
      ? buildPulseCreateAgentContext
      : buildStandardCreateAgentContext,
    sendAgentTurn: resolvedSendAgentTurn,
    resolveTransportSuccess: resolvedTransportSuccess,
  });
};
