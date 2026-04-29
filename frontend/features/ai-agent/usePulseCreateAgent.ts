/**
 * Pulse Create agent hook.
 * Binds the reusable agent state engine to Pulse-only transport and workflow parsing.
 */
import { resolvePulseCreateAgentTransportSuccess } from "./client/transportResultResolution";
import { sendPulseCreateAgentTurn } from "./client/pulseStudioAgentTransport";
import { useAiAgent } from "./useAiAgent";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

/**
 * Creates an isolated Pulse Create agent runtime.
 */
export const usePulseCreateAgent = (options: Omit<UseAiAgentOptions, "runtimeMode"> = {}) =>
  useAiAgent({
    ...options,
    directOpenAiBypassEnabled: false,
    runtimeMode: "pulse",
    sendAgentTurn: sendPulseCreateAgentTurn,
    resolveTransportSuccess: resolvePulseCreateAgentTransportSuccess,
  });
