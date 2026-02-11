/**
 * Prompt step wrapper for reference properties flows.
 */
import React from "react";
import { PromptStep } from "./PromptStep";
import type { AgentActions, AgentMessage } from "../../../prefabs/agent";

type ReferencePromptStepProps = {
  promptOrder: number;
  isVideoVariant: boolean;
  referenceText: string | null;
  onPromptTextChange: (value: string) => void;
  onSave: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  beginnerMode: boolean;
  agentEnabled: boolean;
  agentMessages: AgentMessage[];
  agentActions?: AgentActions;
  agentInput: string;
  agentIsSending: boolean;
  agentError?: string;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedPrompt: string | null;
  agentChatOpen: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentMessageClick?: (message: AgentMessage) => void;
  onExpandChat?: () => void;
  onClearAgentChat?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentUseQuestion?: (question: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
};

/**
 * Renders prompt editing and agent interactions for reference workflows.
 */
export const ReferencePromptStep: React.FC<ReferencePromptStepProps> = ({
  promptOrder,
  isVideoVariant,
  referenceText,
  onPromptTextChange,
  onSave,
  collapsed,
  onToggleCollapse,
  onDrop,
  beginnerMode,
  agentEnabled,
  agentMessages,
  agentActions,
  agentInput,
  agentIsSending,
  agentError,
  agentPrimarySource = "manual",
  stagedPrompt,
  agentChatOpen,
  onAgentInputChange,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentMessageClick,
  onExpandChat,
  onClearAgentChat,
  onAgentApplyPrompt,
  onAgentSelectVariation,
  onAgentUseQuestion,
  onAgentDescribeTargets,
}) => {
  return (
    <div className="reference-dropzone-block prompt-block" style={{ order: promptOrder }}>
      <PromptStep
        stepNumber={isVideoVariant ? "2" : "2"}
        title="Write Your Prompt"
        subtitle="Start typing your prompt or drag & drop a prompt from the reference grid."
        prompt={referenceText ?? ""}
        onPromptChange={onPromptTextChange}
        agentEnabled={agentEnabled}
        agentMessages={agentMessages}
        agentActions={agentActions}
        agentInput={agentInput}
        agentIsSending={agentIsSending}
        agentError={agentError}
        agentPrimaryPrompt={referenceText ?? ""}
        agentPrimarySource={agentPrimarySource}
        stagedPrompt={stagedPrompt}
        agentChatOpen={agentChatOpen}
        onAgentInputChange={onAgentInputChange}
        onAgentSend={onAgentSend}
        onAgentEnhanceSend={onAgentEnhanceSend}
        onAgentMessageClick={onAgentMessageClick}
        onExpandChat={onExpandChat}
        onClearAgentChat={onClearAgentChat}
        onAgentApplyPrompt={onAgentApplyPrompt}
        onAgentSelectVariation={onAgentSelectVariation}
        onAgentUseQuestion={onAgentUseQuestion}
        onAgentDescribeTargets={onAgentDescribeTargets}
        onSavePrompt={onSave}
        isCollapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        isGenerating={false}
        onDrop={onDrop}
        onDragOver={(event) => event.preventDefault()}
        className="reference-step-card"
        beginnerMode={beginnerMode}
      />
    </div>
  );
};
