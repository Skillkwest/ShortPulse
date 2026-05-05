import type {
  AgentActions,
  AgentApiContext,
  AgentApiRequest,
  AgentContext,
  AgentPulseWorkflowSession,
  AgentResponse,
} from "../../../../prefabs/agent";
import type { StudioAgentTransportResult } from "../../../ai-agent/client/studioAgentTransport";

export type CreateAgentRuntimeBinding = {
  buildAgentContext: (context: AgentContext) => AgentApiContext;
  sendAgentTurn: (body: AgentApiRequest) => Promise<StudioAgentTransportResult>;
  resolveTransportSuccess: (response: AgentResponse) => {
    actions: AgentActions | undefined;
    workflowSession?: AgentPulseWorkflowSession | null;
    canonicalPrompt: string | null;
    assistantContent: string;
    assistantOutputPrompt: string | null;
  };
};
