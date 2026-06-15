/**
 * Shared prompt step component for AI Studio.
 * Handles prompt entry modes and Agent interactions.
 */
import React from "react";
import { AppMessage } from "../../../components/AppMessage";
import type { AgentMessage } from "../../../prefabs/agent";
import { resolveAgentComposerTextDropInsertion } from "./promptStep/agentComposerDrop";
import { PromptStepEnhancedSurface } from "./promptStep/PromptStepEnhancedSurface";
import { PromptStepHeader } from "./promptStep/PromptStepHeader";
import { StandardPromptStepChatSurface } from "./promptStep/StandardPromptStepChatSurface";
import type { PromptStepProps } from "./promptStep/types";
export type { PromptStepProps } from "./promptStep/types";

export function PromptStep({
  stepNumber,
  title = "Choose Prompt Mode",
  subtitle = "Draft the prompt you want to use, or switch to Chat to have the agent craft one for you.",
  prompt,
  onPromptChange,
  agentEnabled = false,
  agentBootstrapPending = false,
  agentMessages = [],
  agentInput = "",
  chatModeEnabled = true,
  agentIsSending = false,
  agentThinkingLabel,
  agentError,
  stagedPrompt = null,
  assistantBubbleMedia,
  stagedAttachments = [],
  agentDropActive = false,
  onAgentInputChange,
  onChatModeEnabledChange,
  hideChatModeToggle = false,
  onAgentSend,
  onAgentEnhanceSend,
  onAgentAttachmentDrop,
  onAgentAttachmentDragOver,
  onAgentAttachmentDragEnter,
  onAgentAttachmentDragLeave,
  onRemoveAgentAttachment,
  onClearAgentAttachments,
  onClearAgentChat,
  onAssistantMessageEdit,
  onUseAssistantMessageAsPrompt,
  onGenerateOutputPrompt,
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
  composerMiddleContent = null,
  composerLeadingContent = null,
  composerTrailingContent = null,
  chatComposerOverlayEnabled = false,
  stackTrailingComposerControls = false,
  hideChatComposerHint = false,
  agentInputMaxHeightPx,
  agentInputCollapseOnBlur = false,
  autoFocusAgentInputOnMount = false,
  onAgentInputVisualRowCountChange,
  disableOutputGenerate = false,
  outputGenerateCostCredits = null,
  outputGenerateGuardrailReason = null,
  hideOutputGenerateControls = false,
  chatHeaderExtraContent = null,
  hideHeader = false,
  autoResize = false,
  autoResizeLayoutKey,
  promptTextareaRef,
  promptHighlightSegments,
  onPromptFocus,
  onPromptBlur,
  onPromptSelect,
  onPromptKeyDown,
}: PromptStepProps) {
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
    if (event.defaultPrevented) {
      return;
    }
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      agentIsSending ||
      hideEnhanceButton ||
      !onAgentEnhanceSend
    ) {
      return;
    }
    event.preventDefault();
    onAgentEnhanceSend();
  };

  const canUsePromptSurface = agentEnabled || enhanceOnly;
  const isChatMode = !promptOnly && !enhanceOnly && (chatOnly || promptMode === "chat");
  const effectiveComposerInput = chatModeEnabled ? agentInput : prompt;
  const effectiveAgentInputChange = chatModeEnabled ? onAgentInputChange : onPromptChange;
  const showInlineChat = isChatMode;
  const promptThinking = Boolean(agentIsSending || isGenerating);
  const chatThinking = Boolean(
    agentIsSending || (showGenerationThinkingInChat ? isGenerating : false)
  );
  const visibleSubtitle = subtitle;
  const markAgentInputFocusForRestore = React.useCallback(() => {
    shouldRestoreAgentInputFocusRef.current = true;
  }, []);
  const handleAgentInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey || agentIsSending || !canSendAgentInput) return;
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
    chatModeEnabled &&
    !hasBlockingImageAttachments &&
    (effectiveComposerInput.trim().length > 0 || stagedAttachments.length > 0);
  const handleAgentSendClick = () => {
    if (!canSendAgentInput) return;
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
    const textarea = agentInputRef.current;
    const insertedPrompt = resolveAgentComposerTextDropInsertion({
      transfer: event.dataTransfer,
      composerText: effectiveComposerInput,
      selectionStart: textarea?.selectionStart ?? effectiveComposerInput.length,
      selectionEnd:
        textarea?.selectionEnd ?? textarea?.selectionStart ?? effectiveComposerInput.length,
    });
    if (insertedPrompt) {
      event.preventDefault();
      // Text-only drops bypass the generic attachment handler, so clear any drag-active affordance.
      onAgentAttachmentDragLeave?.(event);
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

    // Treat only explicit pointer intent as "the user clicked away".
    // Browser-driven focus drift while the textarea is disabled in-flight
    // should not cancel the post-send focus restore.
    document.addEventListener("pointerdown", cancelRestoreIfOutsideComposer, true);
    document.addEventListener("mousedown", cancelRestoreIfOutsideComposer, true);

    return () => {
      document.removeEventListener("pointerdown", cancelRestoreIfOutsideComposer, true);
      document.removeEventListener("mousedown", cancelRestoreIfOutsideComposer, true);
    };
  }, [agentIsSending]);

  React.useLayoutEffect(() => {
    if (!agentIsSending || !shouldRestoreAgentInputFocusRef.current) return;

    const textarea = agentInputRef.current;
    if (!textarea || textarea.disabled) return;
    const composerShell = textarea.closest(".agent-composer-input-shell");
    const activeElement = document.activeElement;
    const isFocusInsideComposer =
      activeElement instanceof Node &&
      Boolean(composerShell?.contains(activeElement) || textarea.contains(activeElement));
    if (!isFocusInsideComposer) {
      textarea.focus();
    }
  }, [agentInput, agentIsSending]);

  React.useLayoutEffect(() => {
    if (!autoFocusAgentInputOnMount) return;
    const textarea = agentInputRef.current;
    if (!textarea || textarea.disabled) return;
    textarea.focus();
  }, [autoFocusAgentInputOnMount]);

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
              <StandardPromptStepChatSurface
                chatOnly={chatOnly}
                promptOnly={promptOnly}
                enhanceOnly={enhanceOnly}
                promptMode={promptMode}
                setPromptMode={setPromptMode}
                onClearAgentChat={onClearAgentChat}
                promptThinking={chatThinking}
                thinkingIndicatorLabel={agentThinkingLabel}
                hideAgentIntroMessage={hideAgentIntroMessage}
                hideEmptyAgentChatState={hideEmptyAgentChatState}
                emptyAgentChatSpacerClassName={emptyAgentChatSpacerClassName}
                agentMessages={agentMessages}
                introMessage={introMessage}
                stagedPrompt={stagedPrompt}
                assistantBubbleMedia={assistantBubbleMedia}
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
                chatModeEnabled={chatModeEnabled}
                onChatModeEnabledChange={onChatModeEnabledChange}
                hideChatModeToggle={hideChatModeToggle}
                agentBootstrapPending={agentBootstrapPending}
                onAgentSend={onAgentSend}
                onGenerateOutputPrompt={onGenerateOutputPrompt}
                onUseAssistantMessageAsPrompt={onUseAssistantMessageAsPrompt}
                highlightLatestAssistantOnly={highlightLatestAssistantOnly}
                CreateChatPanel={CreateChatPanel}
                disableOutputGenerate={disableOutputGenerate}
                outputGenerateCostCredits={outputGenerateCostCredits}
                outputGenerateGuardrailReason={outputGenerateGuardrailReason}
                hideOutputGenerateControls={hideOutputGenerateControls}
                composerMiddleContent={composerMiddleContent}
                composerLeadingContent={composerLeadingContent}
                composerTrailingContent={composerTrailingContent}
                chatComposerOverlayEnabled={chatComposerOverlayEnabled}
                stackTrailingComposerControls={stackTrailingComposerControls}
                hideChatComposerHint={hideChatComposerHint}
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
                onAgentEnhanceSend={onAgentEnhanceSend}
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
        <AppMessage className="inline-error-hint" tone="error" mode="inline" message={agentError} />
      ) : null}
    </div>
  );
}
