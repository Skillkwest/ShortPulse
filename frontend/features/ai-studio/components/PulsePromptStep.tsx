/**
 * Pulse prompt step component for AI Studio.
 * Handles Pulse chat composer and Pulse-mode presentation.
 */
import React from "react";
import type {
  AgentAssistantMessageEditRequest,
  AgentAttachment,
  AgentChatPanelProps,
  AgentMessage,
} from "../../../prefabs/agent";
import type { PromptTokenHighlightSegment } from "../logic/promptTokenHighlight";
import {
  insertDroppedPromptTextAtSelection,
  resolveAgentComposerDrop,
} from "./promptStep/agentComposerDrop";
import { PromptStepEnhancedSurface } from "./promptStep/PromptStepEnhancedSurface";
import { PromptStepHeader } from "./promptStep/PromptStepHeader";
import { PulsePromptStepChatSurface } from "./promptStep/PulsePromptStepChatSurface";
import type { PromptStepPulseLoadingState } from "./promptStep/types";

export type PulsePromptStepProps = {
  stepNumber: string | number;
  title?: string;
  subtitle?: string;
  prompt: string;
  onPromptChange: (value: string) => void;
  agentEnabled?: boolean;
  agentBootstrapPending?: boolean;
  agentMessages?: AgentMessage[];
  agentInput?: string;
  agentIsSending?: boolean;
  agentError?: string;
  stagedPrompt?: string | null;
  stagedAttachments?: AgentAttachment[];
  agentDropActive?: boolean;
  onAgentInputChange?: (value: string) => void;
  onAgentSend?: () => void;
  onAgentAttachmentDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;
  onAgentAttachmentDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;
  onRemoveAgentAttachment?: (id: string) => void;
  onClearAgentAttachments?: () => void;
  onClearAgentChat?: () => void;
  onAssistantMessageEdit?: (request: AgentAssistantMessageEditRequest) => boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isGenerating?: boolean;
  showGenerationThinkingInChat?: boolean;
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
  useFlowComposerLayout?: boolean;
  composerMiddleContent?: React.ReactNode;
  composerLeadingContent?: React.ReactNode;
  chatComposerOverlayEnabled?: boolean;
  stackTrailingComposerControls?: boolean;
  agentInputMaxHeightPx?: number;
  agentInputCollapseOnBlur?: boolean;
  onAgentInputVisualRowCountChange?: (rowCount: number) => void;
  pulseLoadingState?: PromptStepPulseLoadingState | null;
  chatHeaderExtraContent?: React.ReactNode;
  chatHistoryHeaderContent?: React.ReactNode;
  hideHeader?: boolean;
  autoResize?: boolean;
  autoResizeLayoutKey?: string | number;
  promptTextareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  promptHighlightSegments?: PromptTokenHighlightSegment[];
  onPromptFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
  onPromptSelect?: (event: React.SyntheticEvent<HTMLTextAreaElement>) => void;
  onPromptKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function PulsePromptStep({
  stepNumber,
  title = "Choose Prompt Mode",
  subtitle = "Draft the prompt you want to use, or switch to Chat to have the agent craft one for you.",
  prompt,
  onPromptChange,
  agentEnabled = false,
  agentBootstrapPending = false,
  agentMessages = [],
  agentInput = "",
  agentIsSending = false,
  agentError,
  stagedPrompt = null,
  stagedAttachments = [],
  agentDropActive = false,
  onAgentInputChange,
  onAgentSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onClearAgentChat,
  onAssistantMessageEdit,
  isCollapsed,
  onToggleCollapse,
  isGenerating = false,
  showGenerationThinkingInChat = true,
  onDrop,
  onDragOver,
  className = "",
  chatOnly = false,
  promptOnly = false,
  enhanceOnly = false,
  hideEnhanceButton = false,
  promptPlaceholder = "Describe what you want, then refine it.",
  promptInlineAction = null,
  promptInlineActionClassName = "",
  embedSendButtonInInput = false,
  hideAgentIntroMessage = false,
  agentAttachmentDropTarget = "history",
  hideInputDropHint = false,
  hideEmptyAgentChatState = false,
  forceRenderAgentChatPanel = false,
  emptyAgentChatSpacerClassName = "",
  highlightLatestAssistantOnly = false,
  CreateChatPanel,
  useFlowComposerLayout = false,
  composerMiddleContent = null,
  composerLeadingContent = null,
  chatComposerOverlayEnabled = false,
  stackTrailingComposerControls = false,
  agentInputMaxHeightPx,
  agentInputCollapseOnBlur = false,
  onAgentInputVisualRowCountChange,
  pulseLoadingState = null,
  chatHeaderExtraContent = null,
  chatHistoryHeaderContent = null,
  hideHeader = false,
  autoResize = false,
  autoResizeLayoutKey,
  promptTextareaRef,
  promptHighlightSegments,
  onPromptFocus,
  onPromptBlur,
  onPromptSelect,
  onPromptKeyDown,
}: PulsePromptStepProps) {
  void stepNumber;
  const [promptMode, setPromptMode] = React.useState<"enhanced" | "chat">(
    chatOnly ? "chat" : "enhanced"
  );
  const agentInputRef = React.useRef<HTMLTextAreaElement>(null);
  const shouldRestoreAgentInputFocusRef = React.useRef(false);
  const previousAgentIsSendingRef = React.useRef(agentIsSending);

  // Chat-only and prompt-only variants override the local mode state.
  React.useEffect(() => {
    if (promptOnly && promptMode !== "enhanced") {
      setPromptMode("enhanced");
      return;
    }
    if (chatOnly && promptMode !== "chat") {
      setPromptMode("chat");
      return;
    }
  }, [chatOnly, promptMode, promptOnly]);

  const effectiveTitle = title;

  const handleEnhancedPromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    onPromptKeyDown?.(event);
  };

  const canUsePromptSurface = agentEnabled || enhanceOnly;
  const isChatMode = !promptOnly && !enhanceOnly && (chatOnly || promptMode === "chat");
  const effectiveComposerInput = agentInput;
  const effectiveAgentInputChange = onAgentInputChange;
  const showInlineChat = isChatMode;
  const promptThinking = Boolean(agentIsSending || isGenerating);
  const chatThinking = Boolean(
    agentIsSending || (showGenerationThinkingInChat ? isGenerating : false)
  );
  const visibleSubtitle = subtitle;
  const isPulseLoading = pulseLoadingState != null;
  const markAgentInputFocusForRestore = React.useCallback(() => {
    shouldRestoreAgentInputFocusRef.current = true;
  }, []);
  const handleAgentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      agentIsSending ||
      isPulseLoading ||
      !canSendAgentInput
    ) {
      return;
    }
    event.preventDefault();
    markAgentInputFocusForRestore();
    onAgentSend?.();
    // Keep focus in the composer so the user can immediately type the next message.
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };
  const dropToInputComposer = agentAttachmentDropTarget === "input";
  const imageAttachmentCounts = React.useMemo(() => {
    const images = stagedAttachments.filter((attachment) => attachment.kind === "image");
    const total = images.length;
    const preparing = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "preparing"
    ).length;
    const ready = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "ready"
    ).length;
    const failed = images.filter(
      (attachment) => (attachment.deliveryStatus ?? "pending") === "failed"
    ).length;
    return {
      total,
      preparing,
      ready,
      failed,
    };
  }, [stagedAttachments]);
  const hasBlockingImageAttachments =
    imageAttachmentCounts.preparing > 0 || imageAttachmentCounts.failed > 0;
  const canSendAgentInput =
    !hasBlockingImageAttachments &&
    (effectiveComposerInput.trim().length > 0 || stagedAttachments.length > 0);
  const handleAgentSendClick = () => {
    if (!canSendAgentInput || isPulseLoading) return;
    markAgentInputFocusForRestore();
    onAgentSend?.();
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };
  const handleComposerAttachmentDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onAgentAttachmentDragOver?.(event);
  };
  const handleComposerAttachmentDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onAgentAttachmentDragEnter?.(event);
  };
  const handleComposerAttachmentDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onAgentAttachmentDragLeave?.(event);
  };
  const handleComposerAttachmentDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.stopPropagation();
    const { droppedPromptText, droppedImageUrl, isVideoReference } = resolveAgentComposerDrop(
      event.dataTransfer
    );
    if (droppedPromptText && !droppedImageUrl && !isVideoReference) {
      event.preventDefault();
      // Text-only drops bypass the generic attachment handler, so clear any drag-active affordance.
      onAgentAttachmentDragLeave?.(event);
      const textarea = agentInputRef.current;
      const selectionStart = textarea?.selectionStart ?? effectiveComposerInput.length;
      const selectionEnd = textarea?.selectionEnd ?? selectionStart;
      const insertedPrompt = insertDroppedPromptTextAtSelection({
        composerText: effectiveComposerInput,
        droppedPromptText,
        selectionStart,
        selectionEnd,
      });
      effectiveAgentInputChange?.(insertedPrompt.prompt);
      requestAnimationFrame(() => {
        agentInputRef.current?.focus();
        agentInputRef.current?.setSelectionRange(insertedPrompt.caret, insertedPrompt.caret);
      });
      return;
    }
    onAgentAttachmentDrop?.(event);
    requestAnimationFrame(() => agentInputRef.current?.focus());
  };
  const historyDropHandlers = dropToInputComposer
    ? {
        onDrop: undefined,
        onDragOver: undefined,
        onDragEnter: undefined,
        onDragLeave: undefined,
      }
    : {
        onDrop: onAgentAttachmentDrop,
        onDragOver: onAgentAttachmentDragOver,
        onDragEnter: onAgentAttachmentDragEnter,
        onDragLeave: onAgentAttachmentDragLeave,
      };
  const inputDropHandlers = dropToInputComposer
    ? {
        onDrop: handleComposerAttachmentDrop,
        onDragOver: handleComposerAttachmentDragOver,
        onDragEnter: handleComposerAttachmentDragEnter,
        onDragLeave: handleComposerAttachmentDragLeave,
      }
    : {
        onDrop: undefined,
        onDragOver: undefined,
        onDragEnter: undefined,
        onDragLeave: undefined,
      };
  const rootDropHandlers = dropToInputComposer
    ? {
        onDrop: undefined,
        onDragOver: undefined,
        onDragEnter: undefined,
        onDragLeave: undefined,
      }
    : {
        onDrop,
        onDragOver,
        onDragEnter: undefined,
        onDragLeave: undefined,
      };
  const showComposerAttachments = dropToInputComposer && stagedAttachments.length > 0;
  React.useEffect(() => {
    if (!agentIsSending || !shouldRestoreAgentInputFocusRef.current) return undefined;

    const isInsideComposer = (target: EventTarget | null) => {
      const textarea = agentInputRef.current;
      if (!textarea || !(target instanceof Node)) return false;
      const composerShell = textarea.closest(".agent-composer-input-shell");
      return Boolean(composerShell?.contains(target) || textarea.contains(target));
    };
    const cancelRestoreIfOutsideComposer = (event: Event) => {
      if (isInsideComposer(event.target)) return;
      shouldRestoreAgentInputFocusRef.current = false;
    };

    document.addEventListener("pointerdown", cancelRestoreIfOutsideComposer, true);
    document.addEventListener("mousedown", cancelRestoreIfOutsideComposer, true);
    document.addEventListener("focusin", cancelRestoreIfOutsideComposer, true);

    return () => {
      document.removeEventListener("pointerdown", cancelRestoreIfOutsideComposer, true);
      document.removeEventListener("mousedown", cancelRestoreIfOutsideComposer, true);
      document.removeEventListener("focusin", cancelRestoreIfOutsideComposer, true);
    };
  }, [agentIsSending]);

  React.useEffect(() => {
    const wasAgentSending = previousAgentIsSendingRef.current;
    previousAgentIsSendingRef.current = agentIsSending;
    if (agentIsSending || !wasAgentSending || !shouldRestoreAgentInputFocusRef.current) return;
    shouldRestoreAgentInputFocusRef.current = false;
    requestAnimationFrame(() => {
      if (!agentInputRef.current?.disabled) {
        agentInputRef.current?.focus();
      }
    });
  }, [agentIsSending]);

  const introMessage = React.useMemo<AgentMessage>(
    () => ({
      id: "agent-intro",
      role: "system",
      content:
        "Hey, I'm your studio agent. Tell me what you want to create and I'll turn it into a generation ready prompt.",
    }),
    []
  );

  return (
    <div
      className={`step-card prompt-step ${isCollapsed ? "is-collapsed" : ""} ${className}`}
      onClick={() => {
        // Only collapse if clicking the header or specific non-interactive areas if needed.
        // For now, consistent with other steps: clicking container expands if collapsed.
        if (isCollapsed) onToggleCollapse();
      }}
      role="group"
      aria-label={`${effectiveTitle} section`}
      {...rootDropHandlers}
    >
      {!hideHeader ? (
        <PromptStepHeader
          effectiveTitle={effectiveTitle}
          visibleSubtitle={visibleSubtitle}
          chatOnly={chatOnly}
          isCollapsed={isCollapsed}
          onToggleCollapse={onToggleCollapse}
          onClearAgentChat={onClearAgentChat}
          chatHeaderExtraContent={chatHeaderExtraContent}
        />
      ) : null}
      {!isCollapsed || hideHeader ? (
        canUsePromptSurface ? (
          <>
            {showInlineChat ? (
              <PulsePromptStepChatSurface
                chatOnly={chatOnly}
                promptOnly={promptOnly}
                enhanceOnly={enhanceOnly}
                promptMode={promptMode}
                setPromptMode={setPromptMode}
                onClearAgentChat={onClearAgentChat}
                promptThinking={chatThinking}
                hideAgentIntroMessage={hideAgentIntroMessage}
                hideEmptyAgentChatState={hideEmptyAgentChatState}
                emptyAgentChatSpacerClassName={emptyAgentChatSpacerClassName}
                agentMessages={agentMessages}
                introMessage={introMessage}
                chatHistoryHeaderContent={chatHistoryHeaderContent}
                stagedPrompt={stagedPrompt}
                stagedAttachments={stagedAttachments}
                dropToInputComposer={dropToInputComposer}
                hideInputDropHint={hideInputDropHint}
                forceRenderAgentChatPanel={forceRenderAgentChatPanel}
                agentDropActive={agentDropActive}
                historyDropHandlers={historyDropHandlers}
                inputDropHandlers={inputDropHandlers}
                onRemoveAgentAttachment={onRemoveAgentAttachment}
                onClearAgentAttachments={onClearAgentAttachments}
                onAgentInputChange={effectiveAgentInputChange}
                agentBootstrapPending={agentBootstrapPending}
                onAgentSend={onAgentSend}
                highlightLatestAssistantOnly={highlightLatestAssistantOnly}
                CreateChatPanel={CreateChatPanel}
                {...(useFlowComposerLayout ? { useFlowComposerLayout, pulseLoadingState } : {})}
                composerMiddleContent={composerMiddleContent}
                composerLeadingContent={composerLeadingContent}
                chatComposerOverlayEnabled={chatComposerOverlayEnabled}
                stackTrailingComposerControls={stackTrailingComposerControls}
                showComposerAttachments={showComposerAttachments}
                agentInputRef={agentInputRef}
                agentInput={effectiveComposerInput}
                handleAgentInputKeyDown={handleAgentInputKeyDown}
                agentInputMaxHeightPx={agentInputMaxHeightPx}
                agentInputCollapseOnBlur={agentInputCollapseOnBlur}
                onAgentInputVisualRowCountChange={onAgentInputVisualRowCountChange}
                embedSendButtonInInput={embedSendButtonInInput}
                handleAgentSendClick={handleAgentSendClick}
                agentIsSending={agentIsSending}
                imageAttachmentCounts={imageAttachmentCounts}
                onAssistantMessageEdit={onAssistantMessageEdit}
              />
            ) : (
              <PromptStepEnhancedSurface
                prompt={prompt}
                onPromptChange={onPromptChange}
                handleEnhancedPromptKeyDown={handleEnhancedPromptKeyDown}
                promptThinking={promptThinking}
                promptPlaceholder={promptPlaceholder}
                hideEnhanceButton={hideEnhanceButton}
                enhanceOnly={enhanceOnly}
                onAgentSend={onAgentSend}
                agentIsSending={agentIsSending}
                agentBootstrapPending={agentBootstrapPending}
                autoResize={autoResize}
                autoResizeLayoutKey={autoResizeLayoutKey}
                inlineAction={promptInlineAction}
                inlineActionClassName={promptInlineActionClassName}
                promptTextareaRef={promptTextareaRef}
                promptHighlightSegments={promptHighlightSegments}
                onPromptDrop={onDrop}
                onPromptDragOver={onDragOver}
                onPromptFocus={onPromptFocus}
                onPromptBlur={onPromptBlur}
                onPromptSelect={onPromptSelect}
              />
            )}
          </>
        ) : (
          <div className="prompt-placeholder helper-text">
            <p className="prompt-placeholder-highlight">Prompt mode disabled</p>
            <p>Components are not active.</p>
          </div>
        )
      ) : null}
      {canUsePromptSurface && agentError && !isCollapsed ? (
        <div className="inline-error-hint">{agentError}</div>
      ) : null}
    </div>
  );
}
