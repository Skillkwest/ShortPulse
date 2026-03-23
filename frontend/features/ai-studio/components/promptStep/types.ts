/**
 * Shared PromptStep component types.
 * Keeps the main component and split subcomponents aligned on one contract.
 */
import type {
  AgentActions,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../../../prefabs/agent";

export type PromptStepInlineGenerateConfig = {
  onGenerate: () => void;
  disabled?: boolean;
  ariaLabel?: string;
};

export type PromptStepProps = {
  stepNumber: string | number;
  title?: string;
  subtitle?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  // Agent props
  agentEnabled?: boolean;
  agentMessages?: AgentMessage[];
  agentActions?: AgentActions;
  agentInput?: string;
  chatModeEnabled?: boolean;
  agentAssistToggleAvailable?: boolean;
  agentAssistEnabled?: boolean;
  agentIsSending?: boolean;
  agentError?: string;
  agentPrimaryPrompt?: string | null;
  agentPrimarySource?: "agent" | "manual" | "reference";
  stagedPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  agentChatOpen?: boolean;
  onAgentInputChange?: (value: string) => void;
  onChatModeEnabledChange?: (value: boolean) => void;
  onAgentAssistEnabledChange?: (value: boolean) => void;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onExpandChat?: () => void;
  onClearAgentChat?: () => void;
  onAgentApplyPrompt?: (prompt: string) => void;
  onAgentSelectVariation?: (prompt: string) => void;
  onAgentDescribeTargets?: (targets: string[]) => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onGenerateOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  chatModeInlineGenerate?: PromptStepInlineGenerateConfig;
  useAgentResponseInlineGeneratePrefab?: boolean;
  // Actions
  onSavePrompt: (customPrompt?: string) => void;
  // State / UI
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isGenerating?: boolean;
  showGenerationThinkingInChat?: boolean;
  shouldDisableSave?: boolean;
  // Drag and Drop support
  onDrop?: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  className?: string;
  beginnerMode?: boolean;
  chatOnly?: boolean;
  promptOnly?: boolean;
  enhanceOnly?: boolean;
  hideEnhanceButton?: boolean;
  promptPlaceholder?: string;
  beginnerSubtitle?: string;
  beginnerTitle?: string;
  promptSaveButtonClassName?: string;
  promptSaveButtonUnstyled?: boolean;
  beginnerPinHelperText?: string;
  chatPromptSaveButtonClassName?: string;
  chatPromptSaveButtonUnstyled?: boolean;
  embedSendButtonInInput?: boolean;
  hideAgentIntroMessage?: boolean;
  agentAttachmentDropTarget?: "history" | "input";
  hideInputDropHint?: boolean;
  hideEmptyAgentChatState?: boolean;
  emptyAgentChatSpacerClassName?: string;
  highlightLatestAssistantOnly?: boolean;
  composerLeadingContent?: React.ReactNode;
  agentInputMaxHeightPx?: number;
  disableOutputGenerate?: boolean;
  outputGenerateCostCredits?: number | null;
};
