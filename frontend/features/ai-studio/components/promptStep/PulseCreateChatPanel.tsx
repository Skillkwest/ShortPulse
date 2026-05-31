/**
 * Pulse Create chat presentation.
 * Keeps Pulse message rendering out of the shared agent prefab.
 */
import React from "react";
import {
  AgentChatPanel,
  type AgentChatPanelProps,
  type AgentMessageContentProps,
} from "../../../../prefabs/agent";
import { CreateChatRichMessageBody } from "./CreateChatRichMessageBody";
import { PulseGuidedMessageBody } from "./PulseGuidedMessageBody";

export type PulseCreateChatPanelProps = AgentChatPanelProps;

const PulseAssistantMessageContent: React.FC<AgentMessageContentProps> = ({ message, textRef }) => (
  <PulseGuidedMessageBody ref={textRef} content={message.content} />
);

const PulseUserMessageContent: React.FC<AgentMessageContentProps> = ({ message }) => (
  <CreateChatRichMessageBody content={message.content} tone="user" />
);

export const PulseCreateChatPanel: React.FC<PulseCreateChatPanelProps> = (props) => (
  <AgentChatPanel
    {...props}
    assistantMessageClassName="agent-message--pulse-guided"
    AssistantMessageContent={PulseAssistantMessageContent}
    UserMessageContent={PulseUserMessageContent}
  />
);
