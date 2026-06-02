/**
 * Standard Create chat presentation.
 * Owns the Standard-mode chat surface boundary without importing Pulse renderers.
 */
import React from "react";
import {
  AgentChatPanel,
  type AgentChatPanelProps,
  type AgentMessageContentProps,
} from "../../../../prefabs/agent";
import { StandardMessageRenderer } from "./standardPresentation/standardMessageRenderer";

export type StandardCreateChatPanelProps = AgentChatPanelProps;

const StandardAssistantMessageContent: React.FC<AgentMessageContentProps> = ({
  message,
  textRef,
}) => <StandardMessageRenderer ref={textRef} content={message.content} tone="assistant" />;

const StandardUserMessageContent: React.FC<AgentMessageContentProps> = ({ message }) => (
  <StandardMessageRenderer content={message.content} tone="user" />
);

export const StandardCreateChatPanel: React.FC<StandardCreateChatPanelProps> = (props) => (
  <AgentChatPanel
    {...props}
    AssistantMessageContent={StandardAssistantMessageContent}
    UserMessageContent={StandardUserMessageContent}
  />
);
