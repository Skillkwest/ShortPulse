/**
 * Compatibility hook for non-Create callers that still bind an agent runtime
 * with runtimeMode. Active Create paths should use the mode-owned hooks.
 */
import { resolveStudioAgentTransportSuccess } from "./client/transportResultResolution";
import { sendStudioAgentTurn as sendStudioAgentTurnWithRuntimeMode } from "./client/studioAgentTransport";
import { useCreateAgentStateCore } from "./useCreateAgentStateCore";
import type { UseAiAgentOptions } from "./useAiAgentTypes";

export const useAiAgent = ({
  runtimeMode = "standard",
  sendAgentTurn = sendStudioAgentTurnWithRuntimeMode,
  resolveTransportSuccess = resolveStudioAgentTransportSuccess,
  ...options
}: UseAiAgentOptions = {}) =>
  useCreateAgentStateCore({
    ...options,
    requestRuntimeMode: runtimeMode,
    allowSessionNamespaceOverride: runtimeMode !== "standard",
    sessionNamespaceOverrideErrorText:
      runtimeMode === "standard"
        ? "Standard agent cannot send to an override session namespace."
        : undefined,
    sendAgentTurn,
    resolveTransportSuccess,
  });
