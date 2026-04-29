/**
 * Standard Create agent transport.
 * Posts only to the Standard Create agent route and stamps the Standard contract.
 */
import type { AgentApiRequest } from "../../../prefabs/agent";
import { sendStudioAgentTurnToEndpoint } from "./studioAgentTransport";

/**
 * Sends one Standard Create agent turn.
 */
export const sendStandardCreateAgentTurn = (body: AgentApiRequest) =>
  sendStudioAgentTurnToEndpoint("/api/ai/studio-agent-standard", {
    ...body,
    runtimeMode: "standard",
  });
