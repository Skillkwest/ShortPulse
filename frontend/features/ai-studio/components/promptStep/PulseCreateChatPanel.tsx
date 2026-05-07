/**
 * Pulse Create chat presentation.
 * Keeps Pulse message rendering out of the shared agent prefab.
 */
import React from "react";
import {
  AgentChatPanel,
  type AgentAssistantMessageContentProps,
  type AgentChatPanelProps,
} from "../../../../prefabs/agent";
import { PulseGuidedMessageBody } from "./PulseGuidedMessageBody";

export type PulseCreateChatPanelProps = AgentChatPanelProps;

const PulseAssistantMessageContent: React.FC<AgentAssistantMessageContentProps> = ({
  message,
  textRef,
}) => <PulseGuidedMessageBody ref={textRef} content={message.content} />;

export const PulseCreateChatPanel: React.FC<PulseCreateChatPanelProps> = (props) => (
  <AgentChatPanel
    {...props}
    assistantMessageClassName="agent-message--pulse-guided"
    AssistantMessageContent={PulseAssistantMessageContent}
  />
);
