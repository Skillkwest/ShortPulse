/**
 * Standard Create agent hook.
 * Binds the reusable agent state engine to Standard-only transport and parsing.
 */
import { resolveStandardCreateAgentTransportSuccess } from "./client/transportResultResolution";
import { sendStandardCreateAgentTurn } from "./client/standardStudioAgentTransport";
import { useAiAgent } from "./useAiAgent";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

/**
 * Creates an isolated Standard Create agent runtime.
 */
export const useStandardCreateAgent = (options: Omit<UseAiAgentOptions, "runtimeMode"> = {}) =>
  useAiAgent({
    ...options,
    runtimeMode: "standard",
    sendAgentTurn: sendStandardCreateAgentTurn,
    resolveTransportSuccess: resolveStandardCreateAgentTransportSuccess,
  });
