/**
 * Feature-local re-exports for AI agent shared types.
 * Keeps existing feature imports stable while canonical types live in `prefabs/agent`.
 */
export type {
  AgentAttachment,
  AgentActions,
  AgentApiRequest,
  AgentContext,
  AgentMediaPreview,
  AgentMessage,
  AgentMessageRole,
  AgentReferenceSummary,
  AgentResponse,
} from "../../prefabs/agent";
