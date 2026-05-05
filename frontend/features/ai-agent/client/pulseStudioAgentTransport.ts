/**
 * Pulse Create agent transport.
 * Posts only to the Pulse Create agent route and keeps direct bypass unavailable.
 */
import type { AgentApiRequest } from "../../../prefabs/agent";
import { sendStudioAgentTurnToEndpoint } from "./studioAgentTransport";

/**
 * Sends one Pulse Create agent turn.
 */
export const sendPulseCreateAgentTurn = (body: AgentApiRequest) =>
  sendStudioAgentTurnToEndpoint("/api/ai/studio-agent-pulse", {
    ...body,
    runtimeMode: "pulse",
  });
