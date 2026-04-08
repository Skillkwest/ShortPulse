/**
 * Prompt step wrapper for reference properties flows.
 */
import React from "react";
import type { PromptTokenHighlightSegment } from "../logic/promptTokenHighlight";
import { PromptStep } from "./PromptStep";

type ReferencePromptStepProps = {
  promptBadge: string;
  promptOrder: number;
  referenceText: string | null;
  onPromptTextChange: (value: string) => void;
  onSave?: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDrop: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  beginnerMode: boolean;
  agentIsSending: boolean;
  agentError?: string;
  onAgentEnhanceSend?: () => void;
  showEnhanceButton?: boolean;
  beginnerHelperText?: string;
  beginnerPinHelperText?: string;
  promptSaveButtonClassName?: string;
  promptSaveButtonUnstyled?: boolean;
  hideHeader?: boolean;
  autoResize?: boolean;
  autoResizeLayoutKey?: string | number;
  promptPlaceholder?: string;
  promptInlineAction?: React.ReactNode;
  promptInlineActionClassName?: string;
  promptTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  promptHighlightSegments?: PromptTokenHighlightSegment[];
  onPromptFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptSelect?: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

/**
 * Renders prompt editing and agent interactions for reference workflows.
 */
export const ReferencePromptStep: React.FC<ReferencePromptStepProps> = ({
  promptBadge,
  promptOrder,
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
  beginnerPinHelperText,
  promptSaveButtonClassName,
  promptSaveButtonUnstyled = false,
  hideHeader = false,
  autoResize = false,
  autoResizeLayoutKey,
  promptPlaceholder = "Describe the image you want to generate. You can also drag & drop a reference prompt here to get started.",
  promptInlineAction,
  promptInlineActionClassName,
  promptTextareaRef,
  promptHighlightSegments,
  onPromptFocus,
  onPromptBlur,
  onPromptSelect,
  onPromptKeyDown,
}) => {
  return (
    <div className="reference-dropzone-block prompt-block" style={{ order: promptOrder }}>
      <PromptStep
        stepNumber={promptBadge}
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
        promptPlaceholder={promptPlaceholder}
        beginnerSubtitle={beginnerHelperText}
        beginnerPinHelperText={beginnerPinHelperText}
        promptSaveButtonClassName={promptSaveButtonClassName}
        promptSaveButtonUnstyled={promptSaveButtonUnstyled}
        hideHeader={hideHeader}
        autoResize={autoResize}
        autoResizeLayoutKey={autoResizeLayoutKey}
        promptInlineAction={promptInlineAction}
        promptInlineActionClassName={promptInlineActionClassName}
        promptTextareaRef={promptTextareaRef}
        promptHighlightSegments={promptHighlightSegments}
        onPromptFocus={onPromptFocus}
        onPromptBlur={onPromptBlur}
        onPromptSelect={onPromptSelect}
        onPromptKeyDown={onPromptKeyDown}
      />
    </div>
  );
};
