/**
 * Shared helpers for the neutral Create agent state hook.
 * Keeps message identity, cloning, equality, and assistant payload shaping out of hook orchestration.
 */
import type {
  AgentApiContext,
  AgentApiRequest,
  AgentAttachment,
  AgentMessage,
  AgentResponse,
  AgentRuntimeMode,
} from "../../prefabs/agent";
import { randomId } from "./client/sessionController";
import type { StudioAgentTransportResult } from "./client/studioAgentTransport";
import type { CreateAgentTransportSuccess, SendParams } from "./createAgentStateTypes";

export type UseCreateAgentStateCoreOptions = {
  initialMessages?: AgentMessage[];
  enabled?: boolean;
  conversationId?: string;
  sessionNamespace?: string;
  requestRuntimeMode: AgentRuntimeMode;
  allowSessionNamespaceOverride: boolean;
  sessionNamespaceOverrideErrorText?: string;
  buildAgentContext: (
    context: NonNullable<SendParams["context"]>
  ) => AgentApiContext | Promise<AgentApiContext>;
  resolveRequestHistory?: (messages: AgentMessage[]) => AgentMessage[];
  sendAgentTurn: (body: AgentApiRequest) => Promise<StudioAgentTransportResult>;
  resolveTransportSuccess: (
    response: AgentResponse
  ) => CreateAgentTransportSuccess | Promise<CreateAgentTransportSuccess>;
};

export const createAgentMessageId = (role: "user" | "assistant") => `agent-${role}-${randomId()}`;

export const cloneAgentAttachments = (attachments: AgentAttachment[] = []): AgentAttachment[] =>
  attachments.map((attachment) => ({ ...attachment }));

export const resolveAssistantMessagePayload = ({
  assistantReply,
  promptArtifact,
  assistantContent,
  assistantOutputPrompt,
}: Pick<
  CreateAgentTransportSuccess,
  "assistantReply" | "promptArtifact" | "assistantContent" | "assistantOutputPrompt"
>): {
  content: string;
  outputPrompt: string | null;
} => ({
  content: assistantReply?.text ?? assistantContent,
  outputPrompt: promptArtifact?.text ?? assistantOutputPrompt,
});

export const areAgentMessagesEqual = (left: AgentMessage[], right: AgentMessage[]): boolean => {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  return left.every((message, index) => {
    const other = right[index];
    if (!other) return false;
    const leftAttachments = message.attachments ?? [];
    const rightAttachments = other.attachments ?? [];
    return (
      message.id === other.id &&
      message.role === other.role &&
      message.content === other.content &&
      (message.outputPrompt ?? null) === (other.outputPrompt ?? null) &&
      (message.canUseAsPrompt ?? null) === (other.canUseAsPrompt ?? null) &&
      (message.outcomeClass ?? null) === (other.outcomeClass ?? null) &&
      (message.reasonCode ?? null) === (other.reasonCode ?? null) &&
      (message.decision ?? null) === (other.decision ?? null) &&
      leftAttachments.length === rightAttachments.length &&
      leftAttachments.every((attachment, attachmentIndex) => {
        const otherAttachment = rightAttachments[attachmentIndex];
        return (
          attachment.id === otherAttachment?.id &&
          attachment.kind === otherAttachment?.kind &&
          (attachment.source ?? null) === (otherAttachment?.source ?? null) &&
          (attachment.referenceId ?? null) === (otherAttachment?.referenceId ?? null) &&
          (attachment.text ?? null) === (otherAttachment?.text ?? null) &&
          (attachment.imageUrl ?? null) === (otherAttachment?.imageUrl ?? null) &&
          (attachment.modelDataUrl ?? null) === (otherAttachment?.modelDataUrl ?? null) &&
          (attachment.aspect ?? null) === (otherAttachment?.aspect ?? null) &&
          (attachment.deliveryStatus ?? null) === (otherAttachment?.deliveryStatus ?? null) &&
          (attachment.deliveryError ?? null) === (otherAttachment?.deliveryError ?? null)
        );
      })
    );
  });
};
