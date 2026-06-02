import type {
  AgentApiContext,
  AgentApiRequest,
  AgentContext,
  AgentResponse,
} from "../../../../prefabs/agent";
import type { CreateAgentTransportSuccess } from "../../../ai-agent/createAgentStateTypes";
import type { StudioAgentTransportResult } from "../../../ai-agent/client/studioAgentTransport";

export type CreateAgentRuntimeBinding = {
  buildAgentContext: (context: AgentContext) => AgentApiContext;
  sendAgentTurn: (body: AgentApiRequest) => Promise<StudioAgentTransportResult>;
  resolveTransportSuccess: (response: AgentResponse) => CreateAgentTransportSuccess;
};
