/**
 * Shared PromptStep component types.
 * Keeps the main component and split subcomponents aligned on one contract.
 */
import type {
  AgentChatPanelProps,
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentMessage,
  AgentOutputBubbleMediaState,
  AgentOutputGenerateInput,
} from "../../../../prefabs/agent";
import type { PromptTokenHighlightSegment } from "../../logic/promptTokenHighlight";

export type PromptStepPulseLoadingState = {
  phase: "starting_pulse" | "generating_step";
  title: string;
  presetLabel?: string | null;
};

export type PromptStepProps = {
  stepNumber: string | number;
  title?: string;
  subtitle?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  // Agent props
  agentEnabled?: boolean;
  agentBootstrapPending?: boolean;
  agentMessages?: AgentMessage[];
  agentInput?: string;
  chatModeEnabled?: boolean;
  agentIsSending?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  assistantBubbleMedia?: Record<string, AgentOutputBubbleMediaState>;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  onAgentInputChange?: (value: string) => void;
  onChatModeEnabledChange?: (value: boolean) => void;
  hideChatModeToggle?: boolean;
  onAgentSend?: () => void;
  onAgentEnhanceSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onClearAgentChat?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  onUseAssistantMessageAsPrompt?: (request: { messageId: string; prompt: string }) => void;
  onGenerateOutputPrompt?: (request: AgentOutputGenerateInput) => void;
  // State / UI
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isGenerating?: boolean;
  showGenerationThinkingInChat?: boolean;
  // Drag and Drop support
  onDrop?: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement | HTMLTextAreaElement>) => void;
  className?: string;
  chatOnly?: boolean;
  promptOnly?: boolean;
  enhanceOnly?: boolean;
  hideEnhanceButton?: boolean;
  promptPlaceholder?: string;
  promptInlineAction?: React.ReactNode;
  promptInlineActionClassName?: string;
  embedSendButtonInInput?: boolean;
  hideAgentIntroMessage?: boolean;
  agentAttachmentDropTarget?: "history" | "input";
  hideInputDropHint?: boolean;
  hideEmptyAgentChatState?: boolean;
  forceRenderAgentChatPanel?: boolean;
  emptyAgentChatSpacerClassName?: string;
  highlightLatestAssistantOnly?: boolean;
  CreateChatPanel?: React.ComponentType<AgentChatPanelProps>;
  composerMiddleContent?: React.ReactNode;
  composerLeadingContent?: React.ReactNode;
  composerTrailingContent?: React.ReactNode;
  chatComposerOverlayEnabled?: boolean;
  stackTrailingComposerControls?: boolean;
  hideChatComposerHint?: boolean;
  agentInputMaxHeightPx?: number;
  agentInputCollapseOnBlur?: boolean;
  autoFocusAgentInputOnMount?: boolean;
  onAgentInputVisualRowCountChange?: (rowCount: number) => void;
  disableOutputGenerate?: boolean;
  outputGenerateCostCredits?: number | null;
  outputGenerateGuardrailReason?: string | null;
  hideOutputGenerateControls?: boolean;
  chatHeaderExtraContent?: React.ReactNode;
  chatHistoryHeaderContent?: React.ReactNode;
  hideHeader?: boolean;
  autoResize?: boolean;
  autoResizeLayoutKey?: string | number;
  promptTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  promptHighlightSegments?: PromptTokenHighlightSegment[];
  onPromptDrop?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  onPromptDragOver?: (event: React.DragEvent<HTMLTextAreaElement>) => void;
  onPromptFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptSelect?: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};
