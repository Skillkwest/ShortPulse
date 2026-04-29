/**
 * Standard Create agent hook.
 * Binds the reusable agent state engine to Standard-only transport and parsing.
 */
import { resolveStandardCreateAgentTransportSuccess } from "./client/standardTransportResultResolution";
import { sendStandardCreateAgentTurn } from "./client/standardStudioAgentTransport";
import { buildStandardCreateAgentContext } from "./logic/standardContextBuilder";
import { useCreateAgentStateCore } from "./useCreateAgentStateCore";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

/**
 * Creates an isolated Standard Create agent runtime.
 */
export const useStandardCreateAgent = (options: Omit<UseAiAgentOptions, "runtimeMode"> = {}) =>
  useCreateAgentStateCore({
    ...options,
    requestRuntimeMode: "standard",
    allowSessionNamespaceOverride: false,
    sessionNamespaceOverrideErrorText:
      "Standard agent cannot send to an override session namespace.",
    buildAgentContext: buildStandardCreateAgentContext,
    sendAgentTurn: sendStandardCreateAgentTurn,
    resolveTransportSuccess: resolveStandardCreateAgentTransportSuccess,
  });
