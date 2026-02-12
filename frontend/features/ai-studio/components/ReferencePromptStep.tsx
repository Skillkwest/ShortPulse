/**
 * Prompt step wrapper for reference properties flows.
 */
import React from "react";
import { PromptStep } from "./PromptStep";

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
  agentIsSending: boolean;
  agentError?: string;
  onAgentEnhanceSend?: () => void;
  showEnhanceButton?: boolean;
  beginnerHelperText?: string;
  promptSaveButtonClassName?: string;
  promptSaveButtonUnstyled?: boolean;
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
  agentIsSending,
  agentError,
  onAgentEnhanceSend,
  showEnhanceButton = true,
  beginnerHelperText,
  promptSaveButtonClassName,
  promptSaveButtonUnstyled = false,
}) => {
  return (
    <div className="reference-dropzone-block prompt-block" style={{ order: promptOrder }}>
      <PromptStep
        stepNumber={isVideoVariant ? "2" : "2"}
        title="Write Your Prompt"
        subtitle="Start typing your prompt or drag & drop a prompt from the reference grid."
        prompt={referenceText ?? ""}
        onPromptChange={onPromptTextChange}
        agentEnabled={false}
        agentMessages={[]}
        agentInput=""
        agentIsSending={agentIsSending}
        agentError={agentError}
        onAgentEnhanceSend={onAgentEnhanceSend}
        onSavePrompt={onSave}
        isCollapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        isGenerating={false}
        onDrop={onDrop}
        onDragOver={(event) => event.preventDefault()}
        className="reference-step-card"
        beginnerMode={beginnerMode}
        beginnerTitle="Write Your Prompt"
        promptOnly
        enhanceOnly
        hideEnhanceButton={!showEnhanceButton}
        promptPlaceholder="Describe the image you want to generate. You can also drag & drop a reference prompt here to get started."
        beginnerSubtitle={beginnerHelperText}
        promptSaveButtonClassName={promptSaveButtonClassName}
        promptSaveButtonUnstyled={promptSaveButtonUnstyled}
      />
    </div>
  );
};
