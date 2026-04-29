/**
 * Standard Create chat presentation.
 * Owns the Standard-mode chat surface boundary without importing Pulse renderers.
 */
import React from "react";
import { AgentChatPanel, type AgentChatPanelProps } from "../../../../prefabs/agent";

export type StandardCreateChatPanelProps = AgentChatPanelProps;

export const StandardCreateChatPanel: React.FC<StandardCreateChatPanelProps> = (props) => (
  <AgentChatPanel {...props} />
);
