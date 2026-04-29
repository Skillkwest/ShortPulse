/**
 * Pulse Create agent hook.
 * Binds the reusable agent state engine to Pulse-only transport and workflow parsing.
 */
import { resolvePulseCreateAgentTransportSuccess } from "./client/pulseTransportResultResolution";
import { sendPulseCreateAgentTurn } from "./client/pulseStudioAgentTransport";
import { useCreateAgentStateCore } from "./useCreateAgentStateCore";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

/**
 * Creates an isolated Pulse Create agent runtime.
 */
export const usePulseCreateAgent = (options: Omit<UseAiAgentOptions, "runtimeMode"> = {}) =>
  useCreateAgentStateCore({
    ...options,
    directOpenAiBypassEnabled: false,
    requestRuntimeMode: "pulse",
    allowSessionNamespaceOverride: true,
    sendAgentTurn: sendPulseCreateAgentTurn,
    resolveTransportSuccess: resolvePulseCreateAgentTransportSuccess,
  });
